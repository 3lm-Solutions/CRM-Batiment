import { BusinessException } from '../../../common';

/** A day can be entered up to this many days back (older: ask the office). */
export const JOURS_RETRO_MAX = 60;
export const HEURES_JOUR_MAX = 24;

/** « 2026-10-21 » or an ISO date → that calendar day at 00:00 UTC (the column is a DATE). */
export function jourUtc(value: string): Date {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The day must be today or in the last JOURS_RETRO_MAX days. */
export function assertJourPointable(jour: Date, now = new Date()): void {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (jour.getTime() > today) throw new BusinessException('DATE_FUTURE', 'On ne pointe pas un jour à venir.');
  if (today - jour.getTime() > JOURS_RETRO_MAX * 86_400_000) {
    throw new BusinessException('DATE_TROP_ANCIENNE', `Pointage limité aux ${JOURS_RETRO_MAX} derniers jours : contactez l’entreprise.`);
  }
}

/** Hours already entered that day (not refused) + the new ones must stay within a day. */
export function assertTotalJour(dejaSaisi: number, ajout: number): void {
  if (dejaSaisi + ajout > HEURES_JOUR_MAX) {
    throw new BusinessException('TROP_D_HEURES', `Plus de ${HEURES_JOUR_MAX} h ce jour-là (déjà ${dejaSaisi} h saisies).`);
  }
}

/** « 2026-10 » → [first day, first day of next month[ in UTC. Current month by default. */
export function bornesMois(mois: string | undefined, now = new Date()): { du: Date; au: Date; mois: string } {
  const [y, m] = mois ? mois.split('-').map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const du = new Date(Date.UTC(y, m - 1, 1));
  const au = new Date(Date.UTC(y, m, 1));
  return { du, au, mois: `${y}-${String(m).padStart(2, '0')}` };
}
