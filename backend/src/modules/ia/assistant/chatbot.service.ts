import { HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomBytes } from 'node:crypto';
import { BusinessException } from '../../../common';
import type { ChatSession, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantEvents, type ProspectEvent } from './assistant.events';
import { ConnaissancesService, type Connaissance } from './connaissances.service';
import { CoordonneesDto, FeedbackDto } from './dto/assistant.dto';
import { LLM_CLIENT, LlmError, type LlmClient, type LlmMessage } from './llm/llm.client';
import { buildSystemPrompt, parseReponse, REPONSE_SCHEMA, SUGGESTIONS_ACCUEIL, type ReponseModele } from './prompt';
import { ProspectDedupService } from './prospect-dedup.service';
import { ASK_ORDER, extractContacts, FIELD_LABELS, isComplete, mergeFields, missingFields, normalizeEmail, normalizePhone, type ProspectFields } from './prospect-fields';
import { checkSensitiveOutput, SAFE_PRICE_REPLY } from './sensitive-output';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
/** Anti-abuse: beyond this, the visitor is sent to a human. */
const MAX_MESSAGES = 40;
const HISTORY = 12;

export interface ChatReply {
  reponse: string;
  suggestions: string[];
  champsManquants: string[];
  prospectEnregistre: boolean;
  besoinHumain: boolean;
}

type Session = ChatSession;

/**
 * Public chatbot (spec P0–P4). One conversation = one prospect (ChatSession):
 *  visitor message → knowledge-base search → AI answer (or guided mode) → fields re-validated →
 *  output filter → when name + contact + need are known, the prospect goes "À qualifier" and the
 *  sales team is notified. The AI never creates a quote and never quotes a price.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connaissances: ConnaissancesService,
    private readonly dedup: ProspectDedupService,
    private readonly events: EventEmitter2,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
  ) {}

  // ── session ─────────────────────────────────────────────────────────────

  async start(companyId: number) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { nom: true } });
    if (!company) throw new NotFoundException('Entreprise introuvable');
    const token = randomBytes(32).toString('base64url');
    const accueil = `Bonjour ! Je suis l’assistant de ${company.nom}. Je peux répondre à vos questions sur nos services et transmettre votre projet à un conseiller pour un devis gratuit. Que puis-je faire pour vous ?`;
    const session = await this.prisma.chatSession.create({
      data: { companyId, tokenHash: sha256(token), messages: { create: { role: 'assistant', contenu: accueil } } },
    });
    // The token is returned ONCE: the widget keeps it for the duration of the conversation
    return { sessionId: session.id, token, entreprise: company.nom, message: accueil, suggestions: SUGGESTIONS_ACCUEIL, modeIA: !!this.llm };
  }

  async history(sessionId: number, token: string) {
    const s = await this.resolve(sessionId, token);
    const messages = await this.prisma.messageChat.findMany({
      where: { sessionId: s.id, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, contenu: true, createdAt: true },
    });
    return { messages, prospectEnregistre: s.statut !== 'NOUVEAU', champsManquants: missingFields(this.fields(s)) };
  }

  // ── conversation ────────────────────────────────────────────────────────

  async message(sessionId: number, token: string, contenu: string): Promise<ChatReply> {
    const s = await this.resolve(sessionId, token);
    const count = await this.prisma.messageChat.count({ where: { sessionId: s.id, role: 'user' } });
    await this.prisma.messageChat.create({ data: { sessionId: s.id, role: 'user', contenu } });

    if (s.statut === 'QUALIFIE' || s.statut === 'REJETE' || s.terminee) {
      return this.save(s, { ...(await this.contactReply(s.companyId)), reponse: 'Votre demande a bien été transmise à notre équipe. Pour toute autre question, contactez-nous directement.' });
    }
    if (count >= MAX_MESSAGES) {
      return this.save(s, { ...(await this.contactReply(s.companyId)), besoinHumain: true });
    }

    const [company, types, docs] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: s.companyId }, select: { nom: true, telephone: true, email: true } }),
      this.typesProjet(s.companyId),
      this.connaissances.search(s.companyId, contenu),
    ]);

    let modele: ReponseModele | null = null;
    if (this.llm) {
      try {
        const history = await this.prisma.messageChat.findMany({
          where: { sessionId: s.id, role: { in: ['user', 'assistant'] } },
          orderBy: { createdAt: 'desc' },
          take: HISTORY,
          select: { role: true, contenu: true },
        });
        const fields = this.fields(s);
        const messages: LlmMessage[] = [
          { role: 'system', content: buildSystemPrompt({ entreprise: company, typesProjet: types, connaissances: docs, champs: fields, manquants: missingFields(fields) }) },
          ...history.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.contenu })),
        ];
        modele = parseReponse(await this.llm.completeJson(messages, REPONSE_SCHEMA));
        if (!modele) await this.logError(s, 'LLM_REPONSE_INVALIDE', 'Réponse hors schéma');
      } catch (error) {
        const type = error instanceof LlmError ? error.type : 'LLM_INDISPONIBLE';
        await this.logError(s, type, error instanceof Error ? error.message : String(error));
      }
    }

    // Guided mode: no AI configured, or the AI failed (the visitor still gets an answer)
    const extracted = modele ? modele.champs : this.guidedExtract(s, contenu);
    const merged = mergeFields(this.fields(s), extracted, types);
    const manquants = missingFields(merged);
    let reponse = modele?.reponse ?? this.guidedReply(contenu, merged, docs);
    const besoinHumain = modele?.besoinHumain ?? /conseiller|humain|quelqu.un|urgent|fuite|appeler/i.test(contenu);

    // Last safety net (spec P4): a blocked answer is replaced and logged
    const check = checkSensitiveOutput(reponse);
    if (!check.safe) {
      await this.logError(s, 'REPONSE_BLOQUEE', check.reasons.join(', '));
      reponse = SAFE_PRICE_REPLY + (manquants.length ? ` ${this.askFor(manquants[0])}` : '');
    }

    // Prospect complete → sales team (once, even if two messages arrive together)
    const devientComplet = await this.applyFields(s, merged);
    if (devientComplet && !modele) {
      reponse = `Merci ${merged.prenom ?? merged.nom ?? ''} ! Votre demande est transmise : un conseiller vous recontacte rapidement pour préparer votre devis gratuit.`.replace(/\s+!/, ' !');
    }
    if (besoinHumain) {
      reponse += (await this.contactLine(s.companyId)) ?? '';
      // The team is alerted once per conversation, not at every message
      const extra = (s.besoinStructure ?? {}) as Record<string, unknown>;
      if (!extra.contactHumainNotifie) {
        await this.prisma.chatSession.update({ where: { id: s.id }, data: { besoinStructure: { ...extra, contactHumainNotifie: true } as Prisma.InputJsonValue } });
        this.events.emit(AssistantEvents.CONTACT_HUMAIN, { companyId: s.companyId, sessionId: s.id, nom: merged.nom ?? null, typeProjet: merged.typeProjet ?? null, doublon: false } satisfies ProspectEvent);
      }
    }

    return this.save(s, {
      reponse,
      suggestions: this.suggestions(manquants, devientComplet || s.statut !== 'NOUVEAU'),
      champsManquants: manquants,
      prospectEnregistre: devientComplet || s.statut !== 'NOUVEAU',
      besoinHumain,
    }, { intention: modele?.intention ?? 'guide', sources: docs.map((d) => d.id), mode: modele ? this.llm?.name : 'guide' });
  }

  /** Structured form "Demander un devis" (validated like any form). */
  async coordonnees(sessionId: number, token: string, dto: CoordonneesDto): Promise<ChatReply> {
    const s = await this.resolve(sessionId, token);
    const email = dto.email ? normalizeEmail(dto.email) : null;
    const telephone = dto.telephone ? normalizePhone(dto.telephone) : null;
    if (dto.telephone && !telephone) throw new BusinessException('TELEPHONE_INVALIDE', 'Numéro de téléphone invalide.');
    if (!email && !telephone) throw new BusinessException('CONTACT_REQUIS', 'Indiquez un email ou un numéro de téléphone.');
    const types = await this.typesProjet(s.companyId);
    const merged = mergeFields(this.fields(s), { ...dto, email, telephone }, types);
    // The form is authoritative for the description
    merged.description = dto.description;
    await this.prisma.messageChat.create({ data: { sessionId: s.id, role: 'user', contenu: '[Formulaire de demande de devis envoyé]', nlpResultat: { formulaire: true } } });

    await this.applyFields(s, merged);

    return this.save(s, {
      reponse: `Merci ${merged.prenom ?? merged.nom} ! Votre demande est bien enregistrée. Un conseiller vous recontacte rapidement pour préparer votre devis gratuit.`,
      suggestions: ['Voir les services', 'Délais d’intervention'],
      champsManquants: [],
      prospectEnregistre: true,
      besoinHumain: false,
    });
  }

  async feedback(sessionId: number, token: string, dto: FeedbackDto) {
    const s = await this.resolve(sessionId, token);
    await this.prisma.assistantFeedback.create({
      data: { companyId: s.companyId, sessionId: s.id, rating: dto.rating, messageExcerpt: dto.messageExcerpt?.slice(0, 500), commentaire: dto.commentaire },
    });
    return { message: 'Merci pour votre retour.' };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /**
   * Saves the fields. If they make the prospect complete, moves it NOUVEAU → A_QUALIFIER with a
   * conditional update (only one request can win), links duplicates, notifies the sales team.
   * Returns true when this call did the transition.
   */
  private async applyFields(s: Session, merged: ProspectFields): Promise<boolean> {
    const columns = { ...this.toColumns(merged), derniereActivite: new Date() };
    if (s.statut !== 'NOUVEAU' || !isComplete(merged)) {
      await this.prisma.chatSession.update({ where: { id: s.id }, data: columns });
      return false;
    }
    const [client, doublon] = await Promise.all([
      this.dedup.findClient(s.companyId, merged.email, merged.telephone),
      this.dedup.findSession(s.companyId, s.id, merged.email, merged.telephone),
    ]);
    const { count } = await this.prisma.chatSession.updateMany({
      where: { id: s.id, statut: 'NOUVEAU' },
      data: { ...columns, statut: 'A_QUALIFIER', clientId: client?.id ?? null, doublonDeId: doublon?.id ?? null },
    });
    if (!count) {
      await this.prisma.chatSession.update({ where: { id: s.id }, data: columns });
      return false;
    }
    this.emitProspect(s, merged, !!doublon);
    return true;
  }

  /** Same 404 for an unknown id and a wrong token: nothing to probe. */
  private async resolve(sessionId: number, token: string): Promise<Session> {
    if (!token || token.length > 100) throw new NotFoundException('Conversation introuvable');
    const s = await this.prisma.chatSession.findFirst({ where: { id: sessionId, tokenHash: sha256(token) } });
    if (!s) throw new NotFoundException('Conversation introuvable');
    if (Date.now() - s.createdAt.getTime() > 7 * 86_400_000) {
      throw new BusinessException('CONVERSATION_EXPIREE', 'Cette conversation est terminée. Commencez-en une nouvelle.', HttpStatus.GONE);
    }
    return s;
  }

  private fields(s: Session): ProspectFields {
    return {
      nom: s.clientNom,
      prenom: s.clientPrenom,
      email: s.clientEmail,
      telephone: s.clientTelephone,
      adresse: s.adresse,
      typeProjet: s.typeProjet,
      description: s.description,
      delai: s.delai,
    };
  }

  private toColumns(f: ProspectFields) {
    return {
      clientNom: f.nom ?? null,
      clientPrenom: f.prenom ?? null,
      clientEmail: f.email ?? null,
      clientTelephone: f.telephone ?? null,
      adresse: f.adresse ?? null,
      typeProjet: f.typeProjet ?? null,
      description: f.description ?? null,
      delai: f.delai ?? null,
    };
  }

  private async typesProjet(companyId: number) {
    const rows = await this.prisma.typeProjet.findMany({ where: { companyId, actif: true }, select: { nom: true }, orderBy: { nom: 'asc' } });
    return rows.map((r) => r.nom);
  }

  /** Guided mode: emails/phones anywhere; otherwise the message answers the field we asked for. */
  private guidedExtract(s: Session, contenu: string): Record<string, unknown> {
    const out: Record<string, unknown> = { ...extractContacts(contenu) };
    const fields = this.fields(s);
    const waiting = ASK_ORDER.find((f) => !fields[f] && (f !== 'email' || !fields.telephone) && (f !== 'telephone' || !fields.email));
    const isQuestion = /\?\s*$/.test(contenu) || /^(quel|quand|comment|combien|est-ce|pouvez|faites|vous)/i.test(contenu);
    const isQuickReply = SUGGESTIONS_ACCUEIL.includes(contenu);
    if (!isQuestion && !isQuickReply && !out.email && !out.telephone) {
      if (waiting === 'description' && contenu.length >= 10) out.description = contenu;
      else if (waiting === 'nom') out.nom = contenu.replace(/^(je m.appelle|je suis|moi c.est|nom\s*:)\s*/i, '');
      else if (waiting === 'adresse') out.adresse = contenu;
      else if (!fields.description && contenu.length >= 20) out.description = contenu;
    }
    return out;
  }

  private guidedReply(contenu: string, f: ProspectFields, docs: Connaissance[]): string {
    const manquants = missingFields(f);
    const next = manquants[0] ?? (!f.adresse ? 'adresse' : null);
    const ask = next ? ` ${this.askFor(next)}` : '';
    if (/services/i.test(contenu) && docs.length === 0) return `Nous réalisons des travaux de rénovation et de construction. Décrivez-moi votre projet et un conseiller vous répond rapidement.${ask}`;
    if (docs.length && (/\?/.test(contenu) || !SUGGESTIONS_ACCUEIL.includes(contenu) || /services|délais/i.test(contenu))) {
      const d = docs[0];
      const extrait = d.contenu.length > 450 ? `${d.contenu.slice(0, 450).replace(/\s+\S*$/, '')}…` : d.contenu;
      return `${extrait}${ask}`;
    }
    if (/devis/i.test(contenu)) return `Avec plaisir ! ${this.askFor(next ?? 'description')}`;
    return next ? `Merci !${ask}` : 'Merci, j’ai tout ce qu’il faut. Un conseiller vous recontacte rapidement.';
  }

  private askFor(field: string): string {
    const q: Record<string, string> = {
      description: 'Pouvez-vous me décrire votre projet (type de travaux, pièce, surface approximative) ?',
      nom: 'À quel nom dois-je enregistrer votre demande ?',
      telephone: 'Quel est le meilleur numéro (ou email) pour vous recontacter ?',
      email: 'Quelle est votre adresse email ?',
      adresse: 'Dans quelle ville se situe le chantier ?',
    };
    return q[field] ?? `Pouvez-vous me préciser ${FIELD_LABELS[field as keyof typeof FIELD_LABELS] ?? field} ?`;
  }

  private suggestions(manquants: string[], enregistre: boolean): string[] {
    if (enregistre) return ['Voir les services', 'Délais d’intervention', 'Parler à un conseiller'];
    if (manquants.length) return ['Demander un devis', 'Parler à un conseiller'];
    return SUGGESTIONS_ACCUEIL;
  }

  private async contactLine(companyId: number) {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { telephone: true, email: true } });
    const contact = [c?.telephone, c?.email].filter(Boolean).join(' ou ');
    return contact ? `\n\nVous pouvez aussi nous joindre directement : ${contact}.` : null;
  }

  private async contactReply(companyId: number): Promise<ChatReply> {
    return {
      reponse: `Un conseiller va prendre le relais.${(await this.contactLine(companyId)) ?? ''}`,
      suggestions: [],
      champsManquants: [],
      prospectEnregistre: true,
      besoinHumain: true,
    };
  }

  private async save(s: Session, reply: ChatReply, meta: Record<string, unknown> = {}): Promise<ChatReply> {
    await this.prisma.messageChat.create({
      data: { sessionId: s.id, role: 'assistant', contenu: reply.reponse, nlpResultat: { ...meta, besoinHumain: reply.besoinHumain } as Prisma.InputJsonValue },
    });
    return reply;
  }

  private emitProspect(s: Session, f: ProspectFields, doublon: boolean) {
    this.events.emit(AssistantEvents.PROSPECT_A_QUALIFIER, {
      companyId: s.companyId,
      sessionId: s.id,
      nom: [f.prenom, f.nom].filter(Boolean).join(' ') || null,
      typeProjet: f.typeProjet ?? null,
      doublon,
    } satisfies ProspectEvent);
  }

  /** Spec P4: AI errors are logged (never the key, never the prompt). */
  private async logError(s: Session, type: string, detail: string) {
    this.logger.warn(`Assistant session #${s.id} — ${type}: ${detail}`);
    await this.prisma.assistantErreur.create({ data: { companyId: s.companyId, sessionId: s.id, type, detail: detail.slice(0, 500) } }).catch(() => undefined);
  }
}
