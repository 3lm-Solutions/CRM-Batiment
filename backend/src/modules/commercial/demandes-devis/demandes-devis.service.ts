import { Injectable, NotFoundException } from '@nestjs/common';
import { FichiersService } from '../../core/storage/fichiers.service';
import type { UploadedBinary } from '../../core/storage/upload.config';
import {
  type AuthUser,
  BusinessException,
  paginate,
  parseSort,
  ReferencePrefix,
  ReferenceService,
  toSkipTake,
} from '../../../common';
import { DemandeStatut, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DevisService } from '../devis/devis.service';
import { assertDemandeTransition } from './demande-status';
import {
  CreateDemandeDevisDto,
  QueryDemandesDevisDto,
  UpdateDemandeDevisDto,
} from './dto/demandes-devis.dto';
import { promouvoirClient } from '../../referentiel/clients/client-statut';

const SORTABLE = ['reference', 'date', 'createdAt'] as const;
const INCLUDE = {
  client: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
  createur: { select: { id: true, nom: true, prenom: true } },
  devis: { select: { id: true, reference: true, statut: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.DemandeDevisInclude;

/** 16/11 (mobile): photos and voice notes, in the detail only. */
const PIECE_JOINTE_SELECT = {
  id: true,
  type: true,
  dureeSecondes: true,
  createdAt: true,
  fichier: { select: { id: true, nom: true, mime: true, taille: true } },
} satisfies Prisma.DemandeDevisFichierSelect;
const MAX_PIECES_JOINTES = 20;

@Injectable()
export class DemandesDevisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly devis: DevisService,
    private readonly fichiers: FichiersService,
  ) {}

  // ── photos / voice notes (16/11, mobile lot B1) ─────────────────────────

  /** A photo (JPG, PNG, WebP), a PDF or a voice note (WebM, Ogg, M4A, MP3, WAV) of the prospect. */
  async ajouterFichier(
    user: AuthUser,
    id: number,
    file: UploadedBinary | undefined,
    dureeSecondes?: number,
  ) {
    const demande = await this.prisma.demandeDevis.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, _count: { select: { fichiers: true } } },
    });
    if (!demande) throw new NotFoundException(`Demande #${id} introuvable`);
    if (demande._count.fichiers >= MAX_PIECES_JOINTES) {
      throw new BusinessException(
        'TROP_DE_FICHIERS',
        `${MAX_PIECES_JOINTES} pièces jointes au plus par demande.`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const fichier = await this.fichiers.create(user, file, {}, tx, { allowAudio: true });
      return tx.demandeDevisFichier.create({
        data: {
          demandeDevisId: id,
          fichierId: fichier.id,
          type: fichier.mime.startsWith('audio/') ? 'AUDIO' : 'PHOTO',
          dureeSecondes: fichier.mime.startsWith('audio/') ? (dureeSecondes ?? null) : null,
        },
        select: PIECE_JOINTE_SELECT,
      });
    });
  }

  async supprimerFichier(user: AuthUser, id: number, pieceId: number): Promise<void> {
    const piece = await this.prisma.demandeDevisFichier.findFirst({
      where: { id: pieceId, demandeDevisId: id, demandeDevis: { companyId: user.companyId } },
      select: { fichierId: true },
    });
    if (!piece) throw new NotFoundException(`Pièce jointe #${pieceId} introuvable`);
    // Deleting the file cascades to the link row
    await this.fichiers.remove(piece.fichierId);
  }

  async findAll(user: AuthUser, query: QueryDemandesDevisDto) {
    const where: Prisma.DemandeDevisWhereInput = {
      companyId: user.companyId,
      statut: query.statuts?.length ? { in: query.statuts } : undefined,
      source: query.source,
      clientId: query.clientId,
      ...(query.mesProspects && { createurId: user.id }),
      ...(query.search && {
        OR: [
          { reference: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { client: { nom: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.demandeDevis.findMany({
        where,
        include: INCLUDE,
        orderBy: parseSort(query.sort, SORTABLE, { createdAt: 'desc' }),
        ...toSkipTake(query),
      }),
      this.prisma.demandeDevis.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.demandeDevis.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        ...INCLUDE,
        fichiers: { select: PIECE_JOINTE_SELECT, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException(`Demande #${id} introuvable`);
    return row;
  }

  async create(user: AuthUser, dto: CreateDemandeDevisDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId: user.companyId },
    });
    if (!client)
      throw new BusinessException('CLIENT_INTROUVABLE', `Client #${dto.clientId} introuvable.`);
    if (client.archivedAt) throw new BusinessException('CLIENT_ARCHIVE', 'Ce client est archivé.');

    return this.prisma.$transaction(async (tx) =>
      tx.demandeDevis.create({
        data: {
          ...dto,
          besoinStructure: dto.besoinStructure as Prisma.InputJsonValue | undefined,
          companyId: user.companyId,
          createurId: user.id,
          reference: await this.references.next(ReferencePrefix.DEMANDE, user.companyId, tx),
        },
        include: INCLUDE,
      }),
    );
  }

  async update(user: AuthUser, id: number, dto: UpdateDemandeDevisDto) {
    const demande = await this.findOne(user, id);
    if (demande.statut === 'CONVERTI') {
      throw new BusinessException(
        'DEMANDE_CONVERTIE',
        'Une demande convertie ne se modifie plus : modifiez le devis.',
      );
    }
    return this.prisma.demandeDevis.update({
      where: { id },
      data: { ...dto, besoinStructure: dto.besoinStructure as Prisma.InputJsonValue | undefined },
      include: INCLUDE,
    });
  }

  /** prendre-en-charge / qualifier / perdre / reouvrir */
  async changerStatut(user: AuthUser, id: number, to: Exclude<DemandeStatut, 'CONVERTI'>) {
    const demande = await this.findOne(user, id);
    assertDemandeTransition(demande.statut, to);
    return this.prisma.$transaction(async (tx) => {
      // 27/10: a qualified request makes its contact a qualified prospect
      if (to === 'QUALIFIE') await promouvoirClient(tx, demande.clientId, 'QUALIFIE');
      return tx.demandeDevis.update({ where: { id }, data: { statut: to }, include: INCLUDE });
    });
  }

  /**
   * P0.1 — demande → draft quote, in ONE transaction, idempotent.
   * v2 fixes: the reference came from `count + 1` (collides after deletions), there was no
   * transaction, and a 0 € placeholder line let an empty quote pass the "has lines" check.
   * The request description goes to the quote notes; lines are added from the catalogue.
   */
  async convertirEnDevis(user: AuthUser, id: number) {
    const devisId = await this.prisma.$transaction(async (tx) => {
      const demande = await tx.demandeDevis.findFirst({
        where: { id, companyId: user.companyId },
        include: { devis: { where: { statut: { not: 'ANNULE' } }, select: { id: true } } },
      });
      if (!demande) throw new NotFoundException(`Demande #${id} introuvable`);

      if (demande.devis.length > 0) return demande.devis[0].id; // already converted: same quote
      assertDemandeTransition(demande.statut, 'CONVERTI');

      // Conditional update: two simultaneous clicks cannot create two quotes
      const { count } = await tx.demandeDevis.updateMany({
        where: { id, statut: demande.statut },
        data: { statut: 'CONVERTI' },
      });
      if (!count)
        throw new BusinessException(
          'DEMANDE_MODIFIEE',
          'La demande vient d’être modifiée. Rechargez la page.',
        );

      await promouvoirClient(tx, demande.clientId, 'QUALIFIE');
      const devis = await this.devis.createDraft(tx, user, {
        clientId: demande.clientId,
        demandeDevisId: demande.id,
        notes: `Demande ${demande.reference} : ${demande.description}`,
      });
      return devis.id;
    });
    return this.devis.findOne(user, devisId);
  }

  /** Only a request that never produced a quote. */
  async remove(user: AuthUser, id: number): Promise<void> {
    const demande = await this.findOne(user, id);
    if (demande.devis.length > 0) {
      throw new BusinessException(
        'DEMANDE_AVEC_DEVIS',
        'Cette demande a un devis : marquez-la perdue plutôt.',
      );
    }
    await this.prisma.demandeDevis.delete({ where: { id } });
  }
}
