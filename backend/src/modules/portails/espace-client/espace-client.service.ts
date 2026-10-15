import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { type AuthUser, BusinessException } from '../../../common';
import type { Env } from '../../../config/env.validation';
import { DevisStatut, FactureStatut, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DEVIS_CLIENT_SELECT } from '../../commercial/devis/devis.views';
import { MailService } from '../../core/mail/mail.service';
import { espaceClientMail } from '../../core/mail/templates/portails.templates';
import { chantierProgress } from '../../execution/chantiers/tache-rules';
import { SavService } from '../../pilotage/sav/sav.service';
import { CreateSavClientDto } from './espace-client.dto';

const VALIDITY_DAYS = 90;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** What the client may see: quotes once sent, invoices once issued. Never drafts, costs or margins. */
const DEVIS_VISIBLES: DevisStatut[] = ['ENVOYE', 'RENVOYE', 'ACCEPTE', 'SIGNE', 'REFUSE', 'REVISE'];
const FACTURES_VISIBLES: FactureStatut[] = ['ENVOYEE', 'PAYEE', 'ANNULEE'];

/** Snapshot fields of an issued invoice (legal content) — same as what the PDF would show. */
const FACTURE_CLIENT_SELECT = {
  id: true,
  reference: true,
  typeFacture: true,
  statut: true,
  numeroSituation: true,
  avancementCumule: true,
  date: true,
  dateEmission: true,
  dateEcheance: true,
  datePaiement: true,
  tauxTVA: true,
  montantHT: true,
  montantTVA: true,
  montantTTC: true,
  acomptePercent: true,
  referenceDevis: true,
  nomClient: true,
  prenomClient: true,
  emailClient: true,
  adresseClient: true,
  companyNom: true,
  companyEmail: true,
  companyTelephone: true,
  companyAdresse: true,
  companySiret: true,
  conditionsPaiement: true,
  communicationPaiement: true,
  notesLegales: true,
  factureOrigine: { select: { reference: true } },
  lignes: { orderBy: { ordre: 'asc' }, select: { id: true, description: true, quantite: true, unite: true, prixUnitaireHT: true, montantHT: true } },
} satisfies Prisma.FactureSelect;

type ResolvedEspace = { id: number; companyId: number; clientId: number };

/**
 * "Espace client": like the quote links of the old app, the client has NO account. The office
 * emails him a personal link (256-bit token, only its hash stored, 90 days, revocable).
 * Through it he reads his quotes, invoices and job-site progress, and opens after-sales tickets.
 */
@Injectable()
export class EspaceClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    private readonly sav: SavService,
  ) {}

  // ── office side ─────────────────────────────────────────────────────────

  /** New link emailed to the client; previous links stop working. */
  async envoyerLien(user: AuthUser, clientId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: user.companyId },
      select: { id: true, nom: true, prenom: true, email: true, archivedAt: true, company: { select: { nom: true } } },
    });
    if (!client) throw new NotFoundException(`Client #${clientId} introuvable`);
    if (!client.email) throw new BusinessException('CLIENT_SANS_EMAIL', 'Ajoutez un email au client avant de lui ouvrir son espace.');
    if (client.archivedAt) throw new BusinessException('CLIENT_ARCHIVE', 'Ce client est archivé.');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + VALIDITY_DAYS * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.clientEspaceLien.updateMany({ where: { clientId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.clientEspaceLien.create({
        data: { companyId: user.companyId, clientId, tokenHash: sha256(token), destinataire: client.email, expiresAt, createdById: user.id },
      }),
    ]);

    const url = `${this.config.get('APP_URL', { infer: true }).replace(/\/$/, '')}/espace-client/${token}`;
    const emailSent = await this.mail.send(
      client.email,
      espaceClientMail({ clientNom: [client.prenom, client.nom].filter(Boolean).join(' '), entreprise: client.company.nom, url, expiresAt }),
    );
    // The URL is returned once, so the office can also give it by phone / SMS
    return { url, expiresAt, emailSent, destinataire: client.email };
  }

  liens(user: AuthUser, clientId: number) {
    return this.prisma.clientEspaceLien.findMany({
      where: { clientId, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, destinataire: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true, createdBy: { select: { nom: true, prenom: true } } },
    });
  }

  async revoquer(user: AuthUser, clientId: number) {
    const { count } = await this.prisma.clientEspaceLien.updateMany({
      where: { clientId, companyId: user.companyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: count };
  }

  // ── client side (public, the token is the credential) ───────────────────

  async view(token: string) {
    const lien = await this.resolve(token);
    const { companyId, clientId } = lien;
    const [company, client, devis, factures, chantiers, tickets] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { nom: true, email: true, telephone: true, adresse: true, logo: true } }),
      this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { nom: true, prenom: true } }),
      this.prisma.devis.findMany({
        where: { clientId, companyId, statut: { in: DEVIS_VISIBLES } },
        orderBy: { dateCreation: 'desc' },
        select: { id: true, reference: true, statut: true, versionCourante: true, dateEnvoi: true, totalTTC: true },
      }),
      this.prisma.facture.findMany({
        where: { companyId, devis: { clientId }, statut: { in: FACTURES_VISIBLES }, reference: { not: null } },
        orderBy: { dateEmission: 'desc' },
        select: { id: true, reference: true, typeFacture: true, statut: true, dateEmission: true, dateEcheance: true, montantTTC: true },
      }),
      this.prisma.chantier.findMany({
        where: { clientId, companyId, statut: { not: 'ANNULE' } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          adresse: true,
          statut: true,
          dateDebut: true,
          dateFin: true,
          chefChantier: { select: { prenom: true, nom: true, telephone: true } },
          taches: { orderBy: { ordre: 'asc' }, select: { id: true, libelle: true, statut: true, avancement: true, dateDebut: true, dateFin: true } },
        },
      }),
      this.prisma.savTicket.findMany({
        where: { clientId, companyId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          reference: true,
          titre: true,
          statut: true,
          createdAt: true,
          chantier: { select: { reference: true } },
          // Only the client's own messages: the team's follow-up notes are internal
          notes: { where: { userId: null }, orderBy: { createdAt: 'asc' }, select: { id: true, contenu: true, createdAt: true } },
        },
      }),
    ]);
    return {
      entreprise: company,
      client,
      expiresAt: lien.expiresAt,
      devis,
      factures,
      chantiers: chantiers.map((c) => ({ ...c, avancement: chantierProgress(c.taches) })),
      sav: tickets.map(({ notes, ...t }) => ({ ...t, messages: notes })),
    };
  }

  async devis(token: string, id: number) {
    const { companyId, clientId } = await this.resolve(token);
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId, clientId, statut: { in: DEVIS_VISIBLES } },
      select: DEVIS_CLIENT_SELECT,
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    return devis;
  }

  async facture(token: string, id: number) {
    const { companyId, clientId } = await this.resolve(token);
    const facture = await this.prisma.facture.findFirst({
      where: { id, companyId, devis: { clientId }, statut: { in: FACTURES_VISIBLES }, reference: { not: null } },
      select: FACTURE_CLIENT_SELECT,
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    return facture;
  }

  async ouvrirSav(token: string, dto: CreateSavClientDto) {
    const { companyId, clientId } = await this.resolve(token);
    const ticket = await this.sav.createFromClient(companyId, clientId, dto);
    return { reference: ticket.reference, message: `Votre demande ${ticket.reference} a bien été transmise. Nous revenons vers vous rapidement.` };
  }

  async repondreSav(token: string, ticketId: number, contenu: string) {
    const { companyId, clientId } = await this.resolve(token);
    await this.sav.addClientNote(companyId, clientId, ticketId, contenu);
    return { message: 'Message envoyé.' };
  }

  /** Same answer for unknown, revoked and expired links: nothing to probe. */
  private async resolve(token: string): Promise<ResolvedEspace & { expiresAt: Date }> {
    if (!token || token.length > 100) throw this.invalid();
    const lien = await this.prisma.clientEspaceLien.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, companyId: true, clientId: true, expiresAt: true, revokedAt: true, lastUsedAt: true, client: { select: { archivedAt: true } } },
    });
    if (!lien || lien.revokedAt || lien.expiresAt < new Date() || lien.client.archivedAt) throw this.invalid();
    // Write at most every 5 minutes, not on every page view
    if (!lien.lastUsedAt || Date.now() - lien.lastUsedAt.getTime() > 5 * 60_000) {
      await this.prisma.clientEspaceLien.update({ where: { id: lien.id }, data: { lastUsedAt: new Date() } });
    }
    return lien;
  }

  private invalid() {
    return new BusinessException('LIEN_INVALIDE', 'Ce lien n’est plus valide. Demandez-en un nouveau à votre interlocuteur.', HttpStatus.GONE);
  }
}
