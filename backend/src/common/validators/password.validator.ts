import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MaxLength } from 'class-validator';
import { PASSWORD_POLICY } from '../../shared';

/**
 * One password policy for the whole app (the old code used 6 in one DTO, 8 in another).
 * MaxLength 72: bcrypt ignores everything after 72 bytes.
 */
export function IsAppPassword(description = 'Nouveau mot de passe') {
  return applyDecorators(
    ApiProperty({
      description: `${description}. ${PASSWORD_POLICY.description}`,
      example: 'Chantier2026',
    }),
    IsString(),
    MaxLength(72),
    IsStrongPassword(
      {
        minLength: PASSWORD_POLICY.minLength,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 0,
      },
      { message: `Mot de passe trop faible. ${PASSWORD_POLICY.description}` },
    ),
  );
}
