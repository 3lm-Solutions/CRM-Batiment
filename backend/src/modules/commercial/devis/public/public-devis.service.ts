import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DevisLifecycleService } from '../devis-lifecycle.service';
import { AWAITING_CLIENT_STATUTS } from '../devis-status';
import { DEVIS_CLIENT_SELECT } from '../devis.views';
import { ACTIVE_LINK_STATUTS, DevisLiensService, type ResolvedLink, SIGNATURE_WINDOW_MINUTES } from './devis-liens.service';

/**
 * What a client can do with the link received by email. No account, no login:
 * the 256-bit token IS the credential, and the signature additionally needs a one-time code.
 * Responses only ever contain DEVIS_CLIENT_SELECT (no costs, margins or suppliers).
 */
@Injectable()
export class PublicDevisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liens: DevisLiensService,
    private readonly lifecycle: DevisLifecycleService,
  ) {}

  async view(token: string) {
    const link = await this.liens.resolve(token);
    const devis = await this.prisma.devis.findUniqueOrThrow({
      where: { id: link.devisId },
      select: DEVIS_CLIENT_SELECT,
    });
    return { lien: this.publicState(link), devis };
  }

  async accepter(token: string) {
    const link = await this.liens.resolve(token);
    this.liens.assertActive(link, 'VALIDATION');
    await this.lifecycle.accepterParClient(link);
    return { message: 'Merci ! Votre acceptation a bien été enregistrée. Votre conseiller vous recontacte pour la signature.' };
  }

  async refuser(token: string, motif?: string) {
    const link = await this.liens.resolve(token);
    this.liens.assertActive(link, 'VALIDATION');
    await this.lifecycle.refuserParClient(link, motif);
    return { message: 'Votre réponse a bien été enregistrée. Votre conseiller pourra vous proposer une nouvelle version.' };
  }

  async demanderCode(token: string) {
    const link = await this.liens.resolve(token);
    this.liens.assertActive(link, 'SIGNATURE');
    return this.liens.sendOtp(link);
  }

  async verifierCode(token: string, code: string) {
    const link = await this.liens.resolve(token);
    this.liens.assertActive(link, 'SIGNATURE');
    await this.liens.verifyOtp(link, code);
    return { message: `Code validé. Vous avez ${SIGNATURE_WINDOW_MINUTES} minutes pour signer.` };
  }

  async signer(token: string, signatureBase64: string) {
    const link = await this.liens.resolve(token);
    this.liens.assertActive(link, 'SIGNATURE');
    this.liens.assertCanSign(link);
    const complete = await this.lifecycle.enregistrerSignatureClient(link, signatureBase64);
    return {
      message: complete
        ? 'Merci ! Le devis est signé. Vous recevrez prochainement la facture d’acompte.'
        : 'Merci ! Votre signature est enregistrée. Votre conseiller va finaliser le dossier.',
    };
  }

  /** What the client page should display / allow. */
  private publicState(link: ResolvedLink) {
    const outdated = link.versionDevis !== link.devis.versionCourante;
    const active = ACTIVE_LINK_STATUTS.includes(link.statut) && !outdated;
    return {
      type: link.type,
      // A link for an older version shows as cancelled, whatever its stored state
      statut: ACTIVE_LINK_STATUTS.includes(link.statut) && outdated ? 'ANNULE' : link.statut,
      expiresAt: link.expiresAt,
      peutRepondre: active && link.type === 'VALIDATION' && AWAITING_CLIENT_STATUTS.includes(link.devis.statut),
      peutDemanderCode: active && link.type === 'SIGNATURE' && link.devis.statut === 'ACCEPTE',
      peutSigner:
        active &&
        link.type === 'SIGNATURE' &&
        link.statut === 'OTP_VERIFIE' &&
        link.otpVerifiedAt !== null &&
        Date.now() - link.otpVerifiedAt.getTime() < SIGNATURE_WINDOW_MINUTES * 60_000,
    };
  }
}
