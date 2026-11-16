import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException } from '../../../common';
import { CanalEnvoi, DevisStatut, ModeValidation, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { MailService } from '../../core/mail/mail.service';
import { pdfMontant } from '../../core/pdf/pdf-document';
import { FichiersService } from '../../core/storage/fichiers.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import {
  devisRelanceMail,
  devisSignatureMail,
  devisValidationMail,
} from '../../core/mail/templates/devis.templates';
import { type DevisEvent, DevisEvents } from './devis.events';
import { DevisHooks } from './devis-hooks';
import { type DevisRow, DevisService } from './devis.service';
import { DevisPdfService } from './devis-pdf.service';
import {
  assertTransition,
  AWAITING_CLIENT_STATUTS,
  SIGNATURE_PAPIER_STATUTS,
} from './devis-status';
import {
  AnnulerDevisDto,
  RefuserDevisInterneDto,
  RejeterSignaturePapierDto,
  ReviserDevisDto,
  SignaturePapierDto,
  SignerConseillerDto,
  SignerSurPlaceDto,
} from './dto/devis.dto';
import { DevisLiensService, type ResolvedLink } from './public/devis-liens.service';
import { promouvoirClient } from '../../referentiel/clients/client-statut';
import { lienWhatsapp, messageWhatsapp, numeroWhatsapp } from './whatsapp';

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
    private readonly fichiers: FichiersService,
    private readonly pdf: DevisPdfService,
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
      await this.transition(tx, devis, to, {
        dateEnvoi: new Date(),
        modeValidation: ModeValidation.EMAIL,
        codeVerification: nouveauCodeVerification(), // 16/11: printed as a QR code on the PDF
      });
      await promouvoirClient(tx, devis.clientId, 'QUALIFIE'); // 27/10
      const lien = await this.liens.create(tx, devis, 'VALIDATION', devis.client.email!);
      return { devis, lien };
    });

    const emailSent = await this.mail.send(
      devis.client.email!,
      devisValidationMail({ ...this.mailContext(devis), url: lien.url, expiresAt: lien.expiresAt }),
      await this.pdf.pieceJointe(devis.companyId, devis.id, devis.reference),
    );
    this.emit(DevisEvents.ENVOYE, devis, user.id);
    return { devis: await this.devis.findOne(user, id), lien, emailSent };
  }

  /** New validation link for a quote already sent (lost email, wrong address fixed…). */
  async renvoyerLien(user: AuthUser, id: number) {
    const { devis, lien } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
        throw new BusinessException(
          'DEVIS_NON_ENVOYE',
          'Le devis doit être envoyé et en attente de réponse.',
        );
      }
      if (!devis.client.email)
        throw new BusinessException('CLIENT_SANS_EMAIL', 'Le client n’a pas d’adresse email.');
      return { devis, lien: await this.liens.create(tx, devis, 'VALIDATION', devis.client.email) };
    });
    const emailSent = await this.mail.send(
      devis.client.email!,
      devisValidationMail({ ...this.mailContext(devis), url: lien.url, expiresAt: lien.expiresAt }),
      await this.pdf.pieceJointe(devis.companyId, devis.id, devis.reference),
    );
    return { lien, emailSent };
  }

  /**
   * Reminder of a quote still waiting for the client (C3 of 21/10): a NEW validation link
   * (the previous one is cancelled, so an expired first link is not a dead end) and a reminder
   * email. Used by the daily job (no user) and by « Relancer maintenant ».
   */
  async relancer(
    companyId: number,
    id: number,
    niveau: number,
  ): Promise<{ destinataire: string; emailSent: boolean }> {
    const { devis, lien } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(companyId, id, tx);
      if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
        throw new BusinessException(
          'DEVIS_NON_ENVOYE',
          'Seul un devis envoyé et en attente de réponse peut être relancé.',
        );
      }
      if (!devis.client.email)
        throw new BusinessException('CLIENT_SANS_EMAIL', 'Le client n’a pas d’adresse email.');
      return { devis, lien: await this.liens.create(tx, devis, 'VALIDATION', devis.client.email) };
    });
    const joursDepuisEnvoi = devis.dateEnvoi
      ? Math.max(0, Math.floor((Date.now() - devis.dateEnvoi.getTime()) / 86_400_000))
      : 0;
    const emailSent = await this.mail.send(
      devis.client.email!,
      devisRelanceMail({
        ...this.mailContext(devis),
        url: lien.url,
        expiresAt: lien.expiresAt,
        niveau,
        joursDepuisEnvoi,
      }),
    );
    return { destinataire: devis.client.email!, emailSent };
  }

  /** ENVOYE / RENVOYE / REFUSE → REVISE: new version number, every link already sent is cancelled. */
  async reviser(user: AuthUser, id: number, dto: ReviserDevisDto) {
    await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      assertTransition(devis.statut, 'REVISE');
      await this.snapshotVersion(tx, devis, user.id, dto.justification);
      await this.transition(tx, devis, 'REVISE', {
        versionCourante: { increment: 1 },
        motifRefus: null,
      });
      await this.liens.cancelAll(tx, id);
    });
    return this.devis.findOne(user, id);
  }

  async annuler(user: AuthUser, id: number, dto: AnnulerDevisDto) {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const notes = dto.motif
        ? `${devis.notes ? `${devis.notes}\n` : ''}Annulé : ${dto.motif}`
        : undefined;
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
        throw new BusinessException(
          'DEVIS_NON_ACCEPTE',
          'La signature en ligne se demande sur un devis accepté.',
        );
      }
      if (devis.signatureClientBase64)
        throw new BusinessException('DEJA_SIGNE', 'Le client a déjà signé ce devis.');
      if (!devis.client.email)
        throw new BusinessException('CLIENT_SANS_EMAIL', 'Le client n’a pas d’adresse email.');
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
      throw new BusinessException(
        'SIGNATURE_CONSEILLER_MANQUANTE',
        'Enregistrez d’abord votre signature dans votre profil.',
      );
    }

    const signed = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const now = new Date();
      const signature = {
        signatureConseillerBase64: conseiller.signatureBase64,
        signatureConseillerDate: now,
      };

      if (dto.verbal) {
        if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
          throw new BusinessException(
            'DEVIS_NON_ENVOYE',
            'Un accord verbal se constate sur un devis envoyé.',
          );
        }
        await this.finaliserSignature(tx, devis, {
          ...signature,
          modeValidation: ModeValidation.VERBAL,
        });
        return devis;
      }

      if (devis.statut !== 'ACCEPTE') {
        throw new BusinessException(
          'DEVIS_NON_ACCEPTE',
          'Le devis doit être accepté par le client (ou cochez « accord verbal »).',
        );
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
      message: signed
        ? 'Devis signé.'
        : 'Signature enregistrée — en attente de la signature du client.',
    };
  }

  // ── 05/11 (re-applied 16/11): hand delivery, WhatsApp, paper signature, team refusal ──

  /**
   * BROUILLON → ENVOYE (REVISE → RENVOYE) without email: the advisor handed the quote over
   * in person (printed, or shown on the phone). Same content checks as the email sending.
   */
  async remettre(user: AuthUser, id: number) {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const to: DevisStatut = devis.statut === 'REVISE' ? 'RENVOYE' : 'ENVOYE';
      assertTransition(devis.statut, to);
      await this.assertContenu(tx, devis);
      const now = new Date();
      await this.snapshotVersion(tx, devis, user.id, 'Remis en main propre');
      await this.transition(tx, devis, to, {
        dateEnvoi: now,
        remisLe: now,
        codeVerification: nouveauCodeVerification(),
      });
      await promouvoirClient(tx, devis.clientId, 'QUALIFIE');
      return devis;
    });
    this.emit(DevisEvents.ENVOYE, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /**
   * A validation link for WhatsApp: the API returns a wa.me link, the advisor opens it on his
   * phone (nothing leaves the server). The email link, if any, stays valid.
   */
  async lienWhatsapp(user: AuthUser, id: number) {
    const { devis, lien, numero } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (!AWAITING_CLIENT_STATUTS.includes(devis.statut)) {
        throw new BusinessException(
          'DEVIS_NON_ENVOYE',
          'Le devis doit être envoyé (ou remis) et en attente de réponse.',
        );
      }
      const numero = numeroWhatsapp(devis.client.telephone);
      if (!numero) {
        throw new BusinessException(
          'CLIENT_SANS_TELEPHONE',
          'Ajoutez un numéro de téléphone mobile valide au client.',
        );
      }
      const lien = await this.liens.create(tx, devis, 'VALIDATION', numero, CanalEnvoi.WHATSAPP);
      return { devis, lien, numero };
    });
    const ctx = this.mailContext(devis);
    const message = messageWhatsapp({
      clientNom: ctx.clientNom,
      reference: devis.reference,
      totalTTC: pdfMontant(devis.totalTTC),
      entreprise: ctx.entreprise,
      url: lien.url,
    });
    return {
      numero,
      message,
      lienWhatsapp: lienWhatsapp(numero, message),
      lien,
    };
  }

  /**
   * Scan / photo of the quote signed on paper → SIGNE_PAPIER, waiting for an ADMIN check.
   * A new upload replaces the previous scan (also after a rejection).
   */
  async deposerSignaturePapier(
    user: AuthUser,
    id: number,
    file: UploadedBinary | undefined,
    preuve: SignaturePapierDto = {},
  ) {
    // Checked BEFORE storing anything (a refused upload must not leave a file behind)
    const actuel = await this.devis.getForUpdate(user.companyId, id);
    if (actuel.statut !== 'SIGNE_PAPIER' && !SIGNATURE_PAPIER_STATUTS.includes(actuel.statut)) {
      throw new BusinessException(
        'DEVIS_NON_SIGNABLE',
        'La signature papier se dépose sur un devis envoyé, remis ou accepté.',
      );
    }
    const { devis, ancienFichierId } = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      const remplacement = devis.statut === 'SIGNE_PAPIER';
      if (!remplacement && !SIGNATURE_PAPIER_STATUTS.includes(devis.statut)) {
        throw new BusinessException(
          'DEVIS_NON_SIGNABLE',
          'La signature papier se dépose sur un devis envoyé, remis ou accepté.',
        );
      }
      // 16/11 (lot 1): proof kept with the scan — SHA-256 fingerprint, author, date, place
      const position =
        preuve.latitude !== undefined && preuve.longitude !== undefined
          ? { latitude: preuve.latitude, longitude: preuve.longitude }
          : null;
      const fichier = await this.fichiers.store(user.companyId, user.id, file, {}, tx, {
        position,
      });
      const data = {
        signaturePapierFichierId: fichier.id,
        signaturePapierLe: new Date(),
        signaturePapierParId: user.id,
        signaturePapierRejet: null,
      };
      if (remplacement) {
        const { count } = await tx.devis.updateMany({
          where: { id, statut: 'SIGNE_PAPIER' },
          data,
        });
        if (!count) throw this.concurrentChange();
      } else {
        await this.transition(tx, devis, 'SIGNE_PAPIER', data);
      }
      return { devis, ancienFichierId: devis.signaturePapierFichierId };
    });
    // After the commit: the old scan is no longer referenced
    if (ancienFichierId) await this.fichiers.remove(ancienFichierId).catch(() => undefined);
    this.emit(DevisEvents.SIGNE_PAPIER, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /** ADMIN: the scan is fine → SIGNE (job site, deposit invoice… exactly like an online signature). */
  async validerSignaturePapier(user: AuthUser, id: number) {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (devis.statut !== 'SIGNE_PAPIER' || !devis.signaturePapierFichierId) {
        throw new BusinessException(
          'SIGNATURE_PAPIER_ABSENTE',
          'Aucune signature papier en attente de vérification.',
        );
      }
      await this.finaliserSignature(tx, devis, {
        modeValidation: ModeValidation.PAPIER,
        signatureClientDate: devis.signaturePapierLe ?? new Date(),
      });
      return devis;
    });
    this.emit(DevisEvents.SIGNE, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /** ADMIN: the scan is not acceptable → back to the previous status, with the reason. */
  async rejeterSignaturePapier(user: AuthUser, id: number, dto: RejeterSignaturePapierDto) {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (devis.statut !== 'SIGNE_PAPIER') {
        throw new BusinessException(
          'SIGNATURE_PAPIER_ABSENTE',
          'Aucune signature papier en attente de vérification.',
        );
      }
      // ACCEPTE sets dateValidation; a revised quote (version > 1) was RENVOYE
      const retour: DevisStatut = devis.dateValidation
        ? 'ACCEPTE'
        : devis.versionCourante > 1
          ? 'RENVOYE'
          : 'ENVOYE';
      await this.transition(tx, devis, retour, { signaturePapierRejet: dto.motif });
      return devis;
    });
    this.emit(DevisEvents.SIGNATURE_PAPIER_REJETEE, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /** The client said no to the advisor (phone, in person): ENVOYE / RENVOYE → REFUSE. */
  async refuser(user: AuthUser, id: number, dto: RefuserDevisInterneDto) {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      await this.transition(tx, devis, 'REFUSE', { motifRefus: dto.motif });
      await this.liens.cancelAll(tx, id);
      return devis;
    });
    this.emit(DevisEvents.REFUSE, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /**
   * Mobile lot B1: the client signs on the advisor's phone. The advisor's profile signature is
   * added at the same time, so the quote is SIGNE at once (mode SUR_PLACE, with the signer's name
   * and, if the phone gave it, the place).
   */
  async signerSurPlace(user: AuthUser, id: number, dto: SignerSurPlaceDto) {
    const conseiller = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { signatureBase64: true },
    });
    if (!conseiller.signatureBase64) {
      throw new BusinessException(
        'SIGNATURE_CONSEILLER_MANQUANTE',
        'Enregistrez d’abord votre signature dans votre profil.',
      );
    }
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, id, tx);
      if (![...AWAITING_CLIENT_STATUTS, 'ACCEPTE'].includes(devis.statut)) {
        throw new BusinessException(
          'DEVIS_NON_SIGNABLE',
          'La signature sur place se fait sur un devis envoyé, remis ou accepté.',
        );
      }
      const now = new Date();
      await this.finaliserSignature(tx, devis, {
        modeValidation: ModeValidation.SUR_PLACE,
        signatureClientBase64: dto.signatureClientBase64,
        signatureClientDate: now,
        signataireNom: dto.nomSignataire,
        signatureLatitude: dto.latitude ?? null,
        signatureLongitude: dto.longitude ?? null,
        signatureConseillerBase64: conseiller.signatureBase64,
        signatureConseillerDate: now,
      });
      return devis;
    });
    this.emit(DevisEvents.SIGNE, devis, user.id);
    return this.devis.findOne(user, id);
  }

  /**
   * QR code scanned on a printed quote: is it a quote of this company, and is the paper the
   * CURRENT version? Never throws for a bad code: the answer says why.
   */
  async verifierQr(user: AuthUser, contenu: string) {
    const m = /^BATIFLOW:DEV:(\d{1,9}):(\d{1,4}):([A-Z0-9]{6,12})$/.exec(contenu.trim());
    if (!m)
      return {
        valide: false,
        motif: 'QR_INCONNU',
        message: 'Ce QR code n’est pas un devis BATIFLOW.',
      };
    const [, idTexte, versionTexte, code] = m;
    const devis = await this.prisma.devis.findFirst({
      where: { id: Number(idTexte), companyId: user.companyId },
      select: {
        id: true,
        reference: true,
        statut: true,
        versionCourante: true,
        codeVerification: true,
        totalTTC: true,
        dateEnvoi: true,
        client: { select: { id: true, nom: true, prenom: true } },
      },
    });
    if (!devis || !devis.codeVerification || devis.codeVerification !== code) {
      return {
        valide: false,
        motif: 'DEVIS_INCONNU',
        message: 'Devis introuvable ou code invalide.',
      };
    }
    const { codeVerification: _c, ...resume } = devis;
    const version = Number(versionTexte);
    if (version !== devis.versionCourante) {
      return {
        valide: false,
        motif: 'VERSION_PERIMEE',
        message: `Ce papier est la version ${version} ; la version en cours est la ${devis.versionCourante}.`,
        devis: resume,
      };
    }
    return {
      valide: true,
      motif: null,
      message: 'Devis authentique, version à jour.',
      devis: resume,
    };
  }

  // ── client actions (through a link) ─────────────────────────────────────

  async accepterParClient(link: ResolvedLink): Promise<void> {
    const devis = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(link.devis.companyId, link.devisId, tx);
      await this.transition(tx, devis, 'ACCEPTE', {
        dateValidation: new Date(),
        modeValidation: ModeValidation.EMAIL,
      });
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
      const { count } = await tx.devis.updateMany({
        where: { id: devis.id, statut: 'ACCEPTE' },
        data: signature,
      });
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
  private async finaliserSignature(
    tx: DbClient,
    devis: DevisRow,
    data: Prisma.DevisUpdateManyMutationInput,
  ) {
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
      throw new BusinessException(
        'CLIENT_SANS_EMAIL',
        'Ajoutez une adresse email au client avant l’envoi.',
      );
    }
    await this.assertContenu(db, devis);
  }

  /** Content checks shared by the email sending and the hand delivery (05/11). */
  private async assertContenu(db: DbClient, devis: DevisRow): Promise<void> {
    const lignes = await db.ligneDevis.count({ where: { devisId: devis.id } });
    if (lignes === 0)
      throw new BusinessException(
        'DEVIS_SANS_LIGNES',
        'Impossible d’envoyer un devis sans lignes.',
      );
    if (devis.totalHT.lte(0))
      throw new BusinessException('DEVIS_A_ZERO', 'Impossible d’envoyer un devis à 0 €.');
  }

  /** Records exactly what the client was sent (or what is being revised). Idempotent per version. */
  private async snapshotVersion(
    db: DbClient,
    devis: DevisRow,
    auteurId: number,
    justification: string,
  ) {
    const lignes = await db.ligneDevis.findMany({
      where: { devisId: devis.id },
      orderBy: { ordre: 'asc' },
    });
    const snapshot = {
      totalHT: devis.totalHT,
      totalTTC: devis.totalTTC,
      profit: devis.profit,
      margePourcent: devis.margePourcent,
      snapshotLignes: JSON.parse(JSON.stringify(lignes)) as Prisma.InputJsonValue,
    };
    await db.versionDevis.upsert({
      where: { devisId_numeroVersion: { devisId: devis.id, numeroVersion: devis.versionCourante } },
      create: {
        devisId: devis.id,
        numeroVersion: devis.versionCourante,
        auteurId,
        justification,
        ...snapshot,
      },
      update: { justification },
    });
  }

  private async markUsed(db: DbClient, linkId: number) {
    await db.devisLienClient.update({
      where: { id: linkId },
      data: { statut: 'UTILISE', usedAt: new Date() },
    });
  }

  private mailContext(devis: DevisRow) {
    return {
      clientNom: [devis.client.prenom, devis.client.nom].filter(Boolean).join(' '),
      reference: devis.reference,
      totalTTC: devis.totalTTC.toNumber(),
      entreprise: devis.company.nom,
      conseiller: devis.createur
        ? `${devis.createur.prenom} ${devis.createur.nom}`
        : 'Votre conseiller',
    };
  }

  private emit(
    event: string,
    devis: Pick<DevisRow, 'id' | 'companyId' | 'reference'>,
    userId: number | null,
  ) {
    this.events.emit(event, {
      companyId: devis.companyId,
      devisId: devis.id,
      reference: devis.reference,
      userId,
      at: new Date(),
    } satisfies DevisEvent);
  }
}

/** 6 characters without ambiguous ones (0/O, 1/I): readable if typed by hand. */
export function nouveauCodeVerification(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}
