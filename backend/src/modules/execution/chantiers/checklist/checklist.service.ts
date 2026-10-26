import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException } from '../../../../common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { DbClient } from '../../../../prisma/prisma.types';
import { ChantiersService } from '../chantiers.service';
import { normalizeTaskProgress } from '../tache-rules';
import { CHECKLIST_SELECT, checklistProgress } from './checklist-rules';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './checklist.dto';

const MAX_ITEMS = 50;

/**
 * Sub-tasks to tick inside a task (21/10). Once a task has a checklist, its progress (and status)
 * follow the ticked items: the job site progress stays right without anyone typing a %.
 */
@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chantiers: ChantiersService,
  ) {}

  async add(user: AuthUser, chantierId: number, tacheId: number, dto: CreateChecklistItemDto) {
    await this.writableTache(user, chantierId, tacheId);
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.tacheChecklistItem.count({ where: { tacheId } });
      if (count >= MAX_ITEMS) throw new BusinessException('CHECKLIST_PLEINE', `${MAX_ITEMS} points au maximum par tâche.`);
      await tx.tacheChecklistItem.create({ data: { tacheId, libelle: dto.libelle, ordre: count } });
      return this.sync(tx, tacheId);
    });
  }

  async update(user: AuthUser, chantierId: number, tacheId: number, itemId: number, dto: UpdateChecklistItemDto) {
    await this.writableTache(user, chantierId, tacheId);
    return this.prisma.$transaction(async (tx) => {
      await this.setItem(tx, user, tacheId, itemId, dto);
      return this.sync(tx, tacheId);
    });
  }

  async remove(user: AuthUser, chantierId: number, tacheId: number, itemId: number) {
    await this.writableTache(user, chantierId, tacheId);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.tacheChecklistItem.deleteMany({ where: { id: itemId, tacheId } });
      if (!count) throw new NotFoundException(`Point #${itemId} introuvable`);
      return this.sync(tx, tacheId);
    });
  }

  /** Sous-traitant portal: tick an item of a task assigned to him, on an open job site. */
  async cocherPortail(user: AuthUser, tacheId: number, itemId: number, fait: boolean) {
    const tache = await this.prisma.tache.findFirst({
      where: {
        id: tacheId,
        affectations: { some: { userId: user.id } },
        chantier: { companyId: user.companyId, sousTraitantsVisibles: { some: { userId: user.id } } },
      },
      select: { chantier: { select: { statut: true } } },
    });
    if (!tache) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
    if (tache.chantier.statut === 'CLOTURE' || tache.chantier.statut === 'ANNULE') {
      throw new BusinessException('CHANTIER_FERME', 'Ce chantier est clôturé.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.setItem(tx, user, tacheId, itemId, { fait });
      return this.sync(tx, tacheId);
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async writableTache(user: AuthUser, chantierId: number, tacheId: number) {
    await this.chantiers.assertWritable(user, chantierId);
    const ok = await this.prisma.tache.count({ where: { id: tacheId, chantierId } });
    if (!ok) throw new NotFoundException(`Tâche #${tacheId} introuvable`);
  }

  private async setItem(tx: DbClient, user: AuthUser, tacheId: number, itemId: number, dto: UpdateChecklistItemDto) {
    const item = await tx.tacheChecklistItem.findFirst({ where: { id: itemId, tacheId } });
    if (!item) throw new NotFoundException(`Point #${itemId} introuvable`);
    const changed = dto.fait !== undefined && dto.fait !== item.fait;
    await tx.tacheChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.libelle !== undefined ? { libelle: dto.libelle } : {}),
        ...(changed ? { fait: dto.fait, faitLe: dto.fait ? new Date() : null, faitParId: dto.fait ? user.id : null } : {}),
      },
    });
  }

  /** Task progress / status from the checklist; returns the task with its checklist. */
  private async sync(tx: DbClient, tacheId: number) {
    const tache = await tx.tache.findUniqueOrThrow({ where: { id: tacheId }, include: { checklist: { select: { fait: true } } } });
    const avancement = checklistProgress(tache.checklist);
    if (avancement !== null && avancement !== tache.avancement) {
      await tx.tache.update({ where: { id: tacheId }, data: normalizeTaskProgress(tache, { avancement }) });
    }
    return tx.tache.findUniqueOrThrow({ where: { id: tacheId }, select: { id: true, statut: true, avancement: true, checklist: CHECKLIST_SELECT } });
  }
}
