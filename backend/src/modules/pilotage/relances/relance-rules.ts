/** No two reminders of the same document closer than this (an automatic one after a manual one, for instance). */
export const MIN_JOURS_ENTRE_RELANCES = 2;

export const DAY_MS = 86_400_000;

/** Whole days elapsed since `from` (0 the same day, negative before). */
export const joursDepuis = (from: Date, now: Date) =>
  Math.floor((now.getTime() - from.getTime()) / DAY_MS);

/**
 * Which automatic reminder is due today, if any (C3 of 21/10).
 *
 * @param jours         days since the quote was sent / since the invoice due date
 * @param delais        the company's delays, e.g. [7, 14] — one reminder per value
 * @param dejaEnvoyes   levels already sent automatically (1, 2…)
 * @param derniere      date of the last reminder of this document (automatic or manual)
 * @returns the level to send (1-based), or null
 *
 * One level per run: if the job did not run for days, it catches up one level a day instead
 * of sending three emails at once.
 */
export function niveauDu(
  jours: number,
  delais: readonly number[],
  dejaEnvoyes: readonly number[],
  derniere: Date | null,
  now: Date,
): number | null {
  const sorted = [...new Set(delais)].filter((d) => d >= 0).sort((a, b) => a - b);
  const niveau = (dejaEnvoyes.length ? Math.max(...dejaEnvoyes) : 0) + 1;
  if (niveau > sorted.length) return null;
  if (jours < sorted[niveau - 1]) return null;
  if (derniere && joursDepuis(derniere, now) < MIN_JOURS_ENTRE_RELANCES) return null;
  return niveau;
}
