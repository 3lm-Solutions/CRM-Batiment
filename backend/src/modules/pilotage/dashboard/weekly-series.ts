import type { DevisStatut } from '../../../generated/prisma/client';

export interface WeekPoint {
  /** Monday of the week, YYYY-MM-DD (UTC) */
  semaine: string;
  envoyes: number;
  acceptes: number;
  refuses: number;
}

const ACCEPTED: DevisStatut[] = ['ACCEPTE', 'SIGNE'];

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/**
 * "Devis envoyés / acceptés / refusés" chart: one point per week, oldest first, including
 * empty weeks (a missing week would distort the chart). Quotes are bucketed by send date.
 */
export function weeklySeries(rows: { dateEnvoi: Date; statut: DevisStatut }[], now: Date, weeks: number): WeekPoint[] {
  const first = weekStart(now);
  first.setUTCDate(first.getUTCDate() - 7 * (weeks - 1));

  const points = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() + 7 * i);
    return { semaine: d.toISOString().slice(0, 10), envoyes: 0, acceptes: 0, refuses: 0 };
  });
  const index = new Map(points.map((p, i) => [p.semaine, i]));

  for (const row of rows) {
    const i = index.get(weekStart(row.dateEnvoi).toISOString().slice(0, 10));
    if (i === undefined) continue;
    points[i].envoyes++;
    if (ACCEPTED.includes(row.statut)) points[i].acceptes++;
    if (row.statut === 'REFUSE') points[i].refuses++;
  }
  return points;
}

export function rate(part: number, total: number): number {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}
