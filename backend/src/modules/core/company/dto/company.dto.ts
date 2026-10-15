import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { NormalizeEmail, Trim, TrimOrNull, IsPhone } from '../../../../common';

export class UpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(150)
  nom?: string;

  @ApiPropertyOptional({ example: '12345678901234' })
  @IsOptional() @TrimOrNull() @Matches(/^\d{14}$/, { message: 'Le SIRET doit contenir 14 chiffres' })
  siret?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional() @IsOptional() @NormalizeEmail() @IsEmail()
  email?: string;
}

const MONEY = { maxDecimalPlaces: 2 };

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsNumber(MONEY) @Min(0) @Max(100)
  tvaDefaut?: number;

  @ApiPropertyOptional({ example: 'EUR' }) @IsOptional() @IsIn(['EUR'])
  devise?: string;

  @ApiPropertyOptional({ example: 35 }) @IsOptional() @IsNumber(MONEY) @Min(0) @Max(100)
  acomptePercentDefault?: number;

  @ApiPropertyOptional({ example: 30 }) @IsOptional() @IsNumber(MONEY) @Min(0) @Max(95)
  margeCiblePourcent?: number;

  @ApiPropertyOptional({ example: 15 }) @IsOptional() @IsNumber(MONEY) @Min(0) @Max(95)
  seuilAlerteMargePourcent?: number;

  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsNumber(MONEY) @Min(0)
  fraisFixeDeplacement?: number;

  @ApiPropertyOptional({ example: 0.01, description: 'Pas d’arrondi des prix suggérés' })
  @IsOptional() @IsNumber(MONEY) @Min(0.01) @Max(1000)
  pasArrondiPrix?: number;
}
