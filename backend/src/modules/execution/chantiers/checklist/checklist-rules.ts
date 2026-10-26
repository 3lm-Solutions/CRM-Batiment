/** Checklist of a task as sent to the screens (no import here: shared by several services). */
export const CHECKLIST_SELECT = {
  orderBy: { ordre: 'asc' as const },
  select: { id: true, libelle: true, fait: true, ordre: true, faitLe: true, faitPar: { select: { id: true, nom: true, prenom: true } } },
};

/** Progress of a task that has a checklist: share of ticked items (21/10). null = no checklist. */
export function checklistProgress(items: { fait: boolean }[]): number | null {
  if (!items.length) return null;
  return Math.round((items.filter((i) => i.fait).length / items.length) * 100);
}
