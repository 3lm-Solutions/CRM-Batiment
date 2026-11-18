import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate } from '../../../common';
import { type InstallationEtape, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FICHIER_SELECT, FichiersService } from '../../core/storage/fichiers.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { contenuQrPv, InstallationPvService, lireQrPv } from './installation-pv.service';
import { ETAPE_LABEL, ETAPES_PHOTOS, etapeSuivante, MISSIONS_FILTRE } from './installation-rules';
import type { QueryMissionsDto, SignalerDto } from './installations.dto';
import {
  INSTALLATION_INCLUDE,
  InstallationsService,
  SIGNALEMENT_LABEL,
} from './installations.service';

const MAX_PHOTOS = 10;
type Position = { latitude: number; longitude: number } | null;

const fr = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

/**
 * 18/11 (mobile lot B): the installer's side (« Mes missions »). The installer is a
 * sous-traitant with an account; he only sees the installations proposed to him, never a price.
 */
@Injectable()
export class InstallateurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly installations: InstallationsService,
    private readonly fichiers: FichiersService,
    private readonly pv: InstallationPvService,
  ) {}

  async liste(user: AuthUser, query: QueryMissionsDto) {
    const st = await this.moi(user);
    const where: Prisma.InstallationWhereInput = {
      companyId: user.companyId,
      sousTraitantId: st.id,
      ...(query.filtre && { etape: { in: MISSIONS_FILTRE[query.filtre] } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.installation.findMany({
        where,
        include: INSTALLATION_INCLUDE,
        orderBy: [{ dateConfirmee: 'asc' }, { dateSouhaitee: 'asc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.installation.count({ where }),
    ]);
    const items = await this.installations.avecAlertes(user.companyId, rows);
    return paginate(
      items.map((i) => this.vue(i)),
      total,
      query,
    );
  }

  async detail(user: AuthUser, id: number) {
    const st = await this.moi(user);
    const row = await this.prisma.installation.findFirst({
      where: { id, companyId: user.companyId, sousTraitantId: st.id },
      include: {
        ...INSTALLATION_INCLUDE,
        evenements: {
          // another installer's refusal (name, reason) is not his business
          where: { type: { not: 'REFUSEE' } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, type: true, message: true, createdAt: true },
        },
        signalements: {
          orderBy: { createdAt: 'desc' },
          include: {
            photos: { select: FICHIER_SELECT },
            savTicket: { select: { reference: true, statut: true } },
          },
        },
        photos: { select: { ...FICHIER_SELECT, installationEtape: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException(`Mission #${id} introuvable`);
    const [avec] = await this.installations.avecAlertes(user.companyId, [row]);
    return this.vue(avec);
  }

  // ── réponse à la mission ────────────────────────────────────────────────

  async accepter(user: AuthUser, id: number) {
    const i = await this.mienne(user, id);
    await this.installations.agir(user, id, ['INSTALLATEUR_PROPOSE'], {
      etape: 'MISSION_ACCEPTEE',
      type: 'ACCEPTEE',
      message: `${i.sousTraitant?.nom ?? 'L’installateur'} a accepté la mission.`,
      pour: 'BUREAU',
      installateurUserId: user.id,
    });
    return this.detail(user, id);
  }

  /** Back to « Devis signé »: the office proposes another installer (the mission leaves my list). */
  async refuser(user: AuthUser, id: number, motif: string) {
    const i = await this.mienne(user, id);
    await this.installations.agir(user, id, ['INSTALLATEUR_PROPOSE'], {
      etape: 'DEVIS_SIGNE',
      data: { sousTraitantId: null, dateProposee: null, dateConfirmee: null },
      where: { sousTraitantId: i.sousTraitantId },
      type: 'REFUSEE',
      message: `${i.sousTraitant?.nom ?? 'L’installateur'} a refusé la mission : ${motif}`,
      pour: 'BUREAU',
      installateurUserId: user.id,
      alerte: true,
    });
    return { id, etape: 'DEVIS_SIGNE' as const };
  }

  // ── dates ───────────────────────────────────────────────────────────────

  /** The installer takes the date wished by the office: confirmed, delivery step. */
  async confirmerDate(user: AuthUser, id: number) {
    const i = await this.mienne(user, id);
    if (!i.dateSouhaitee) {
      throw new BusinessException(
        'PAS_DE_DATE_SOUHAITEE',
        'Le bureau n’a pas indiqué de date : proposez-en une.',
      );
    }
    await this.installations.agir(user, id, ['MISSION_ACCEPTEE', 'LIVRAISON'], {
      etape: 'LIVRAISON',
      data: { dateConfirmee: i.dateSouhaitee, dateProposee: null },
      type: 'DATE_CONFIRMEE',
      message: `Date d’installation confirmée par l’installateur : ${fr(i.dateSouhaitee)}.`,
      pour: 'BUREAU',
      installateurUserId: user.id,
    });
    return this.detail(user, id);
  }

  /** Another date: waits for the office (POST /installations/:id/dates/accepter). */
  async proposerDate(user: AuthUser, id: number, date: Date) {
    await this.mienne(user, id);
    await this.installations.agir(user, id, ['MISSION_ACCEPTEE', 'LIVRAISON'], {
      data: { dateProposee: date },
      type: 'DATE_PROPOSEE',
      message: `L’installateur propose le ${fr(date)}.`,
      pour: 'BUREAU',
      installateurUserId: user.id,
    });
    return this.detail(user, id);
  }

  // ── avancement ──────────────────────────────────────────────────────────

  async ajouterPhotos(
    user: AuthUser,
    id: number,
    etape: InstallationEtape,
    photos: UploadedBinary[] | undefined,
    position: Position,
  ) {
    if (!ETAPES_PHOTOS.includes(etape)) {
      throw new BusinessException(
        'ETAPE_INVALIDE',
        'Photos possibles pour : Livraison, Pose, Finitions.',
      );
    }
    const i = await this.mienne(user, id);
    if (i.etape !== etape) {
      throw new BusinessException(
        'ETAPE_INVALIDE',
        `La mission est à l’étape « ${ETAPE_LABEL[i.etape]} » : photos de cette étape seulement.`,
      );
    }
    if (!photos?.length) throw new BusinessException('FICHIER_MANQUANT', 'Aucune photo reçue.');
    if (photos.length > MAX_PHOTOS) {
      throw new BusinessException('TROP_DE_PHOTOS', `${MAX_PHOTOS} photos au maximum par envoi.`);
    }
    const crees = [];
    for (const photo of photos) {
      crees.push(
        await this.fichiers.create(
          user,
          photo,
          { installationId: id, installationEtape: etape },
          undefined,
          { imagesOnly: true, position },
        ),
      );
    }
    return crees;
  }

  /** LIVRAISON → POSE → FINITIONS, with at least one photo of the step being left. */
  async avancer(user: AuthUser, id: number, vers: 'POSE' | 'FINITIONS') {
    const i = await this.mienne(user, id);
    if (etapeSuivante(i.etape) !== vers) {
      throw new BusinessException(
        'ETAPE_INVALIDE',
        `Depuis « ${ETAPE_LABEL[i.etape]} », impossible de passer à « ${ETAPE_LABEL[vers]} ».`,
      );
    }
    const photos = await this.prisma.fichier.count({
      where: { installationId: id, installationEtape: i.etape },
    });
    if (!photos) {
      throw new BusinessException(
        'PHOTO_ETAPE_MANQUANTE',
        `Ajoutez au moins une photo de l’étape « ${ETAPE_LABEL[i.etape]} » avant de continuer.`,
      );
    }
    await this.installations.agir(user, id, [i.etape], {
      etape: vers,
      type: 'ETAPE',
      message: `Étape « ${ETAPE_LABEL[vers]} » commencée.`,
      pour: 'BUREAU',
      installateurUserId: user.id,
    });
    return this.detail(user, id);
  }

  // ── problèmes ───────────────────────────────────────────────────────────

  async signaler(
    user: AuthUser,
    id: number,
    dto: SignalerDto,
    photos: UploadedBinary[] | undefined,
  ) {
    const i = await this.mienne(user, id);
    if (!['MISSION_ACCEPTEE', 'LIVRAISON', 'POSE', 'FINITIONS', 'TERMINEE'].includes(i.etape)) {
      throw new BusinessException('ETAPE_INVALIDE', 'Acceptez d’abord la mission.');
    }
    if ((photos?.length ?? 0) > MAX_PHOTOS) {
      throw new BusinessException('TROP_DE_PHOTOS', `${MAX_PHOTOS} photos au maximum.`);
    }
    const message = `${SIGNALEMENT_LABEL[dto.type]} signalé(e) : ${dto.description}${dto.savDemande ? ' (SAV demandé)' : ''}`;
    const signalement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.signalement.create({
        data: {
          installationId: id,
          type: dto.type,
          description: dto.description,
          savDemande: dto.savDemande ?? false,
          auteurId: user.id,
        },
      });
      await tx.installationEvenement.create({
        data: { installationId: id, type: 'SIGNALEMENT', message, userId: user.id },
      });
      return created;
    });
    // photos after the report exists; a refused file removes the report so it can be sent again
    try {
      for (const photo of photos ?? []) {
        await this.fichiers.create(user, photo, { signalementId: signalement.id }, undefined, {
          imagesOnly: true,
        });
      }
    } catch (error) {
      await this.supprimerSignalement(signalement.id);
      throw error;
    }
    this.installations.emettre(user, i, 'SIGNALEMENT', message, 'BUREAU', true);
    return this.prisma.signalement.findUniqueOrThrow({
      where: { id: signalement.id },
      include: { photos: { select: FICHIER_SELECT } },
    });
  }

  // ── PV de fin de travaux ────────────────────────────────────────────────

  async pdfPv(user: AuthUser, id: number): Promise<Buffer> {
    const i = await this.mienne(user, id);
    if (!['FINITIONS', 'TERMINEE', 'CLOTUREE'].includes(i.etape)) {
      throw new BusinessException('ETAPE_INVALIDE', 'Le PV s’imprime à l’étape « Finitions ».');
    }
    return this.pv.generer(user.companyId, id);
  }

  /** QR read on a printed PV: is it the PV of one of MY missions? Never throws for a bad code. */
  async verifierQr(user: AuthUser, contenu: string) {
    const lu = lireQrPv(contenu);
    if (!lu)
      return {
        valide: false,
        motif: 'QR_INCONNU',
        message: 'Ce QR code n’est pas un PV BATIFLOW.',
      };
    const st = await this.moi(user);
    const i = await this.prisma.installation.findFirst({
      where: { id: lu.id, companyId: user.companyId, sousTraitantId: st.id },
      select: {
        id: true,
        reference: true,
        etape: true,
        codePv: true,
        chantier: { select: { reference: true, adresse: true } },
      },
    });
    if (!i || i.codePv !== lu.code) {
      return { valide: false, motif: 'PV_INCONNU', message: 'PV introuvable ou code invalide.' };
    }
    const { codePv: _c, ...installation } = i;
    return { valide: true, motif: null, message: 'PV authentique.', installation };
  }

  /**
   * Scan of the signed PV. With the right QR → TERMINEE at once (office told). Without a readable
   * QR → kept « à vérifier », the office validates or refuses it. Proofs (SHA-256, author, date,
   * position) are kept with the file.
   */
  async envoyerPv(
    user: AuthUser,
    id: number,
    file: UploadedBinary | undefined,
    qrContenu: string | null | undefined,
    position: Position,
  ) {
    const i = await this.mienne(user, id);
    if (i.etape !== 'FINITIONS') {
      throw new BusinessException('ETAPE_INVALIDE', 'Le PV s’envoie à l’étape « Finitions ».');
    }
    if (i.pvAVerifier) {
      throw new BusinessException('PV_EN_ATTENTE', 'Un PV attend déjà la vérification du bureau.');
    }
    if (qrContenu && qrContenu.trim() !== contenuQrPv(i)) {
      throw new BusinessException(
        'PV_QR_INVALIDE',
        'Ce QR code ne correspond pas au PV de cette mission.',
      );
    }
    const fichier = await this.fichiers.create(user, file, {}, undefined, { position });
    try {
      if (qrContenu) {
        await this.installations.agir(user, id, ['FINITIONS'], {
          etape: 'TERMINEE',
          data: { pvFichierId: fichier.id, pvSigneLe: new Date(), pvAVerifier: false },
          type: 'PV_SIGNE',
          message: 'PV signé scanné (QR vérifié) : installation terminée.',
          pour: 'BUREAU',
          installateurUserId: user.id,
        });
      } else {
        await this.installations.agir(user, id, ['FINITIONS'], {
          data: { pvFichierId: fichier.id, pvAVerifier: true },
          type: 'PV_A_VERIFIER',
          message: 'PV signé envoyé sans QR lisible : à vérifier par le bureau.',
          pour: 'BUREAU',
          installateurUserId: user.id,
          alerte: true,
        });
      }
    } catch (error) {
      await this.fichiers.remove(fichier.id);
      throw error;
    }
    return this.detail(user, id);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** The sous-traitant record of this account (an installer). */
  private async moi(user: AuthUser) {
    const st = await this.prisma.sousTraitant.findFirst({
      where: { userId: user.id, companyId: user.companyId },
      select: { id: true, nom: true },
    });
    if (!st) throw new NotFoundException('Aucune fiche installateur pour ce compte.');
    return st;
  }

  /** One of MY missions (404 otherwise: never confirm someone else's mission exists). */
  private async mienne(user: AuthUser, id: number) {
    const st = await this.moi(user);
    const i = await this.prisma.installation.findFirst({
      where: { id, companyId: user.companyId, sousTraitantId: st.id },
      include: { sousTraitant: { select: { id: true, nom: true, userId: true } } },
    });
    if (!i) throw new NotFoundException(`Mission #${id} introuvable`);
    return i;
  }

  private async supprimerSignalement(id: number) {
    const photos = await this.prisma.fichier.findMany({
      where: { signalementId: id },
      select: { id: true },
    });
    for (const p of photos) await this.fichiers.remove(p.id);
    await this.prisma.signalement.delete({ where: { id } });
  }

  /** What the installer sees: no code of the PV, no note mark, dates and works without price. */
  private vue<T extends { codePv: string; devis: { lignes: unknown[] } | null }>(i: T) {
    const { codePv: _c, ...rest } = i;
    return rest;
  }
}
