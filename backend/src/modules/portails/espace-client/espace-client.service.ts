import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { type AuthUser, BusinessException } from '../../../common';
import type { Env } from '../../../config/env.validation';
import { DevisStatut, FactureStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DEVIS_CLIENT_SELECT } from '../../commercial/devis/devis.views';
import { MailService } from '../../core/mail/mail.service';
import { espaceClientMail } from '../../core/mail/templates/portails.templates';
import { chantierProgress } from '../../execution/chantiers/tache-rules';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { SavService } from '../../pilotage/sav/sav.service';
import { RetoursClientService } from '../../pilotage/retours-client/retours-client.service';
import type { CreateRetourClientDto } from '../../pilotage/retours-client/retours-client.dto';
import { FichiersService } from '../../core/storage/fichiers.service';
import { eligibiliteSav } from '../../pilotage/sav/sav-rules';
import { CHANTIERS_RETOURS } from '../../pilotage/retours-client/retours-rules';
import { completerQrFacture, FACTURE_CLIENT_SELECT } from '../../finance/factures/facture.views';
import { CreateSavClientDto } from './espace-client.dto';

const VALIDITY_DAYS = 90;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** What the client may see: quotes once sent, invoices once issued. Never drafts, costs or margins. */
const DEVIS_VISIBLES: DevisStatut[] = ['ENVOYE', 'RENVOYE', 'ACCEPTE', 'SIGNE', 'REFUSE', 'REVISE'];
const FACTURES_VISIBLES: FactureStatut[] = ['ENVOYEE', 'PAYEE', 'ANNULEE'];

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
    private readonly retours: RetoursClientService,
    private readonly fichiers: FichiersService,
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
    return this.buildView(await this.resolve(token));
  }

  // ── office preview (E1 of 20/10): the team sees exactly what the client sees ──

  /** The client's space as he sees it, without a link (read only, nothing is recorded as a visit). */
  async apercu(user: AuthUser, clientId: number) {
    const espace = await this.resolveForStaff(user, clientId);
    const actif = await this.prisma.clientEspaceLien.findFirst({
      where: { clientId, companyId: user.companyId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { expiresAt: true },
    });
    return { ...(await this.buildView({ ...espace, expiresAt: actif?.expiresAt ?? null })), apercu: true };
  }

  async apercuDevis(user: AuthUser, clientId: number, id: number) {
    return this.findDevis(await this.resolveForStaff(user, clientId), id);
  }

  async apercuFacture(user: AuthUser, clientId: number, id: number) {
    return this.findFacture(await this.resolveForStaff(user, clientId), id);
  }

  private async resolveForStaff(user: AuthUser, clientId: number): Promise<ResolvedEspace> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, companyId: user.companyId }, select: { id: true } });
    if (!client) throw new NotFoundException(`Client #${clientId} introuvable`);
    return { id: 0, companyId: user.companyId, clientId };
  }

  private async buildView(lien: ResolvedEspace & { expiresAt: Date | null }) {
    const { companyId, clientId } = lien;
    const [company, client, devis, factures, chantiers, tickets, photos, retours] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { nom: true, email: true, telephone: true, adresse: true, logo: true, savDureeMois: true } }),
      this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { typeClient: true, nom: true, prenom: true, contactNom: true } }),
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
          updatedAt: true,
          chefChantier: { select: { prenom: true, nom: true, telephone: true } },
          taches: {
            orderBy: { ordre: 'asc' },
            select: {
              id: true,
              libelle: true,
              statut: true,
              avancement: true,
              dateDebut: true,
              dateFin: true,
              // Étape 5 (26/10): the client follows the sub-tasks too
              checklist: { orderBy: [{ ordre: 'asc' }, { id: 'asc' }], select: { id: true, libelle: true, fait: true } },
            },
          },
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
          dateResolution: true,
          chantier: { select: { reference: true } },
          // The client's own messages and the team's REPLIES to him; internal notes stay internal
          notes: {
            where: { OR: [{ userId: null }, { visibleClient: true }] },
            orderBy: { createdAt: 'asc' },
            select: { id: true, contenu: true, createdAt: true, userId: true, user: { select: { prenom: true } } },
          },
          // Status timeline (G of 20/10)
          historique: { orderBy: { createdAt: 'asc' }, select: { statut: true, createdAt: true } },
          // Photos (C42 of 21/10): his own and the team's, streamed through his token
          photos: { orderBy: { createdAt: 'asc' }, select: { id: true, nom: true, uploadedById: true } },
        },
      }),
      // Étape 5 (26/10): before / after photos VALIDATED by the chef — never the pending or hidden ones,
      // never who took them
      this.prisma.photoAvancement.findMany({
        where: { companyId, statut: 'VALIDEE', chantier: { clientId, statut: { not: 'ANNULE' } } },
        orderBy: [{ date: 'desc' }, { id: 'asc' }],
        take: 400,
        select: { id: true, chantierId: true, tacheId: true, checklistItemId: true, date: true, moment: true, commentaire: true },
      }),
      this.retours.pourClient(companyId, clientId),
    ]);
    const { savDureeMois, ...entreprise } = company;
    return {
      entreprise,
      client,
      expiresAt: lien.expiresAt,
      devis,
      factures,
      chantiers: chantiers.map(({ updatedAt, ...c }) => {
        // Étape 2 (26/10): the SAV opens at the end of the works, for the company's period
        const e = eligibiliteSav({ statut: c.statut, dateFin: c.dateFin, updatedAt }, savDureeMois);
        return {
          ...c,
          avancement: chantierProgress(c.taches),
          sav: { possible: e.possible, jusquau: e.jusquau, motif: e.message },
          photos: photos.filter((p) => p.chantierId === c.id).map(({ chantierId: _c, ...p }) => p),
          retours: retours.filter((r) => r.chantierId === c.id).map(({ chantierId: _c, ...r }) => r),
          // Comments and alerts: during the works and right after (a closed job site → SAV)
          retoursPossibles: CHANTIERS_RETOURS.includes(c.statut),
        };
      }),
      sav: tickets.map(({ notes, historique, photos, ...t }) => ({
        ...t,
        photos: photos.map((p) => ({ id: p.id, nom: p.nom, auteur: p.uploadedById === null ? ('CLIENT' as const) : ('EQUIPE' as const) })),
        messages: notes.map((n) => ({
          id: n.id,
          contenu: n.contenu,
          createdAt: n.createdAt,
          // Who wrote it, without exposing the team member's account
          auteur: n.userId === null ? ('CLIENT' as const) : ('EQUIPE' as const),
          auteurPrenom: n.user?.prenom ?? null,
        })),
        // Tickets opened before the timeline existed: at least « opened » on their creation date
        historique: historique.length ? historique : [{ statut: 'OUVERT' as const, createdAt: t.createdAt }],
      })),
    };
  }

  async devis(token: string, id: number) {
    return this.findDevis(await this.resolve(token), id);
  }

  async facture(token: string, id: number) {
    return this.findFacture(await this.resolve(token), id);
  }

  private async findDevis({ companyId, clientId }: ResolvedEspace, id: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id, companyId, clientId, statut: { in: DEVIS_VISIBLES } },
      select: DEVIS_CLIENT_SELECT,
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    return devis;
  }

  private async findFacture({ companyId, clientId }: ResolvedEspace, id: number) {
    const facture = await this.prisma.facture.findFirst({
      where: { id, companyId, devis: { clientId }, statut: { in: FACTURES_VISIBLES }, reference: { not: null } },
      select: FACTURE_CLIENT_SELECT,
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    // QR codes of 21/10 on invoices issued before
    if (await completerQrFacture(this.prisma, { ...facture, companyId })) {
      return this.prisma.facture.findUniqueOrThrow({ where: { id }, select: FACTURE_CLIENT_SELECT });
    }
    return facture;
  }

  async photo(token: string, fichierId: number) {
    const { companyId, clientId } = await this.resolve(token);
    return this.sav.photoClient(companyId, clientId, fichierId);
  }

  async apercuPhoto(user: AuthUser, clientId: number, fichierId: number) {
    const { companyId } = await this.resolveForStaff(user, clientId);
    return this.sav.photoClient(companyId, clientId, fichierId);
  }

  async ouvrirSav(token: string, dto: CreateSavClientDto, photos: UploadedBinary[] = []) {
    const { companyId, clientId } = await this.resolve(token);
    const ticket = await this.sav.createFromClient(companyId, clientId, dto, photos);
    return { reference: ticket.reference, message: `Votre demande ${ticket.reference} a bien été transmise. Nous revenons vers vous rapidement.` };
  }

  // ── progress photos, comments and alerts (Étapes 5–6 of 26/10) ────────────

  /** A validated before / after photo of one of the client's job sites. */
  async photoAvancement(token: string, photoId: number) {
    const { companyId, clientId } = await this.resolve(token);
    return this.streamPhotoAvancement(companyId, clientId, photoId);
  }

  async apercuPhotoAvancement(user: AuthUser, clientId: number, photoId: number) {
    const { companyId } = await this.resolveForStaff(user, clientId);
    return this.streamPhotoAvancement(companyId, clientId, photoId);
  }

  private async streamPhotoAvancement(companyId: number, clientId: number, photoId: number) {
    const photo = await this.prisma.photoAvancement.findFirst({
      where: { id: photoId, companyId, statut: 'VALIDEE', chantier: { clientId } },
      select: { fichier: { select: { cle: true, mime: true, nom: true } } },
    });
    if (!photo) throw new NotFoundException('Photo introuvable');
    return this.fichiers.stream(photo.fichier);
  }

  async envoyerRetour(token: string, dto: CreateRetourClientDto) {
    const { companyId, clientId } = await this.resolve(token);
    const retour = await this.retours.creerParClient(companyId, clientId, dto);
    return {
      id: retour.id,
      message: retour.type === 'ALERTE'
        ? 'Votre signalement a été transmis à votre chef de chantier. Nous revenons vers vous rapidement.'
        : 'Merci, votre commentaire a été transmis à l’équipe.',
    };
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
