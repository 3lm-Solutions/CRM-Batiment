import type { ChantierStatut } from '../../../generated/prisma/client';

/**
 * Étape 2 (26/10): after-sales service only once the works are over, for a period set by the
 * company (12 months by default, 0 = no limit). Pure rules, unit-tested.
 */
export const CHANTIER_FINI: ChantierStatut[] = ['TERMINE', 'CLOTURE'];

export type EligibiliteSav =
  | { possible: true; code: 'OK'; jusquau: Date | null; message: null }
  | {
      possible: false;
      code: 'CHANTIER_NON_TERMINE' | 'SAV_EXPIRE';
      jusquau: Date | null;
      message: string;
    };

/** 31 January + 1 month = 28/29 February (never spills into March). */
export function ajouterMois(date: Date, mois: number): Date {
  const d = new Date(date.getTime());
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d;
}

const jourFr = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

/**
 * @param chantier `dateFin` is set when the job site is marked finished; older rows fall back on
 *                 their last update.
 */
export function eligibiliteSav(
  chantier: { statut: ChantierStatut; dateFin: Date | null; updatedAt: Date },
  dureeMois: number,
  now = new Date(),
): EligibiliteSav {
  const fin = chantier.dateFin ?? chantier.updatedAt;
  const jusquau = dureeMois > 0 ? ajouterMois(fin, dureeMois) : null;
  if (!CHANTIER_FINI.includes(chantier.statut)) {
    return {
      possible: false,
      code: 'CHANTIER_NON_TERMINE',
      jusquau: null,
      message:
        'Le service après-vente s’ouvre à la fin des travaux. Pendant le chantier, contactez votre chef de chantier.',
    };
  }
  if (jusquau && now > jusquau) {
    return {
      possible: false,
      code: 'SAV_EXPIRE',
      jusquau,
      message: `La période de service après-vente de ce chantier a pris fin le ${jourFr(jusquau)}.`,
    };
  }
  return { possible: true, code: 'OK', jusquau, message: null };
}
