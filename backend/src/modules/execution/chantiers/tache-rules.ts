import { BusinessException } from '../../../common';
import type { TacheStatut } from '../../../generated/prisma/client';

/**
 * Keeps a task's status and progress consistent (the old code allowed "TERMINEE at 20 %"
 * and computed a separate "auto status" for display that disagreed with the stored one).
 */
export function normalizeTaskProgress(
  current: { statut: TacheStatut; avancement: number },
  change: { statut?: TacheStatut; avancement?: number },
): { statut: TacheStatut; avancement: number } {
  let statut = change.statut ?? current.statut;
  let avancement = change.avancement ?? current.avancement;

  if (change.statut === 'TERMINEE') avancement = 100;
  else if (change.avancement === 100) statut = 'TERMINEE';
  else if (statut === 'TERMINEE' && avancement < 100) statut = 'EN_COURS'; // progress lowered: reopened
  else if (statut === 'A_FAIRE' && avancement > 0) statut = 'EN_COURS';

  return { statut, avancement };
}

export function assertDateRange(debut?: Date | string | null, fin?: Date | string | null): void {
  if (debut && fin && new Date(fin) < new Date(debut)) {
    throw new BusinessException('DATES_INVALIDES', 'La date de fin ne peut pas précéder la date de début.');
  }
}

/** Job site progress = average of its tasks' progress (0 when there is no task). */
export function chantierProgress(taches: { avancement: number }[]): number {
  if (!taches.length) return 0;
  return Math.round(taches.reduce((sum, t) => sum + t.avancement, 0) / taches.length);
}
