import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';

/** « 732 829 320 00074 » → « 73282932000074 » (spaces, dots and dashes are only for reading). */
export const compactNumero = (v: string) => v.replace(/[\s.-]+/g, '').toUpperCase();

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

/**
 * French SIRET: 14 digits (27/10: no check of the Luhn key — decision of the user, so that any
 * 14-digit number entered is accepted). `siretCleValide` stays available for a soft warning.
 */
export function isSiret(value: unknown): boolean {
  return typeof value === 'string' && /^\d{14}$/.test(compactNumero(value));
}

/** Luhn key of a SIRET (La Poste establishments, SIREN 356000000: digit sum multiple of 5). */
export function siretCleValide(value: string): boolean {
  const s = compactNumero(value);
  if (!/^\d{14}$/.test(s)) return false;
  if (luhn(s)) return true;
  return s.startsWith('356000000') && [...s].reduce((a, d) => a + Number(d), 0) % 5 === 0;
}

/**
 * Intra-community VAT number: 2 country letters + 2 to 12 characters. For France (FR + key + SIREN)
 * the numeric key is checked: key = (12 + 3 × (SIREN mod 97)) mod 97.
 */
export function isTvaIntracom(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = compactNumero(value);
  if (!/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(v)) return false;
  if (!v.startsWith('FR')) return true;
  const m = /^FR([A-Z0-9]{2})(\d{9})$/.exec(v);
  if (!m) return false;
  if (!/^\d{2}$/.test(m[1])) return true; // old alphanumeric keys: format only
  return Number(m[1]) === (12 + 3 * (Number(m[2]) % 97)) % 97;
}

/** SIRET field (stored compact; empty → null). */
export function IsSiret() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? compactNumero(value) || null : value,
    ),
    ValidateBy({
      name: 'isSiret',
      validator: {
        validate: (v) => v === null || isSiret(v),
        defaultMessage: () => 'Le SIRET doit contenir 14 chiffres.',
      },
    }),
  );
}

/** Intra-community VAT number field (stored compact, upper case; empty → null). */
export function IsTvaIntracom() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? compactNumero(value) || null : value,
    ),
    ValidateBy({
      name: 'isTvaIntracom',
      validator: {
        validate: (v) => v === null || isTvaIntracom(v),
        defaultMessage: () => 'N° de TVA intracommunautaire invalide (ex. FR40303265045).',
      },
    }),
  );
}
