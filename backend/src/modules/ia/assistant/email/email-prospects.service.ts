import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomBytes } from 'node:crypto';
import { BusinessException } from '../../../../common';
import type { Env } from '../../../../config/env.validation';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AssistantEvents, type ProspectEvent } from '../assistant.events';
import { LLM_CLIENT, type LlmClient, LlmError } from '../llm/llm.client';
import { ProspectDedupService } from '../prospect-dedup.service';
import { extractContacts, mergeFields, type ProspectFields } from '../prospect-fields';
import { buildEmailMessages, EMAIL_PROSPECT_SCHEMA } from './email-prospect.prompt';
import { corpsUtile, estAdresseInterne, ressembleDemande, sujetPropre } from './email-rules';
import { type EmailRecu, MAILBOX_READER, type MailboxReader } from './mailbox.reader';

/** Emails handled per run (the rest waits for the next run: no endless run on a full mailbox). */
const MAX_PAR_RELEVE = 50;
/** A new email of the same sender within this period joins his open prospect. */
const SUITE_JOURS = 60;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
/** « CRM Bâtiment <noreply@x.fr> » → « noreply@x.fr » */
const adresseDe = (v: string | undefined) =>
  (v?.match(/<([^>]+)>/)?.[1] ?? v ?? '').trim().toLowerCase() || null;

export interface BilanReleve {
  date: string;
  lus: number;
  prospects: number;
  rejetes: number;
  suites: number;
  ignores: number;
  erreurs: number;
}

interface Analyse {
  estDemande: boolean;
  motif: string;
  champs: Record<string, unknown>;
  modeIA: boolean;
}

/**
 * Prospects by email (22/10): a dedicated mailbox is read every few minutes. Each unread email
 * becomes a prospect « à qualifier » (same list, same qualification as the chatbot ones), or is
 * set aside as « rejeté » when the AI sees it is not a request (advert, supplier invoice…).
 * Auto-replies, mailing lists and our own emails are skipped. Emails are marked read, never deleted.
 */
@Injectable()
export class EmailProspectsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailProspectsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private premier: ReturnType<typeof setTimeout> | null = null;
  private enCours = false;
  private dernier: (BilanReleve & { erreur?: string }) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly dedup: ProspectDedupService,
    private readonly events: EventEmitter2,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    @Inject(MAILBOX_READER) private readonly reader: MailboxReader | null,
  ) {}

  onModuleInit() {
    if (!this.reader || process.env.NODE_ENV === 'test') return;
    const minutes = this.config.get('IMAP_POLL_MINUTES', { infer: true });
    const run = () => {
      // The previous run (or a « Relever les emails » click) is still going: wait for the next turn
      if (this.enCours)
        return this.logger.debug(
          'Relevé des emails : le précédent est encore en cours, tour suivant.',
        );
      void this.relever().catch((e: unknown) =>
        this.logger.warn(`Relevé des emails : ${e instanceof Error ? e.message : String(e)}`),
      );
    };
    this.premier = setTimeout(run, 30_000); // shortly after start-up
    this.timer = setInterval(run, minutes * 60_000);
    this.logger.log(`Prospects par email : ${this.reader.description}, toutes les ${minutes} min`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.premier) clearTimeout(this.premier);
  }

  statut() {
    return {
      active: !!this.reader,
      boite: this.reader?.description ?? null,
      intervalleMinutes: this.config.get('IMAP_POLL_MINUTES', { infer: true }),
      enCours: this.enCours,
      dernier: this.dernier,
    };
  }

  /** One run (the timer, or « Relever les emails » in the back-office). */
  async relever(): Promise<BilanReleve> {
    if (!this.reader) {
      throw new BusinessException(
        'IMAP_NON_CONFIGURE',
        'Aucune boîte mail configurée (IMAP_HOST, IMAP_USER, IMAP_PASS dans le .env du backend).',
      );
    }
    if (this.enCours)
      throw new BusinessException(
        'RELEVE_EN_COURS',
        'Un relevé est déjà en cours, réessayez dans un instant.',
      );
    this.enCours = true;
    const bilan: BilanReleve = {
      date: new Date().toISOString(),
      lus: 0,
      prospects: 0,
      rejetes: 0,
      suites: 0,
      ignores: 0,
      erreurs: 0,
    };
    try {
      const companyId = await this.entreprise();
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { email: true },
      });
      const internes = [
        adresseDe(this.config.get('MAIL_FROM', { infer: true })),
        this.config.get('IMAP_USER', { infer: true }),
        company.email,
      ];
      const typesProjet = (
        await this.prisma.typeProjet.findMany({
          where: { companyId, actif: true },
          select: { nom: true },
        })
      ).map((t) => t.nom);

      const r = await this.reader.traiterNonLus(MAX_PAR_RELEVE, async (email) => {
        try {
          await this.importer(companyId, email, internes, typesProjet, bilan);
        } catch (error) {
          await this.journal(
            companyId,
            'EMAIL_IMPORT',
            `« ${email.sujet.slice(0, 80)} » de ${email.expediteur.adresse ?? '?'} : ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      });
      bilan.lus = r.lus + r.erreurs;
      bilan.erreurs = r.erreurs;
      this.dernier = bilan;
      if (bilan.lus)
        this.logger.log(
          `Emails : ${bilan.lus} lu(s), ${bilan.prospects} prospect(s), ${bilan.rejetes} écarté(s), ${bilan.suites} suite(s)`,
        );
      return bilan;
    } catch (error) {
      const message =
        error instanceof BusinessException
          ? error.message
          : `Connexion à la boîte impossible : ${error instanceof Error ? error.message : String(error)}`;
      this.dernier = { ...bilan, erreur: message };
      if (error instanceof BusinessException) throw error;
      throw new BusinessException('IMAP_ERREUR', message);
    } finally {
      this.enCours = false;
    }
  }

  // ── one email ───────────────────────────────────────────────────────────

  async importer(
    companyId: number,
    email: EmailRecu,
    internes: (string | null | undefined)[],
    typesProjet: string[],
    bilan: BilanReleve,
  ) {
    const adresse = email.expediteur.adresse;
    if (
      email.messageId &&
      (await this.prisma.chatSession.count({ where: { emailMessageId: email.messageId } }))
    ) {
      bilan.ignores++;
      return;
    }
    if (email.automatique || !adresse || estAdresseInterne(adresse, internes)) {
      bilan.ignores++;
      return;
    }
    const sujet = sujetPropre(email.sujet);
    const corps = corpsUtile(email.texte);
    const contenu = `${sujet ? `Objet : ${sujet}\n\n` : ''}${corps || '(email vide)'}`;

    // The same person writes again: the email joins his open prospect
    const ouvert = await this.prisma.chatSession.findFirst({
      where: {
        companyId,
        source: 'EMAIL',
        clientEmail: adresse,
        statut: { in: ['NOUVEAU', 'A_QUALIFIER'] },
        createdAt: { gte: new Date(Date.now() - SUITE_JOURS * 86_400_000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (ouvert) {
      await this.prisma.chatSession.update({
        where: { id: ouvert.id },
        data: {
          derniereActivite: email.date,
          messages: {
            create: {
              role: 'user',
              contenu,
              nlpResultat: { source: 'email', messageId: email.messageId },
            },
          },
        },
      });
      bilan.suites++;
      return;
    }

    const analyse = await this.analyser(companyId, email, sujet, corps, typesProjet);
    // Base: the sender (address + display name), then what the email says (validated)
    const base = mergeFields({}, { email: adresse, nom: email.expediteur.nom }, typesProjet);
    const champs: ProspectFields = mergeFields(base, analyse.champs, typesProjet);
    if (!champs.description)
      champs.description = (sujet ? `${sujet} — ` : '') + corps.slice(0, 600);

    const [client, doublon] = analyse.estDemande
      ? await Promise.all([
          this.dedup.findClient(companyId, champs.email, champs.telephone),
          this.dedup.findSession(companyId, 0, champs.email, champs.telephone),
        ])
      : [null, null];

    const session = await this.prisma.chatSession.create({
      data: {
        companyId,
        tokenHash: sha256(randomBytes(32).toString('base64url')), // no visitor link for an email prospect
        source: 'EMAIL',
        emailMessageId: email.messageId,
        emailSujet: sujet || null,
        statut: analyse.estDemande ? 'A_QUALIFIER' : 'REJETE',
        motifRejet: analyse.estDemande
          ? null
          : `Tri automatique${analyse.modeIA ? '' : ' (sans IA)'} : ${analyse.motif}`.slice(0, 500),
        clientNom: champs.nom ?? null,
        clientPrenom: champs.prenom ?? null,
        clientEmail: champs.email ?? null,
        clientTelephone: champs.telephone ?? null,
        adresse: champs.adresse ?? null,
        typeProjet: champs.typeProjet ?? null,
        description: champs.description?.slice(0, 2000) ?? null,
        delai: champs.delai ?? null,
        clientId: client?.id ?? null,
        doublonDeId: doublon?.id ?? null,
        derniereActivite: email.date,
        messages: {
          create: {
            role: 'user',
            contenu,
            nlpResultat: {
              source: 'email',
              messageId: email.messageId,
              modeIA: analyse.modeIA,
              estDemande: analyse.estDemande,
              motif: analyse.motif,
            },
          },
        },
      },
      select: { id: true },
    });

    if (!analyse.estDemande) {
      bilan.rejetes++;
      return;
    }
    bilan.prospects++;
    const event: ProspectEvent = {
      companyId,
      sessionId: session.id,
      nom: champs.nom ?? null,
      typeProjet: champs.typeProjet ?? null,
      doublon: !!doublon,
      source: 'EMAIL',
    };
    this.events.emit(AssistantEvents.PROSPECT_A_QUALIFIER, event);
  }

  /** AI sorting + reading; keyword sorting when there is no AI (or it fails). */
  private async analyser(
    companyId: number,
    email: EmailRecu,
    sujet: string,
    corps: string,
    typesProjet: string[],
  ): Promise<Analyse> {
    const guide = (): Analyse => {
      const demande = ressembleDemande(sujet, corps);
      return {
        estDemande: demande,
        motif: demande ? 'mots-clés de travaux trouvés' : 'aucun mot-clé de travaux',
        champs: {
          ...extractContacts(corps),
          description: [sujet, corps.slice(0, 600)].filter(Boolean).join(' — '),
        },
        modeIA: false,
      };
    };
    if (!this.llm) return guide();
    try {
      const raw = (await this.llm.completeJson(
        buildEmailMessages({
          expediteur: email.expediteur.adresse ?? '',
          nomExpediteur: email.expediteur.nom,
          sujet,
          corps,
          typesProjet,
        }),
        EMAIL_PROSPECT_SCHEMA,
        { maxTokens: 600 },
      )) as Record<string, unknown> | null;
      if (!raw || typeof raw.estDemande !== 'boolean')
        throw new LlmError('LLM_REPONSE_INVALIDE', 'réponse hors format');
      return {
        estDemande: raw.estDemande,
        motif:
          typeof raw.motif === 'string' && raw.motif.trim()
            ? raw.motif.trim().slice(0, 200)
            : raw.estDemande
              ? 'demande de travaux'
              : 'pas une demande',
        champs: raw,
        modeIA: true,
      };
    } catch (error) {
      await this.journal(
        companyId,
        `EMAIL_${error instanceof LlmError ? error.type : 'LLM_INDISPONIBLE'}`,
        error instanceof Error ? error.message : String(error),
      );
      return guide();
    }
  }

  /** The company the mailbox belongs to: IMAP_COMPANY_ID, or the only one in the database. */
  private async entreprise(): Promise<number> {
    const configured = this.config.get('IMAP_COMPANY_ID', { infer: true });
    if (configured) return configured;
    const companies = await this.prisma.company.findMany({
      select: { id: true },
      take: 2,
      orderBy: { id: 'asc' },
    });
    if (companies.length !== 1) {
      throw new BusinessException(
        'IMAP_ENTREPRISE',
        'Plusieurs entreprises en base : indiquez IMAP_COMPANY_ID dans le .env du backend.',
      );
    }
    return companies[0].id;
  }

  /** Errors are listed with the chatbot's (Assistant IA → Journal). */
  private async journal(companyId: number, type: string, detail: string) {
    this.logger.warn(`${type}: ${detail}`);
    await this.prisma.assistantErreur
      .create({ data: { companyId, type, detail: detail.slice(0, 500) } })
      .catch(() => undefined);
  }
}
