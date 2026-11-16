import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsBic, IsIban, NormalizeEmail, Trim, TrimOrNull, IsPhone } from '../../../../common';

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(150)
  nom?: string;

  @ApiPropertyOptional({ example: '12345678901234' })
  @IsOptional()
  @TrimOrNull()
  @Matches(/^\d{14}$/, { message: 'Le SIRET doit contenir 14 chiffres' })
  siret?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;

  /**
   * Logo shown in the client space and on the quote link (B3 of 20/10). Stored as a data URL,
   * like the signatures: the public pages show it without a login. null = remove it.
   */
  @ApiPropertyOptional({
    nullable: true,
    description: 'Logo PNG, JPEG ou WebP en base64 (data:image/…;base64,…), 300 Ko max',
  })
  @IsOptional()
  @IsString()
  @MaxLength(420_000, { message: 'Logo trop volumineux (300 Ko max)' })
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, {
    message: 'Le logo doit être une image PNG, JPEG ou WebP.',
  })
  logo?: string | null;

  /** Printed on invoices with a payment QR code (SEPA EPC) — 21/10. null = remove. */
  @ApiPropertyOptional({ nullable: true, example: 'FR76 3000 6000 0112 3456 7890 189' })
  @IsOptional()
  @IsIban()
  iban?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'BNPAFRPPXXX' })
  @IsOptional()
  @IsBic()
  bic?: string | null;
}

const MONEY = { maxDecimalPlaces: 2 };

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(100)
  tvaDefaut?: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsIn(['EUR'])
  devise?: string;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(100)
  acomptePercentDefault?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(95)
  margeCiblePourcent?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(95)
  seuilAlerteMargePourcent?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  fraisFixeDeplacement?: number;

  @ApiPropertyOptional({ example: 0.01, description: 'Pas d’arrondi des prix suggérés' })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(1000)
  pasArrondiPrix?: number;

  /** Étape 2 (26/10): SAV possible during N months after the end of the works (0 = no limit). */
  @ApiPropertyOptional({
    example: 12,
    description: 'Durée du SAV après la fin des travaux, en mois (0 = sans limite)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  savDureeMois?: number;

  /** 29/10: market prices computed on the signed quotes / supplier orders of the last N months. */
  @ApiPropertyOptional({
    example: 12,
    enum: [6, 12, 24],
    description: 'Période du prix de marché, en mois',
  })
  @IsOptional()
  @IsIn([6, 12, 24])
  prixMarcheMois?: number;
}
