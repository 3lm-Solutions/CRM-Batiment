import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { type AuthUser, BusinessException } from '../../../common';
import { type FactureType, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DevisLifecycleService } from '../../commercial/devis/devis-lifecycle.service';
import { AWAITING_CLIENT_STATUTS } from '../../commercial/devis/devis-status';
import { MailService } from '../../core/mail/mail.service';
import { factureRelanceMail } from '../../core/mail/templates/finance.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateRelancesReglagesDto } from './relances.dto';
import { RELANCE_ENVOYEE, type RelanceEnvoyeeEvent } from './relances.events';
import { joursDepuis, niveauDu } from './relance-rules';

const TYPE_LABEL: Record<FactureType, string> = {
  ACOMPTE: "Facture d'acompte",
  SITUATION: 'Situation de travaux',
  FINALE: 'Facture',
  AVOIR: 'Avoir',
};

const RELANCE_SELECT = { niveau: true, automatique: true, createdAt: true } as const;

export interface RunResult {
  devis: number;
  factures: number;
  erreurs: number;
}

/**
 * Automatic reminders (C3 of 21/10, CDC « relances automatiques »):
 *   - a quote sent with no answer (ENVOYE / RENVOYE): at J+7, then J+14 after sending
 *   - an unpaid invoice (ENVOYEE, not a credit note): at J+1, J+15, J+30 after its due date
 * Every morning at 8 (Paris), for each company that has them on. Delays are company settings.
 * Each reminder is recorded (table relances), audited and shown on the quote / invoice.
 */
@Injectable()
export class RelancesService {
  private readonly logger = new Logger(RelancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: DevisLifecycleService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  // ── daily job ───────────────────────────────────────────────────────────

  @Cron('0 8 * * *', { name: 'relances', timeZone: 'Europe/Paris' })
  async cron(): Promise<void> {
    const companies = await this.prisma.company.findMany({ where: { relancesActives: true }, select: { id: true } });
    for (const { id } of companies) {
      try {
        const r = await this.executer(id);
        if (r.devis + r.factures > 0) this.logger.log(`Entreprise #${id} : ${r.devis} devis et ${r.factures} facture(s) relancés`);
      } catch (error) {
        this.logger.error(`Relances de l’entreprise #${id} interrompues`, error instanceof Error ? error.stack : String(error));
      }
    }
  }

  /** One run for one company (the cron, or « Lancer les relances maintenant » in Paramètres). */
  async executer(companyId: number, now = new Date()): Promise<RunResult> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { relancesActives: true, relanceDevisJours: true, relanceFactureJours: true },
    });
    const result: RunResult = { devis: 0, factures: 0, erreurs: 0 };
    if (!company.relancesActives) return result;

    // Quotes waiting for the client
    const devis = await this.prisma.devis.findMany({
      where: {
        companyId,
        statut: { in: [...AWAITING_CLIENT_STATUTS] },
        dateEnvoi: { not: null },
        client: { email: { not: null }, archivedAt: null },
      },
      select: { id: true, reference: true, dateEnvoi: true, relances: { select: RELANCE_SELECT, orderBy: { createdAt: 'desc' } } },
    });
    for (const d of devis) {
      const niveau = niveauDu(
        joursDepuis(d.dateEnvoi!, now),
        company.relanceDevisJours,
        d.relances.filter((r) => r.automatique).map((r) => r.niveau),
        d.relances[0]?.createdAt ?? null,
        now,
      );
      if (!niveau) continue;
      try {
        await this.envoyerDevis(companyId, d.id, d.reference, niveau, null);
        result.devis++;
      } catch (error) {
        result.erreurs++;
        this.logger.warn(`Relance du devis ${d.reference} impossible : ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Unpaid invoices past their due date
    const factures = await this.prisma.facture.findMany({
      where: {
        companyId,
        statut: 'ENVOYEE',
        typeFacture: { not: 'AVOIR' },
        dateEcheance: { lt: now },
        emailClient: { not: null },
        devis: { client: { archivedAt: null } },
      },
      select: { id: true, dateEcheance: true, relances: { select: RELANCE_SELECT, orderBy: { createdAt: 'desc' } } },
    });
    for (const f of factures) {
      const niveau = niveauDu(
        joursDepuis(f.dateEcheance!, now),
        company.relanceFactureJours,
        f.relances.filter((r) => r.automatique).map((r) => r.niveau),
        f.relances[0]?.createdAt ?? null,
        now,
      );
      if (!niveau) continue;
      try {
        await this.envoyerFacture(companyId, f.id, niveau, null, now);
        result.factures++;
      } catch (error) {
        result.erreurs++;
        this.logger.warn(`Relance de la facture #${f.id} impossible : ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (result.devis + result.factures > 0) {
      await this.notifications.notifyRoles(companyId, [Role.ADMIN, Role.ASSISTANTE], {
        type: 'RELANCES_ENVOYEES',
        titre: 'Relances envoyées',
        message: [
          result.devis && `${result.devis} devis sans réponse`,
          result.factures && `${result.factures} facture(s) impayée(s)`,
        ]
          .filter(Boolean)
          .join(' et ') + ' relancé(s) par email.',
        lien: result.factures ? '/factures' : '/devis',
      });
    }
    return result;
  }

  // ── manual « Relancer maintenant » ──────────────────────────────────────

  async relancerDevis(user: AuthUser, id: number) {
    const devis = await this.prisma.devis.findFirst({ where: { id, companyId: user.companyId }, select: { id: true, reference: true } });
    if (!devis) throw new NotFoundException(`Devis #${id} introuvable`);
    return this.envoyerDevis(user.companyId, devis.id, devis.reference, 0, user.id);
  }

  async relancerFacture(user: AuthUser, id: number) {
    const facture = await this.prisma.facture.findFirst({ where: { id, companyId: user.companyId }, select: { id: true } });
    if (!facture) throw new NotFoundException(`Facture #${id} introuvable`);
    return this.envoyerFacture(user.companyId, facture.id, 0, user.id, new Date());
  }

  // ── reads and settings ──────────────────────────────────────────────────

  liste(user: AuthUser, q: { devisId?: number; factureId?: number }) {
    if (!q.devisId && !q.factureId) throw new BusinessException('FILTRE_REQUIS', 'Indiquez un devis ou une facture.');
    return this.prisma.relance.findMany({
      where: { companyId: user.companyId, devisId: q.devisId, factureId: q.factureId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        niveau: true,
        automatique: true,
        destinataire: true,
        emailEnvoye: true,
        createdAt: true,
        user: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  reglages(user: AuthUser) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { relancesActives: true, relanceDevisJours: true, relanceFactureJours: true },
    });
  }

  updateReglages(user: AuthUser, dto: UpdateRelancesReglagesDto) {
    const sorted = (v?: number[]) => (v ? [...new Set(v)].sort((a, b) => a - b) : undefined);
    return this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        relancesActives: dto.relancesActives,
        relanceDevisJours: sorted(dto.relanceDevisJours),
        relanceFactureJours: sorted(dto.relanceFactureJours),
      },
      select: { relancesActives: true, relanceDevisJours: true, relanceFactureJours: true },
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async envoyerDevis(companyId: number, devisId: number, reference: string, niveau: number, userId: number | null) {
    const { destinataire, emailSent } = await this.lifecycle.relancer(companyId, devisId, Math.max(niveau, 1));
    const relance = await this.prisma.relance.create({
      data: { companyId, type: 'DEVIS', devisId, niveau, automatique: niveau > 0, destinataire, emailEnvoye: emailSent, userId },
    });
    this.emit({ companyId, userId, type: 'DEVIS', entiteId: devisId, reference, niveau, automatique: niveau > 0, destinataire, emailEnvoye: emailSent });
    return relance;
  }

  private async envoyerFacture(companyId: number, factureId: number, niveau: number, userId: number | null, now: Date) {
    const f = await this.prisma.facture.findFirstOrThrow({ where: { id: factureId, companyId } });
    if (f.statut !== 'ENVOYEE' || f.typeFacture === 'AVOIR' || !f.reference) {
      throw new BusinessException('FACTURE_NON_RELANCABLE', 'Seule une facture émise et non payée peut être relancée.');
    }
    if (!f.emailClient) throw new BusinessException('CLIENT_SANS_EMAIL', 'Cette facture n’a pas d’email client.');

    const echeance = f.dateEcheance ?? f.dateEmission ?? now;
    const emailSent = await this.mail.send(
      f.emailClient,
      factureRelanceMail({
        clientNom: [f.prenomClient, f.nomClient].filter(Boolean).join(' '),
        entreprise: f.companyNom ?? '',
        entrepriseEmail: f.companyEmail,
        entrepriseTelephone: f.companyTelephone,
        reference: f.reference,
        type: TYPE_LABEL[f.typeFacture],
        montantTTC: f.montantTTC.toNumber(),
        dateEcheance: echeance,
        joursRetard: joursDepuis(echeance, now),
        niveau: Math.max(niveau, 1),
        communicationPaiement: f.communicationPaiement,
      }),
    );
    const relance = await this.prisma.relance.create({
      data: { companyId, type: 'FACTURE', factureId, niveau, automatique: niveau > 0, destinataire: f.emailClient, emailEnvoye: emailSent, userId },
    });
    this.emit({ companyId, userId, type: 'FACTURE', entiteId: factureId, reference: f.reference, niveau, automatique: niveau > 0, destinataire: f.emailClient, emailEnvoye: emailSent });
    return relance;
  }

  private emit(e: RelanceEnvoyeeEvent) {
    this.events.emit(RELANCE_ENVOYEE, e);
  }
}
