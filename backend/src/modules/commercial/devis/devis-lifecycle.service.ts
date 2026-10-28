import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException } from '../../../common';
import { DevisStatut, ModeValidation, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { MailService } from '../../core/mail/mail.service';
import { devisRelanceMail, devisSignatureMail, devisValidationMail } from '../../core/mail/templates/devis.templates';
import { type DevisEvent, DevisEvents } from './devis.events';
import { DevisHooks } from './devis-hooks';
import { type DevisRow, DevisService } from './devis.service';
import { assertTransition, AWAITING_CLIENT_STATUTS } from './devis-status';
import { AnnulerDevisDto, ReviserDevisDto, SignerConseillerDto } from './dto/devis.dto';
import { DevisLiensService, type ResolvedLink } from './public/devis-liens.service';
import { promouvoirClient } from '../../referentiel/clients/client-statut';

/**
 * Every quote status change goes through this service (internal actions AND client links).
 *
 * Race safety: a transition is a CONDITIONAL update (`WHERE id = ? AND statut = <read>`).
 * If two requests act on the same quote at once (double click, client + advisor), the second
 * one finds 0 rows, gets a 409 and its transaction rolls back — nothing is done twice.
 */
@Injectable()
export class DevisLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devis: DevisService,
    private readonly liens: DevisLiensService,
    private readonly mail: MailService,
    private readonly events: EventEmitter2,
    private readonly hooks: DevisHooks,
  ) {}

  // ── advisor actions ─────────────────────────────────────────────────────

  /** BROUILLON → ENVOYE (or REVISE → RENVOYE): snapshot the version, email the validation link. */
  async envoyer(user: AuthUser, id: number) {
    const { devis, lien } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const to: DevisStatut = devis.statut === 'REVISE' ? 'RENVOYE' : 'ENVOYE';
      assertTransition(devis.statut, to);
      await this.assertSendable(tx, devis);

      await this.snapshotVersion(tx, devis, user.id, 'Envoi au client');
      await this.transition(tx, devis, to, { dateEnvoi: new Date(), modeValidation: ModeValidation.EMAIL });
      await promouvoirClient(tx, devis.clientId, 'QUALIFIE'); // 27/10
      const lien = await this.liens.create(tx, devis, 'VALIDATION', devis.client.email!);
      return { devis, lien };
    });

    const emailSent = await this.mail.send(
      devis.client.email!,
      devisValidationMail({ ...this.mailContext(devis), url: lien.url, expiresAt: lien.expiresAt }),
    );
    this.emit(DevisEvents.ENVOYE, devis, user.id);
    return { devis: await this.devis.findOne(user, id), lien, emailSent };
  }

  /** New validation link for a quote already sent (lost email, wrong address fixed…). */
  async renvoyerLien(user: AuthUser, id: number) {
    const { devis, lien } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
        throw new BusinessException('DEVIS_NON_ENVOYE', 'Le devis doit être envoyé et en attente de réponse.');
      }
      if (!devis.client.email) throw new BusinessException('CLIENT_SANS_EMAIL', 'Le client n’a pas d’adresse email.');
      return { devis, lien: await this.liens.create(tx, devis, 'VALIDATION', devis.client.email) };
    });
    const emailSent = await this.mail.send(
      devis.client.email!,
      devisValidationMail({ ...this.mailContext(devis), url: lien.url, expiresAt: lien.expiresAt }),
    );
    return { lien, emailSent };
  }

  /**
   * Reminder of a quote still waiting for the client (C3 of 21/10): a NEW validation link
   * (the previous one is cancelled, so an expired first link is not a dead end) and a reminder
   * email. Used by the daily job (no user) and by « Relancer maintenant ».
   */
  async relancer(companyId: number, id: number, niveau: number): Promise<{ destinataire: string; emailSent: boolean }> {
    const { devis, lien } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(companyId, id, tx);
      if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
        throw new BusinessException('DEVIS_NON_ENVOYE', 'Seul un devis envoyé et en attente de réponse peut être relancé.');
      }
      if (!devis.client.email) throw new BusinessException('CLIENT_SANS_EMAIL', 'Le client n’a pas d’adresse email.');
      return { devis, lien: await this.liens.create(tx, devis, 'VALIDATION', devis.client.email) };
    });
    const joursDepuisEnvoi = devis.dateEnvoi ? Math.max(0, Math.floor((Date.now() - devis.dateEnvoi.getTime()) / 86_400_000)) : 0;
    const emailSent = await this.mail.send(
      devis.client.email!,
      devisRelanceMail({ ...this.mailContext(devis), url: lien.url, expiresAt: lien.expiresAt, niveau, joursDepuisEnvoi }),
    );
    return { destinataire: devis.client.email!, emailSent };
  }

  /** ENVOYE / RENVOYE / REFUSE → REVISE: new version number, every link already sent is cancelled. */
  async reviser(user: AuthUser, id: number, dto: ReviserDevisDto) {
    await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      assertTransition(devis.statut, 'REVISE');
      await this.snapshotVersion(tx, devis, user.id, dto.justification);
      await this.transition(tx, devis, 'REVISE', { versionCourante: { increment: 1 }, motifRefus: null });
      await this.liens.cancelAll(tx, id);
    });
    return this.devis.findOne(user, id);
  }

  async annuler(user: AuthUser, id: number, dto: AnnulerDevisDto) {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const notes = dto.motif ? `${devis.notes ? `${devis.notes}\n` : ''}Annulé : ${dto.motif}` : undefined;
      await this.transition(tx, devis, 'ANNULE', { notes });
      await this.liens.cancelAll(tx, id);
      return devis;
    });
    this.emit(DevisEvents.ANNULE, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /** ACCEPTE: email the client a signature link (protected by a one-time code). */
  async demanderSignature(user: AuthUser, id: number) {
    const { devis, lien } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (devis.statut !== 'ACCEPTE') {
        throw new BusinessException('DEVIS_NON_ACCEPTE', 'La signature en ligne se demande sur un devis accepté.');
      }
      if (devis.signatureClientBase64) throw new BusinessException('DEJA_SIGNE', 'Le client a déjà signé ce devis.');
      if (!devis.client.email) throw new BusinessException('CLIENT_SANS_EMAIL', 'Le client n’a pas d’adresse email.');
      await tx.devis.update({ where: { id }, data: { modeValidation: ModeValidation.SIGNATURE } });
      return { devis, lien: await this.liens.create(tx, devis, 'SIGNATURE', devis.client.email) };
    });

    const emailSent = await this.mail.send(
      devis.client.email!,
      devisSignatureMail({ ...this.mailContext(devis), url: lien.url, expiresAt: lien.expiresAt }),
    );
    return { lien, emailSent };
  }

  /**
   * The advisor signs with the signature saved in his profile.
   *  - verbal: the client agreed by phone/in person → ENVOYE/RENVOYE → SIGNE directly
   *  - otherwise (ACCEPTE): stored; the quote becomes SIGNE once BOTH signatures exist,
   *    whichever comes first (the old code forced the client to sign first)
   */
  async signerConseiller(user: AuthUser, id: number, dto: SignerConseillerDto) {
    const conseiller = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { signatureBase64: true },
    });
    if (!conseiller.signatureBase64) {
      throw new BusinessException('SIGNATURE_CONSEILLER_MANQUANTE', 'Enregistrez d’abord votre signature dans votre profil.');
    }

    const signed = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const now = new Date();
      const signature = { signatureConseillerBase64: conseiller.signatureBase64, signatureConseillerDate: now };

      if (dto.verbal) {
        if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
          throw new BusinessException('DEVIS_NON_ENVOYE', 'Un accord verbal se constate sur un devis envoyé.');
        }
        await this.finaliserSignature(tx, devis, { ...signature, modeValidation: ModeValidation.VERBAL });
        return devis;
      }

      if (devis.statut !== 'ACCEPTE') {
        throw new BusinessException('DEVIS_NON_ACCEPTE', 'Le devis doit être accepté par le client (ou cochez « accord verbal »).');
      }
      if (devis.signatureClientBase64) {
        await this.finaliserSignature(tx, devis, signature);
        return devis;
      }
      await tx.devis.update({ where: { id }, data: signature });
      return null;
    });

    if (signed) this.emit(DevisEvents.SIGNE, signed, user.id);
    return {
      devis: await this.devis.findOne(user, id),
      message: signed ? 'Devis signé.' : 'Signature enregistrée — en attente de la signature du client.',
    };
  }

  // ── client actions (through a link) ─────────────────────────────────────

  async accepterParClient(link: ResolvedLink): Promise<void> {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(link.devis.companyId, link.devisId, tx);
      await this.transition(tx, devis, 'ACCEPTE', { dateValidation: new Date(), modeValidation: ModeValidation.EMAIL });
      await this.markUsed(tx, link.id);
      await this.hooks.runAccepted(tx, devis); // P0.4: supplier orders, same transaction
      return devis;
    });
    this.emit(DevisEvents.ACCEPTE, devis, null);
  }

  async refuserParClient(link: ResolvedLink, motif?: string): Promise<void> {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(link.devis.companyId, link.devisId, tx);
      await this.transition(tx, devis, 'REFUSE', { motifRefus: motif ?? null });
      await this.markUsed(tx, link.id);
      return devis;
    });
    this.emit(DevisEvents.REFUSE, devis, null);
  }

  /** Returns true when the quote became SIGNE (the advisor had already signed). */
  async enregistrerSignatureClient(link: ResolvedLink, signatureBase64: string): Promise<boolean> {
    const signed = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(link.devis.companyId, link.devisId, tx);
      if (devis.statut !== 'ACCEPTE') {
        throw new BusinessException('DEVIS_NON_ACCEPTE', 'Ce devis ne peut plus être signé.');
      }
      const signature = { signatureClientBase64: signatureBase64, signatureClientDate: new Date() };
      await this.markUsed(tx, link.id);

      if (devis.signatureConseillerBase64) {
        await this.finaliserSignature(tx, devis, signature);
        return devis;
      }
      // Conditional on the status too: a concurrent cancellation wins
      const { count } = await tx.devis.updateMany({ where: { id: devis.id, statut: 'ACCEPTE' }, data: signature });
      if (!count) throw this.concurrentChange();
      return null;
    });

    if (signed) this.emit(DevisEvents.SIGNE, signed, null);
    return signed !== null;
  }

  // ── internals ───────────────────────────────────────────────────────────

  /**
   * The ONE place where a quote becomes SIGNE. The workflow hooks (job site P0.2, deposit
   * invoice P0.3, and supplier orders when the quote skipped ACCEPTE — verbal agreement)
   * run in the SAME transaction: if one fails, the quote is not signed either.
   * A second concurrent signature fails on the conditional update BEFORE reaching the hooks,
   * so nothing can be created twice.
   */
  private async finaliserSignature(tx: DbClient, devis: DevisRow, data: Prisma.DevisUpdateManyMutationInput) {
    await this.transition(tx, devis, 'SIGNE', { ...data, dateValidation: new Date() });
    // 27/10: the first signed quote turns the prospect into a client
    await promouvoirClient(tx, devis.clientId, 'CLIENT');
    await this.liens.cancelAll(tx, devis.id);
    await this.hooks.runSigned(tx, devis);
  }

  private async transition(
    db: DbClient,
    devis: Pick<DevisRow, 'id' | 'statut'>,
    to: DevisStatut,
    data: Prisma.DevisUpdateManyMutationInput = {},
  ): Promise<void> {
    assertTransition(devis.statut, to);
    const { count } = await db.devis.updateMany({
      where: { id: devis.id, statut: devis.statut },
      data: { ...data, statut: to },
    });
    if (count === 0) throw this.concurrentChange();
  }

  private concurrentChange() {
    return new BusinessException(
      'DEVIS_MODIFIE_ENTRE_TEMPS',
      'Le devis vient de changer de statut. Rechargez la page.',
      HttpStatus.CONFLICT,
    );
  }

  /** P0.6: no lines, or a quote worth 0 € (the old placeholder line passed this check), cannot be sent. */
  private async assertSendable(db: DbClient, devis: DevisRow): Promise<void> {
    if (!devis.client.email) {
      throw new BusinessException('CLIENT_SANS_EMAIL', 'Ajoutez une adresse email au client avant l’envoi.');
    }
    const lignes = await db.ligneDevis.count({ where: { devisId: devis.id } });
    if (lignes === 0) throw new BusinessException('DEVIS_SANS_LIGNES', 'Impossible d’envoyer un devis sans lignes.');
    if (devis.totalHT.lte(0)) throw new BusinessException('DEVIS_A_ZERO', 'Impossible d’envoyer un devis à 0 €.');
  }

  /** Records exactly what the client was sent (or what is being revised). Idempotent per version. */
  private async snapshotVersion(db: DbClient, devis: DevisRow, auteurId: number, justification: string) {
    const lignes = await db.ligneDevis.findMany({ where: { devisId: devis.id }, orderBy: { ordre: 'asc' } });
    const snapshot = {
      totalHT: devis.totalHT,
      totalTTC: devis.totalTTC,
      profit: devis.profit,
      margePourcent: devis.margePourcent,
      snapshotLignes: JSON.parse(JSON.stringify(lignes)) as Prisma.InputJsonValue,
    };
    await db.versionDevis.upsert({
      where: { devisId_numeroVersion: { devisId: devis.id, numeroVersion: devis.versionCourante } },
      create: { devisId: devis.id, numeroVersion: devis.versionCourante, auteurId, justification, ...snapshot },
      update: { justification },
    });
  }

  private async markUsed(db: DbClient, linkId: number) {
    await db.devisLienClient.update({ where: { id: linkId }, data: { statut: 'UTILISE', usedAt: new Date() } });
  }

  private mailContext(devis: DevisRow) {
    return {
      clientNom: [devis.client.prenom, devis.client.nom].filter(Boolean).join(' '),
      reference: devis.reference,
      totalTTC: devis.totalTTC.toNumber(),
      entreprise: devis.company.nom,
      conseiller: devis.createur ? `${devis.createur.prenom} ${devis.createur.nom}` : 'Votre conseiller',
    };
  }

  private emit(event: string, devis: Pick<DevisRow, 'id' | 'companyId' | 'reference'>, userId: number | null) {
    this.events.emit(event, {
      companyId: devis.companyId,
      devisId: devis.id,
      reference: devis.reference,
      userId,
      at: new Date(),
    } satisfies DevisEvent);
  }
}
