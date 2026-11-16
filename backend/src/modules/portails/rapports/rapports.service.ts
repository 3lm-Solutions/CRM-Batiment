import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AuthUser,
  BusinessException,
  paginate,
  PaginationQueryDto,
  toSkipTake,
} from '../../../common';
import { ChantierStatut, Prisma, RapportStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ACCEPTED_LABEL, detectFileType } from '../../core/storage/file-type';
import { FICHIER_SELECT, FichiersService } from '../../core/storage/fichiers.service';
import { MAX_PHOTOS_PER_RAPPORT, type UploadedBinary } from '../../core/storage/upload.config';
import { CHANTIER_FERME, ChantiersService } from '../../execution/chantiers/chantiers.service';
import { normalizeTaskProgress } from '../../execution/chantiers/tache-rules';
import { PortailEvents, type RapportEvent } from '../portails.events';
import { CreateRapportDto } from './rapports.dto';

export const RAPPORT_INCLUDE = {
  auteur: { select: { id: true, nom: true, prenom: true } },
  tache: { select: { id: true, libelle: true } },
  chantier: { select: { id: true, reference: true } },
  photos: { select: FICHIER_SELECT, orderBy: { id: 'asc' } },
} satisfies Prisma.RapportChantierInclude;

/** A report can be written while the work is going on, or for reserves after it ended. */
const REPORTABLE: ChantierStatut[] = ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE'];

/**
 * Site reports: written by sous-traitants from their portal (text + photos), reviewed by the
 * office or the chef de chantier. Validating a report that declares a progress applies it to the task.
 */
@Injectable()
export class RapportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fichiers: FichiersService,
    private readonly chantiers: ChantiersService,
    private readonly events: EventEmitter2,
  ) {}

  // ── sous-traitant side ──────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreateRapportDto, photos: UploadedBinary[] = []) {
    if (photos.length > MAX_PHOTOS_PER_RAPPORT) {
      throw new BusinessException(
        'TROP_DE_PHOTOS',
        `${MAX_PHOTOS_PER_RAPPORT} photos maximum par rapport.`,
      );
    }
    // Reject a bad file BEFORE writing anything
    if (photos.some((p) => !detectFileType(p.buffer))) {
      throw new BusinessException(
        'FICHIER_TYPE_REFUSE',
        `Format de photo non accepté (${ACCEPTED_LABEL}).`,
      );
    }

    // 404 if the job site is not opened to this account
    const chantier = await this.chantiers.assertAccess(user, dto.chantierId);
    if (!REPORTABLE.includes(chantier.statut)) {
      throw new BusinessException(
        'CHANTIER_FERME',
        'Ce chantier est clôturé : il ne reçoit plus de rapports.',
      );
    }
    if (dto.tacheId) {
      const assigned = await this.prisma.tache.count({
        where: {
          id: dto.tacheId,
          chantierId: chantier.id,
          affectations: { some: { userId: user.id } },
        },
      });
      if (!assigned)
        throw new BusinessException('TACHE_NON_AFFECTEE', 'Cette tâche ne vous est pas affectée.');
    }
    if (dto.avancement !== undefined && !dto.tacheId) {
      throw new BusinessException(
        'AVANCEMENT_SANS_TACHE',
        'Choisissez la tâche dont vous déclarez l’avancement.',
      );
    }

    const rapport = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rapportChantier.create({
        data: {
          companyId: user.companyId,
          chantierId: chantier.id,
          tacheId: dto.tacheId,
          auteurId: user.id,
          contenu: dto.contenu,
          avancement: dto.avancement,
        },
      });
      for (const photo of photos) {
        await this.fichiers.create(
          user,
          photo,
          { chantierId: chantier.id, rapportId: created.id },
          tx,
        );
      }
      return tx.rapportChantier.findUniqueOrThrow({
        where: { id: created.id },
        include: RAPPORT_INCLUDE,
      });
    });

    this.emit(PortailEvents.RAPPORT_SOUMIS, rapport, chantier.chefChantierId, chantier.reference);
    return rapport;
  }

  /** The author's own reports, newest first. */
  async mine(user: AuthUser, query: PaginationQueryDto & { chantierId?: number }) {
    const where: Prisma.RapportChantierWhereInput = {
      companyId: user.companyId,
      auteurId: user.id,
      chantierId: query.chantierId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.rapportChantier.findMany({
        where,
        include: RAPPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query),
      }),
      this.prisma.rapportChantier.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  // ── office / chef side ──────────────────────────────────────────────────

  async forChantier(user: AuthUser, chantierId: number) {
    await this.chantiers.assertAccess(user, chantierId);
    return this.prisma.rapportChantier.findMany({
      where: { chantierId },
      include: RAPPORT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async review(user: AuthUser, id: number, decision: 'VALIDE' | 'REJETE', commentaire?: string) {
    if (decision === 'REJETE' && !commentaire?.trim()) {
      throw new BusinessException(
        'COMMENTAIRE_REQUIS',
        'Indiquez au sous-traitant ce qui est à reprendre.',
      );
    }
    const rapport = await this.prisma.rapportChantier.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!rapport) throw new NotFoundException(`Rapport #${id} introuvable`);
    const chantier = await this.chantiers.assertAccess(user, rapport.chantierId);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: two reviewers clicking at once can't both apply the progress
      const { count } = await tx.rapportChantier.updateMany({
        where: { id, statut: RapportStatut.SOUMIS },
        data: {
          statut: decision,
          commentaireValidation: commentaire?.trim() || null,
          valideParId: user.id,
          valideLe: new Date(),
        },
      });
      if (!count)
        throw new BusinessException('RAPPORT_DEJA_TRAITE', 'Ce rapport a déjà été traité.');

      if (
        decision === 'VALIDE' &&
        rapport.tacheId &&
        rapport.avancement !== null &&
        !CHANTIER_FERME.includes(chantier.statut)
      ) {
        const tache = await tx.tache.findUnique({ where: { id: rapport.tacheId } });
        // A report only ever RAISES progress: validating an old "50 %" report after the task moved on
        // to 80 % (or was finished) used to bring it back to 50 % and reopen it.
        if (tache && rapport.avancement > tache.avancement) {
          await tx.tache.update({
            where: { id: tache.id },
            data: normalizeTaskProgress(tache, { avancement: rapport.avancement }),
          });
        }
      }
      return tx.rapportChantier.findUniqueOrThrow({ where: { id }, include: RAPPORT_INCLUDE });
    });

    this.emit(PortailEvents.RAPPORT_REVU, updated, chantier.chefChantierId, chantier.reference);
    return updated;
  }

  private emit(
    name: string,
    r: {
      id: number;
      companyId: number;
      chantierId: number;
      statut: RapportStatut;
      auteur: { id: number; nom: string; prenom: string | null };
    },
    chefChantierId: number | null,
    chantierReference: string,
  ) {
    const event: RapportEvent = {
      companyId: r.companyId,
      rapportId: r.id,
      chantierId: r.chantierId,
      chantierReference,
      chefChantierId,
      auteurId: r.auteur.id,
      auteurNom: [r.auteur.prenom, r.auteur.nom].filter(Boolean).join(' '),
      statut: r.statut,
    };
    this.events.emit(name, event);
  }
}
