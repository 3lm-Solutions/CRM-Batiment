import { BusinessException } from '../../../common';
import type { ChantierStatut } from '../../../generated/prisma/client';

/**
 * Before / after photos of the sous-traitants (Étapes 3–4 of 26/10). Pure rules, unit-tested.
 */

/** Photos per upload (one moment, one task). */
export const MAX_PHOTOS_ENVOI = 10;

/** A photo can be sent for today or up to this many days back (same as the time tracking). */
export const JOURS_RETRO_PHOTO = 60;

/** Job sites on which photos can be sent (a cancelled or closed site is frozen). */
export const CHANTIERS_PHOTOS: ChantierStatut[] = ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE'];

/** « 2026-10-21 » (or nothing = today) → that calendar day at 00:00 UTC (the column is a DATE). */
export function jourPhoto(value: string | undefined, now = new Date()): Date {
  const d = value ? new Date(value) : now;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function assertJourPhoto(jour: Date, now = new Date()): void {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (jour.getTime() > today) throw new BusinessException('DATE_FUTURE', 'La date de la photo ne peut pas être dans le futur.');
  if (today - jour.getTime() > JOURS_RETRO_PHOTO * 86_400_000) {
    throw new BusinessException('DATE_TROP_ANCIENNE', `Photos limitées aux ${JOURS_RETRO_PHOTO} derniers jours.`);
  }
}

export function assertNombrePhotos(n: number): void {
  if (n === 0) throw new BusinessException('FICHIER_MANQUANT', 'Aucune photo reçue.');
  if (n > MAX_PHOTOS_ENVOI) throw new BusinessException('TROP_DE_PHOTOS', `${MAX_PHOTOS_ENVOI} photos au maximum par envoi.`);
}
