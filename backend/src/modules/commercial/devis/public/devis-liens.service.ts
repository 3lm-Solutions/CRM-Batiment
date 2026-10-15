import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { BusinessException } from '../../../../common';
import type { Env } from '../../../../config/env.validation';
import { CanalEnvoi, DevisLienStatut, DevisLienType } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from '../../../../prisma/prisma.types';
import { OTP_SENDERS, type OtpSender } from './otp-sender';

const VALIDITY_DAYS: Record<DevisLienType, number> = { VALIDATION: 30, SIGNATURE: 7 };
export const OTP_VALIDITY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** After entering the right code, the client has this long to draw the signature. */
export const SIGNATURE_WINDOW_MINUTES = 15;

export const ACTIVE_LINK_STATUTS: DevisLienStatut[] = ['ACTIF', 'OTP_ENVOYE', 'OTP_VERIFIE'];

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export type ResolvedLink = Awaited<ReturnType<DevisLiensService['resolve']>>;

/**
 * Secure links sent to clients, and the one-time code that protects the signature.
 * Tokens are 256-bit random values; only their SHA-256 hash is stored.
 */
@Injectable()
export class DevisLiensService {
  private readonly senders: Map<CanalEnvoi, OtpSender>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(OTP_SENDERS) senders: OtpSender[],
  ) {
    this.senders = new Map(senders.map((s) => [s.canal, s]));
  }

  /** Creates a link (cancelling the previous active one of the same type). Returns the clear token ONCE. */
  async create(
    db: DbClient,
    devis: { id: number; versionCourante: number },
    type: DevisLienType,
    destinataire: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    await db.devisLienClient.updateMany({
      where: { devisId: devis.id, type, statut: { in: ACTIVE_LINK_STATUTS } },
      data: { statut: 'ANNULE' },
    });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + VALIDITY_DAYS[type] * 86_400_000);
    await db.devisLienClient.create({
      data: {
        devisId: devis.id,
        type,
        tokenHash: sha256(token),
        versionDevis: devis.versionCourante,
        canal: CanalEnvoi.EMAIL,
        destinataire,
        expiresAt,
      },
    });

    const base = this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    return { url: `${base}/devis/lien/${token}`, expiresAt };
  }

  /** Revising or cancelling a quote invalidates every link already sent. */
  async cancelAll(db: DbClient, devisId: number): Promise<void> {
    await db.devisLienClient.updateMany({
      where: { devisId, statut: { in: ACTIVE_LINK_STATUTS } },
      data: { statut: 'ANNULE' },
    });
  }

  async resolve(token: string, db: DbClient = this.prisma) {
    const link = await db.devisLienClient.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        devis: {
          select: {
            id: true,
            companyId: true,
            reference: true,
            statut: true,
            versionCourante: true,
            totalTTC: true,
            signatureClientBase64: true,
            signatureConseillerBase64: true,
          },
        },
      },
    });
    if (!link) throw new NotFoundException('Lien invalide.');

    if (ACTIVE_LINK_STATUTS.includes(link.statut) && link.expiresAt < new Date()) {
      await db.devisLienClient.update({ where: { id: link.id }, data: { statut: 'EXPIRE' } });
      link.statut = 'EXPIRE';
    }
    return link;
  }

  assertActive(link: ResolvedLink, type: DevisLienType): void {
    if (link.type !== type) throw new BusinessException('LIEN_INVALIDE', 'Ce lien ne permet pas cette action.');
    const messages: Partial<Record<DevisLienStatut, string>> = {
      EXPIRE: 'Ce lien a expiré. Contactez votre conseiller pour en recevoir un nouveau.',
      ANNULE: 'Ce devis a été modifié ou annulé : ce lien n’est plus valable.',
      UTILISE: 'Ce lien a déjà été utilisé.',
      BLOQUE: 'Trop de codes erronés : ce lien est bloqué. Contactez votre conseiller.',
    };
    const message = messages[link.statut];
    if (message) throw new BusinessException(`LIEN_${link.statut}`, message, HttpStatus.GONE);
    if (link.versionDevis !== link.devis.versionCourante) {
      throw new BusinessException('LIEN_ANNULE', messages.ANNULE!, HttpStatus.GONE);
    }
  }

  // ── one-time code ───────────────────────────────────────────────────────

  async sendOtp(link: ResolvedLink): Promise<{ envoyeA: string; expiresAt: Date }> {
    if (link.otpSentAt && Date.now() - link.otpSentAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new BusinessException(
        'CODE_DEJA_ENVOYE',
        `Un code vient d'être envoyé. Patientez ${OTP_RESEND_COOLDOWN_SECONDS} secondes avant d'en redemander un.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60_000);
    await this.prisma.devisLienClient.update({
      where: { id: link.id },
      data: {
        otpCodeHash: sha256(code),
        otpExpiresAt: expiresAt,
        otpSentAt: new Date(),
        otpVerifiedAt: null,
        statut: 'OTP_ENVOYE',
      },
    });

    const sender = this.senders.get(link.canal);
    const sent = await sender?.send(link.destinataire, code, {
      reference: link.devis.reference,
      validityMinutes: OTP_VALIDITY_MINUTES,
    });
    if (!sent) throw new BusinessException('ENVOI_CODE_IMPOSSIBLE', "Le code n'a pas pu être envoyé. Réessayez plus tard.");

    return { envoyeA: maskEmail(link.destinataire), expiresAt };
  }

  async verifyOtp(link: ResolvedLink, code: string): Promise<void> {
    if (link.statut !== 'OTP_ENVOYE' || !link.otpCodeHash || !link.otpExpiresAt) {
      throw new BusinessException('CODE_NON_DEMANDE', "Demandez d'abord un code.");
    }
    if (link.otpExpiresAt < new Date()) {
      throw new BusinessException('CODE_EXPIRE', 'Ce code a expiré, demandez-en un nouveau.');
    }

    const expected = Buffer.from(link.otpCodeHash, 'hex');
    const given = Buffer.from(sha256(code), 'hex');
    if (!timingSafeEqual(expected, given)) {
      const attempts = link.otpAttempts + 1;
      const blocked = attempts >= OTP_MAX_ATTEMPTS;
      await this.prisma.devisLienClient.update({
        where: { id: link.id },
        data: { otpAttempts: attempts, ...(blocked && { statut: 'BLOQUE' }) },
      });
      throw new BusinessException(
        blocked ? 'LIEN_BLOQUE' : 'CODE_INVALIDE',
        blocked
          ? 'Trop de codes erronés : ce lien est bloqué. Contactez votre conseiller.'
          : `Code incorrect. ${OTP_MAX_ATTEMPTS - attempts} essai(s) restant(s).`,
      );
    }

    await this.prisma.devisLienClient.update({
      where: { id: link.id },
      data: { statut: 'OTP_VERIFIE', otpVerifiedAt: new Date(), otpAttempts: 0, otpCodeHash: null },
    });
  }

  /** The signature must follow a successful code check, within the signing window. */
  assertCanSign(link: ResolvedLink): void {
    const windowOk =
      link.statut === 'OTP_VERIFIE' &&
      link.otpVerifiedAt !== null &&
      Date.now() - link.otpVerifiedAt.getTime() < SIGNATURE_WINDOW_MINUTES * 60_000;
    if (!windowOk) {
      throw new BusinessException('CODE_REQUIS', 'Confirmez votre identité avec le code reçu avant de signer.');
    }
  }
}

/** jean.dupont@mail.fr -> j*********t@mail.fr */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain || name.length < 3) return email;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name.at(-1)}@${domain}`;
}
