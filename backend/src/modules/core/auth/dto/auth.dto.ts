import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsAppPassword, IsSignaturePng, NormalizeEmail, Trim, TrimOrNull, IsPhone } from '../../../../common';

export class LoginDto {
  @ApiProperty({ example: 'admin@batiment-pro.fr' })
  @NormalizeEmail()
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  /** No strength rule here: an existing password is checked, not chosen */
  @ApiProperty({ example: 'Admin@2026!' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @MaxLength(72)
  password: string;
}

export class ChangePasswordDto {
  /** v2: required. The old endpoint changed the password with the token alone. */
  @ApiProperty({ description: 'Mot de passe actuel (ou temporaire)' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  @MaxLength(72)
  currentPassword: string;

  @IsAppPassword()
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'technico@batiment-pro.fr' })
  @NormalizeEmail()
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;
}

export class VerifyResetCodeDto extends ForgotPasswordDto {
  @ApiProperty({ example: '482913', description: 'Code à 6 chiffres reçu par email' })
  @Trim()
  @Matches(/^\d{6}$/, { message: 'Le code doit contenir 6 chiffres' })
  code: string;
}

export class ResetPasswordDto extends VerifyResetCodeDto {
  @IsAppPassword()
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom?: string;

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional()
  @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional({ description: 'Nouvel email — exige currentPassword' })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail({}, { message: "L'email doit être valide" })
  email?: string;

  @ApiPropertyOptional({ description: "Obligatoire pour changer d'email" })
  @ValidateIf((dto: UpdateProfileDto) => dto.email !== undefined)
  @IsString()
  @IsNotEmpty({ message: "Le mot de passe actuel est obligatoire pour changer d'email" })
  currentPassword?: string;
}

export class SaveSignatureDto {
  @IsSignaturePng()
  signatureBase64: string;
}
