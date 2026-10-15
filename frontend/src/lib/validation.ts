import { z } from 'zod';

/** Same rule as the API (common/validators/phone.validator.ts): French and foreign numbers. */
export const PHONE_MESSAGE = 'Numéro de téléphone invalide : 8 à 15 chiffres (ex. 06 12 34 56 78, +33 6 12 34 56 78, +216 22 123 456).';

export function isPhone(value: string): boolean {
  const v = value.trim();
  if (!/^\+?[\d\s.\-()/]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, '').length;
  return digits >= 8 && digits <= 15;
}

/** Optional phone field of a form: empty, or a valid number. */
export const zPhone = z
  .string()
  .trim()
  .refine((v) => !v || isPhone(v), PHONE_MESSAGE);

export const EMAIL_MESSAGE = 'Adresse email invalide (ex. nom@domaine.fr).';
