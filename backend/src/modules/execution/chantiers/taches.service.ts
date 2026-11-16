import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { ChantiersService } from './chantiers.service';
import { CreateTacheDto, UpdateTacheDto } from './dto/chantiers.dto';
import { CHECKLIST_SELECT } from './checklist/checklist-rules';
import { assertDateRange, normalizeTaskProgress } from './tache-rules';
import { toDates } from '../../../common/dates/to-dates';
import { TacheEvents, type TacheAffecteeEvent } from './taches.events';

const DATES = ['dateDebut', 'dateFin'] as const;

const INCLUDE = {
  affectations: {
    include: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
  },
  checklist: CHECKLIST_SELECT,
} as const;

@Injectable()
export class TachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chantiers: ChantiersService,
    private readonly events: EventEmitter2,
  ) {}

  async list(user: AuthUser, chantierId: number) {
    await this.chantiers.assertAccess(user, chantierId);
    return this.prisma.tache.findMany({
      where: { chantierId },
      orderBy: { ordre: 'asc' },
      include: INCLUDE,
    });
  }

  async create(user: AuthUser, chantierId: number, dto: CreateTacheDto) {
    const chantier = await this.chantiers.assertWritable(user, chantierId);
    assertDateRange(dto.dateDebut, dto.dateFin);
    const { assigneeIds = [], ...data } = dto;

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertAssignees(tx, user, assigneeIds);
      const ordre = await tx.tache.count({ where: { chantierId } });
      const tache = await tx.tache.create({
        data: {
          ...toDates(data, DATES),
          chantierId,
          ordre,
          affectations: { create: assigneeIds.map((userId) => ({ userId })) },
        },
        include: INCLUDE,
      });
      await this.grantSousTraitantAccess(tx, chantierId, assigneeIds);
      return tache;
    });
    this.emitAffectee(user, chantier, created, assigneeIds);
    return created;
  }

  async update(user: AuthUser, chantierId: number, tacheId: number, dto: UpdateTacheDto) {
    const chantier = await this.chantiers.assertWritable(user, chantierId);
    const tache = await this.prisma.tache.findFirst({ where: { id: tacheId, chantierId } });
    if (!tache) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    assertDateRange(dto.dateDebut ?? tache.dateDebut, dto.dateFin ?? tache.dateFin);

    const { assigneeIds, statut: _s, avancement: _a, ...fields } = dto;
    const progress = normalizeTaskProgress(tache, {
      statut: dto.statut,
      avancement: dto.avancement,
    });

    let ajoutes: number[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      if (assigneeIds) {
        const current = await tx.affectationTache.findMany({
          where: { tacheId },
          select: { userId: true },
        });
        const alreadyAssigned = current
          .map((a) => a.userId)
          .filter((id): id is number => id !== null);
        ajoutes = assigneeIds.filter((id) => !alreadyAssigned.includes(id));
        await this.assertAssignees(tx, user, assigneeIds, alreadyAssigned);
        await tx.affectationTache.deleteMany({ where: { tacheId } });
        await tx.affectationTache.createMany({
          data: assigneeIds.map((userId) => ({ tacheId, userId })),
        });
        await this.grantSousTraitantAccess(tx, chantierId, assigneeIds);
      }
      return tx.tache.update({
        where: { id: tacheId },
        data: { ...toDates(fields, DATES), ...progress },
        include: INCLUDE,
      });
    });
    this.emitAffectee(user, chantier, updated, ajoutes);
    return updated;
  }

  /** 16/11: tell the people newly put on the task (notification + push on their phone). */
  private emitAffectee(
    user: AuthUser,
    chantier: { id: number; reference: string },
    tache: { id: number; libelle: string },
    ids: number[],
  ): void {
    const userIds = [...new Set(ids)].filter((id) => id !== user.id);
    if (!userIds.length) return;
    this.events.emit(TacheEvents.AFFECTEE, {
      companyId: user.companyId,
      chantierId: chantier.id,
      chantierReference: chantier.reference,
      tacheId: tache.id,
      tacheLibelle: tache.libelle,
      userIds,
      parId: user.id,
    } satisfies TacheAffecteeEvent);
  }

  async remove(user: AuthUser, chantierId: number, tacheId: number): Promise<void> {
    await this.chantiers.assertWritable(user, chantierId);
    if (!(await this.prisma.tache.count({ where: { id: tacheId, chantierId } })))
      throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    // Its before / after photos go with it (files removed from storage too) — 26/10
    await this.chantiers.supprimerFichiers({ photoAvancement: { tacheId } });
    await this.prisma.tache.deleteMany({ where: { id: tacheId, chantierId } });
  }

  /**
   * Assignees: active users of the company — office staff, chefs or sous-traitant accounts.
   * A chef de chantier may only ADD sous-traitants or himself (decision B of 20/10: he must
   * not hand a task to another chef); people already assigned by the office are kept as is.
   */
  private async assertAssignees(
    db: DbClient,
    user: AuthUser,
    ids: number[],
    alreadyAssigned: number[] = [],
  ): Promise<void> {
    if (!ids.length) return;
    const ok = await db.user.count({
      where: {
        id: { in: ids },
        companyId: user.companyId,
        actif: true,
        role: { not: Role.FOURNISSEUR },
      },
    });
    if (ok !== ids.length)
      throw new BusinessException(
        'AFFECTATION_INVALIDE',
        'Un ou plusieurs intervenants sont invalides.',
      );

    if (user.role === Role.CHEF_CHANTIER) {
      const added = ids.filter((id) => id !== user.id && !alreadyAssigned.includes(id));
      if (!added.length) return;
      const sousTraitants = await db.user.count({
        where: { id: { in: added }, role: Role.SOUS_TRAITANT },
      });
      if (sousTraitants !== added.length) {
        throw new BusinessException(
          'AFFECTATION_INTERDITE',
          'Un chef de chantier ne peut affecter que des sous-traitants ou lui-même.',
        );
      }
    }
  }

  /** A sous-traitant assigned to a task must see the job site in his portal. */
  private async grantSousTraitantAccess(
    db: DbClient,
    chantierId: number,
    ids: number[],
  ): Promise<void> {
    if (!ids.length) return;
    const sousTraitants = await db.user.findMany({
      where: { id: { in: ids }, role: Role.SOUS_TRAITANT },
      select: { id: true },
    });
    if (sousTraitants.length) {
      await db.chantierSousTraitant.createMany({
        data: sousTraitants.map((u) => ({ chantierId, userId: u.id })),
        skipDuplicates: true,
      });
    }
  }
}
