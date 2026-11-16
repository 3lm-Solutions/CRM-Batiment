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

// ── company client (Étape 1 of 26/10) — same rules as the API (common/validators/entreprise.validator.ts)

const compactNumero = (v: string) => v.replace(/[\s.-]+/g, '').toUpperCase();

/** 27/10: any 14 digits are accepted (no key check). */
export function isSiret(value: string): boolean {
  return /^\d{14}$/.test(compactNumero(value));
}

export function isTvaIntracom(value: string): boolean {
  const v = compactNumero(value);
  if (!/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(v)) return false;
  if (!v.startsWith('FR')) return true;
  const m = /^FR([A-Z0-9]{2})(\d{9})$/.exec(v);
  if (!m) return false;
  if (!/^\d{2}$/.test(m[1])) return true;
  return Number(m[1]) === (12 + 3 * (Number(m[2]) % 97)) % 97;
}

/** Optional SIRET field: empty, or 14 digits with a valid key. */
export const zSiret = z
  .string()
  .trim()
  .refine((v) => !v || isSiret(v), 'Le SIRET doit contenir 14 chiffres.');

/** Optional intra-community VAT number field. */
export const zTvaIntracom = z
  .string()
  .trim()
  .refine((v) => !v || isTvaIntracom(v), 'N° de TVA intracommunautaire invalide (ex. FR40303265045).');
