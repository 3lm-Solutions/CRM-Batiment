import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FichiersService } from '../../core/storage/fichiers.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import { NotificationsService } from '../../pilotage/notifications/notifications.service';
import { bornesMois } from '../pointages/pointage-rules';
import { EnvoyerPhotosDto, MasquerPhotosDto, QueryMesPhotosDto, QueryPhotosChantierDto } from './photos-avancement.dto';
import { assertJourPhoto, assertNombrePhotos, CHANTIERS_PHOTOS, jourPhoto } from './photos-rules';

export const PHOTO_SELECT = {
  id: true,
  date: true,
  moment: true,
  commentaire: true,
  statut: true,
  motifMasquage: true,
  valideLe: true,
  createdAt: true,
  fichierId: true,
  chantier: { select: { id: true, reference: true } },
  tache: { select: { id: true, libelle: true } },
  checklistItem: { select: { id: true, libelle: true } },
  auteur: { select: { id: true, nom: true, prenom: true } },
  validePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.PhotoAvancementSelect;

const MOMENT_LABEL = { AVANT: 'avant', APRES: 'après' } as const;
const jourFr = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });

/**
 * Before / after photos of the tasks (Étapes 3–4 of 26/10): sent by the sous-traitants from their
 * portal, validated or hidden by the chef of the job site (or the office). Only validated photos
 * are meant for the client (Étape 5). Separate from the time tracking: photos without hours and
 * hours without photos are both fine.
 */
@Injectable()
export class PhotosAvancementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fichiers: FichiersService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── portal (role SOUS_TRAITANT) ─────────────────────────────────────────

  async envoyer(user: AuthUser, dto: EnvoyerPhotosDto, photos: UploadedBinary[] | undefined) {
    assertNombrePhotos(photos?.length ?? 0);
    const jour = jourPhoto(dto.date);
    assertJourPhoto(jour);

    // The task must be on a job site opened to this account
    const tache = await this.prisma.tache.findFirst({
      where: { id: dto.tacheId, chantier: { companyId: user.companyId, sousTraitantsVisibles: { some: { userId: user.id } } } },
      select: { id: true, libelle: true, chantier: { select: { id: true, reference: true, statut: true, chefChantierId: true } } },
    });
    if (!tache) throw new NotFoundException(`Tâche #${dto.tacheId} introuvable`);
    if (!CHANTIERS_PHOTOS.includes(tache.chantier.statut)) throw new BusinessException('CHANTIER_FERME', 'Ce chantier est clôturé ou annulé.');
    if (dto.checklistItemId) {
      const ok = await this.prisma.tacheChecklistItem.count({ where: { id: dto.checklistItemId, tacheId: tache.id } });
      if (!ok) throw new BusinessException('SOUS_TACHE_INVALIDE', 'Cette sous-tâche n’appartient pas à la tâche.');
    }

    // One file + one row per photo; anything refused (not an image) undoes the whole upload
    const ids: number[] = [];
    const fichiersCrees: number[] = [];
    try {
      for (const photo of photos!) {
        const fichier = await this.fichiers.create(user, photo, { chantierId: tache.chantier.id }, this.prisma, { imagesOnly: true });
        fichiersCrees.push(fichier.id);
        const row = await this.prisma.photoAvancement.create({
          data: {
            companyId: user.companyId,
            chantierId: tache.chantier.id,
            tacheId: tache.id,
            checklistItemId: dto.checklistItemId ?? null,
            auteurId: user.id,
            date: jour,
            moment: dto.moment,
            commentaire: dto.commentaire ?? null,
            fichierId: fichier.id,
          },
          select: { id: true },
        });
        ids.push(row.id);
      }
    } catch (error) {
      for (const id of fichiersCrees) await this.fichiers.remove(id); // rows go with their file
      throw error;
    }

    // To validate: the chef of the job site, or the office when there is none
    const auteur = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { nom: true, prenom: true } });
    const input = {
      type: 'PHOTOS_A_VALIDER',
      titre: 'Photos à valider',
      message: `${[auteur.prenom, auteur.nom].filter(Boolean).join(' ')} : ${ids.length} photo(s) ${MOMENT_LABEL[dto.moment]} sur « ${tache.libelle} » (${tache.chantier.reference}, ${jourFr(jour)}).`,
      lien: `/chantiers/${tache.chantier.id}?onglet=photos`,
    };
    if (tache.chantier.chefChantierId) await this.notifications.notifyUsers(user.companyId, [tache.chantier.chefChantierId], input);
    else await this.notifications.notifyRoles(user.companyId, [Role.ADMIN, Role.ASSISTANTE], input);

    return this.prisma.photoAvancement.findMany({ where: { id: { in: ids } }, select: PHOTO_SELECT, orderBy: { id: 'asc' } });
  }

  /** My photos of a month (all job sites, or one / one task), with their status. */
  async mesPhotos(user: AuthUser, q: QueryMesPhotosDto) {
    const bornes = bornesMois(q.mois);
    const data = await this.prisma.photoAvancement.findMany({
      where: { companyId: user.companyId, auteurId: user.id, chantierId: q.chantierId, tacheId: q.tacheId, date: { gte: bornes.du, lt: bornes.au } },
      select: PHOTO_SELECT,
      orderBy: [{ date: 'desc' }, { tacheId: 'asc' }, { moment: 'asc' }, { id: 'asc' }],
      take: 500,
    });
    const compte = (s: string) => data.filter((p) => p.statut === s).length;
    return { mois: bornes.mois, data, totaux: { enAttente: compte('EN_ATTENTE'), validees: compte('VALIDEE'), masquees: compte('MASQUEE') } };
  }

  /** Only what the chef has not validated yet (a validated photo may already be shown to the client). */
  async supprimerMienne(user: AuthUser, id: number): Promise<void> {
    const photo = await this.prisma.photoAvancement.findFirst({ where: { id, companyId: user.companyId, auteurId: user.id }, select: { statut: true, fichierId: true } });
    if (!photo) throw new NotFoundException(`Photo #${id} introuvable`);
    if (photo.statut === 'VALIDEE') throw new BusinessException('PHOTO_VALIDEE', 'Cette photo est validée : demandez au chef de chantier de la masquer.');
    await this.fichiers.remove(photo.fichierId); // the row goes with its file (cascade)
  }

  // ── office and chef (his job sites) ─────────────────────────────────────

  async liste(user: AuthUser, chantierId: number, q: QueryPhotosChantierDto) {
    await this.assertChantier(user, chantierId);
    const date = q.du || q.au ? { ...(q.du ? { gte: jourPhoto(q.du) } : {}), ...(q.au ? { lte: jourPhoto(q.au) } : {}) } : undefined;
    const where: Prisma.PhotoAvancementWhereInput = {
      chantierId,
      tacheId: q.tacheId,
      checklistItemId: q.checklistItemId,
      auteurId: q.auteurId,
      statut: q.statut,
      moment: q.moment,
      date,
    };
    const [data, parStatut, auteurs] = await Promise.all([
      this.prisma.photoAvancement.findMany({ where, select: PHOTO_SELECT, orderBy: [{ date: 'desc' }, { tacheId: 'asc' }, { moment: 'asc' }, { id: 'asc' }], take: 500 }),
      // Counters of the whole job site (not filtered): the tab shows what is left to validate
      this.prisma.photoAvancement.groupBy({ by: ['statut'], where: { chantierId }, _count: { _all: true }, orderBy: { statut: 'asc' } }),
      this.prisma.user.findMany({
        where: { photosAvancement: { some: { chantierId } } },
        select: { id: true, nom: true, prenom: true },
        orderBy: { nom: 'asc' },
      }),
    ]);
    const n = (s: string) => parStatut.find((x) => x.statut === s)?._count?._all ?? 0;
    return { data, auteurs, totaux: { enAttente: n('EN_ATTENTE'), validees: n('VALIDEE'), masquees: n('MASQUEE') } };
  }

  /** Several at once (the usual case: a day checked by the chef). A hidden photo can be validated again. */
  async valider(user: AuthUser, chantierId: number, ids: number[]) {
    await this.assertChantier(user, chantierId);
    const { count } = await this.prisma.photoAvancement.updateMany({
      where: { chantierId, id: { in: ids }, statut: { not: 'VALIDEE' } },
      data: { statut: 'VALIDEE', motifMasquage: null, valideParId: user.id, valideLe: new Date() },
    });
    return { modifiees: count };
  }

  /** Never shown to the client; the author sees the reason in his portal. */
  async masquer(user: AuthUser, chantierId: number, dto: MasquerPhotosDto) {
    const chantier = await this.assertChantier(user, chantierId);
    const cibles = await this.prisma.photoAvancement.findMany({
      where: { chantierId, id: { in: dto.ids }, statut: { not: 'MASQUEE' } },
      select: { id: true, auteurId: true },
    });
    if (!cibles.length) return { modifiees: 0 };
    const { count } = await this.prisma.photoAvancement.updateMany({
      where: { id: { in: cibles.map((c) => c.id) } },
      data: { statut: 'MASQUEE', motifMasquage: dto.motif ?? null, valideParId: user.id, valideLe: new Date() },
    });
    await this.notifications.notifyUsers(
      user.companyId,
      cibles.map((c) => c.auteurId),
      {
        type: 'PHOTOS_MASQUEES',
        titre: 'Photo(s) non retenue(s)',
        message: `${count} photo(s) du chantier ${chantier.reference} ne seront pas montrées au client${dto.motif ? ` : ${dto.motif}` : '.'}`,
        lien: `/portail/chantiers/${chantierId}`,
      },
    );
    return { modifiees: count };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Same scope as the job site: the chef sees his own job sites only. */
  private async assertChantier(user: AuthUser, chantierId: number) {
    const chantier = await this.prisma.chantier.findFirst({
      where: { id: chantierId, companyId: user.companyId, ...(user.role === Role.CHEF_CHANTIER ? { chefChantierId: user.id } : {}) },
      select: { id: true, reference: true },
    });
    if (!chantier) throw new NotFoundException(`Chantier #${chantierId} introuvable`);
    return chantier;
  }
}
