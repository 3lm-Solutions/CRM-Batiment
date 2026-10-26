import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';

/** « FR76 3000 6000 … » → « FR7630006000… » (spaces and case are only for reading). */
export const compactIban = (v: string) => v.replace(/\s+/g, '').toUpperCase();

/** IBAN with its ISO 13616 check digits (mod 97 = 1), 15 to 34 characters. */
export function isIban(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const iban = compactIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const n = ch >= 'A' ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const d of n) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** BIC / SWIFT: 8 or 11 characters. */
export const isBic = (value: unknown) => typeof value === 'string' && /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.trim().toUpperCase());

/** IBAN field (stored compact, upper case; empty → null). */
export function IsIban() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? compactIban(value) || null : value)),
    ValidateBy({ name: 'isIban', validator: { validate: (v) => v === null || isIban(v), defaultMessage: () => 'IBAN invalide (vérifiez les chiffres).' } }),
  );
}

/** BIC field (stored upper case; empty → null). */
export function IsBic() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value)),
    ValidateBy({ name: 'isBic', validator: { validate: (v) => v === null || isBic(v), defaultMessage: () => 'BIC invalide (8 ou 11 caractères, ex. BNPAFRPPXXX).' } }),
  );
}
