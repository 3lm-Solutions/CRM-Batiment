import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException } from '../../../common';
import { Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { ChantiersService } from './chantiers.service';
import { CreateTacheDto, UpdateTacheDto } from './dto/chantiers.dto';
import { CHECKLIST_SELECT } from './checklist/checklist-rules';
import { assertDateRange, normalizeTaskProgress } from './tache-rules';

const INCLUDE = {
  affectations: { include: { user: { select: { id: true, nom: true, prenom: true, role: true } } } },
  checklist: CHECKLIST_SELECT,
} as const;

@Injectable()
export class TachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chantiers: ChantiersService,
  ) {}

  async list(user: AuthUser, chantierId: number) {
    await this.chantiers.assertAccess(user, chantierId);
    return this.prisma.tache.findMany({ where: { chantierId }, orderBy: { ordre: 'asc' }, include: INCLUDE });
  }

  async create(user: AuthUser, chantierId: number, dto: CreateTacheDto) {
    await this.chantiers.assertWritable(user, chantierId);
    assertDateRange(dto.dateDebut, dto.dateFin);
    const { assigneeIds = [], ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      await this.assertAssignees(tx, user, assigneeIds);
      const ordre = await tx.tache.count({ where: { chantierId } });
      const tache = await tx.tache.create({
        data: { ...data, chantierId, ordre, affectations: { create: assigneeIds.map((userId) => ({ userId })) } },
        include: INCLUDE,
      });
      await this.grantSousTraitantAccess(tx, chantierId, assigneeIds);
      return tache;
    });
  }

  async update(user: AuthUser, chantierId: number, tacheId: number, dto: UpdateTacheDto) {
    await this.chantiers.assertWritable(user, chantierId);
    const tache = await this.prisma.tache.findFirst({ where: { id: tacheId, chantierId } });
    if (!tache) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    assertDateRange(dto.dateDebut ?? tache.dateDebut, dto.dateFin ?? tache.dateFin);

    const { assigneeIds, statut: _s, avancement: _a, ...fields } = dto;
    const progress = normalizeTaskProgress(tache, { statut: dto.statut, avancement: dto.avancement });

    return this.prisma.$transaction(async (tx) => {
      if (assigneeIds) {
        const current = await tx.affectationTache.findMany({ where: { tacheId }, select: { userId: true } });
        const alreadyAssigned = current.map((a) => a.userId).filter((id): id is number => id !== null);
        await this.assertAssignees(tx, user, assigneeIds, alreadyAssigned);
        await tx.affectationTache.deleteMany({ where: { tacheId } });
        await tx.affectationTache.createMany({ data: assigneeIds.map((userId) => ({ tacheId, userId })) });
        await this.grantSousTraitantAccess(tx, chantierId, assigneeIds);
      }
      return tx.tache.update({ where: { id: tacheId }, data: { ...fields, ...progress }, include: INCLUDE });
    });
  }

  async remove(user: AuthUser, chantierId: number, tacheId: number): Promise<void> {
    await this.chantiers.assertWritable(user, chantierId);
    const { count } = await this.prisma.tache.deleteMany({ where: { id: tacheId, chantierId } });
    if (!count) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
  }

  /**
   * Assignees: active users of the company — office staff, chefs or sous-traitant accounts.
   * A chef de chantier may only ADD sous-traitants or himself (decision B of 20/10: he must
   * not hand a task to another chef); people already assigned by the office are kept as is.
   */
  private async assertAssignees(db: DbClient, user: AuthUser, ids: number[], alreadyAssigned: number[] = []): Promise<void> {
    if (!ids.length) return;
    const ok = await db.user.count({
      where: { id: { in: ids }, companyId: user.companyId, actif: true, role: { not: Role.FOURNISSEUR } },
    });
    if (ok !== ids.length) throw new BusinessException('AFFECTATION_INVALIDE', 'Un ou plusieurs intervenants sont invalides.');

    if (user.role === Role.CHEF_CHANTIER) {
      const added = ids.filter((id) => id !== user.id && !alreadyAssigned.includes(id));
      if (!added.length) return;
      const sousTraitants = await db.user.count({ where: { id: { in: added }, role: Role.SOUS_TRAITANT } });
      if (sousTraitants !== added.length) {
        throw new BusinessException('AFFECTATION_INTERDITE', 'Un chef de chantier ne peut affecter que des sous-traitants ou lui-même.');
      }
    }
  }

  /** A sous-traitant assigned to a task must see the job site in his portal. */
  private async grantSousTraitantAccess(db: DbClient, chantierId: number, ids: number[]): Promise<void> {
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
