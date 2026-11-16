import type { StatutClient } from '../../../generated/prisma/client';
import type { DbClient } from '../../../prisma/prisma.types';

/**
 * Lifecycle of a contact (27/10): PROSPECT → QUALIFIE → CLIENT. It only moves UP automatically:
 *  - QUALIFIE: a request is qualified, converted to a quote, a chatbot / email prospect is
 *    qualified, or a quote is sent;
 *  - CLIENT: the first quote is signed (date kept in `devenuClientLe`).
 * A manual change from the client form may set any status.
 */
export const ORDRE_STATUT: StatutClient[] = ['PROSPECT', 'QUALIFIE', 'CLIENT'];

/** Statuses below `cible` (those that may be promoted to it). */
export const statutsInferieurs = (cible: StatutClient): StatutClient[] =>
  ORDRE_STATUT.slice(0, ORDRE_STATUT.indexOf(cible));

/** Promotes the contact if he is below `cible`; never moves him down. Safe to call twice. */
export async function promouvoirClient(
  db: DbClient,
  clientId: number,
  cible: StatutClient,
): Promise<void> {
  await db.client.updateMany({
    where: { id: clientId, statut: { in: statutsInferieurs(cible) } },
    data: { statut: cible, ...(cible === 'CLIENT' ? { devenuClientLe: new Date() } : {}) },
  });
}
