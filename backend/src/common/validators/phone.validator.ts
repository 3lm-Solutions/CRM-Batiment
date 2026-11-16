import { applyDecorators } from '@nestjs/common';
import { MaxLength, ValidateBy } from 'class-validator';

export const PHONE_MESSAGE =
  'Numéro de téléphone invalide : 8 à 15 chiffres (ex. 06 12 34 56 78, +33 6 12 34 56 78, +216 22 123 456).';

/**
 * French AND foreign numbers: digits with spaces, dots, dashes or brackets, an optional leading +,
 * 8 to 15 digits (international standard). The old check only accepted French 06… numbers.
 */
export function isPhone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!/^\+?[\d\s.\-()/]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, '').length;
  return digits >= 8 && digits <= 15;
}

/** Phone field of a DTO (use after @IsOptional() / @TrimOrNull()). */
export function IsPhone() {
  return applyDecorators(
    MaxLength(25, { message: PHONE_MESSAGE }),
    ValidateBy({
      name: 'isPhone',
      validator: { validate: isPhone, defaultMessage: () => PHONE_MESSAGE },
    }),
  );
}
