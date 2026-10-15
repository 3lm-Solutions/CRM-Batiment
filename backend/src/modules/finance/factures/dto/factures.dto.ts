import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, ToStringArray, Trim, TrimOrNull } from '../../../../common';
import { FactureStatut, FactureType } from '../../../../generated/prisma/client';

export class QueryFacturesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FactureStatut, isArray: true })
  @IsOptional() @ToStringArray() @IsArray() @IsEnum(FactureStatut, { each: true })
  statuts?: FactureStatut[];

  @ApiPropertyOptional({ enum: FactureType }) @IsOptional() @IsEnum(FactureType)
  type?: FactureType;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  devisId?: number;
}

export class CreateSituationDto {
  @ApiProperty({ example: 40, description: 'Avancement CUMULÉ facturé (%), strictement inférieur à 100' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(99.99)
  avancementCumule: number;
}

export class UpdateFactureDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateEcheance?: string | null;

  @ApiPropertyOptional({ example: 'Paiement à 30 jours' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  conditionsPaiement?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  communicationPaiement?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(2000)
  notesLegales?: string | null;
}

export class FactureLigneDto {
  @ApiProperty() @Trim() @IsString() @IsNotEmpty() @MaxLength(1000)
  description: string;

  @ApiProperty({ example: 1 }) @IsNumber({ maxDecimalPlaces: 3 })
  quantite: number;

  @ApiPropertyOptional({ example: 'FORFAIT' }) @IsOptional() @Trim() @IsString() @MaxLength(20)
  unite?: string;

  @ApiProperty({ example: 250 }) @IsNumber({ maxDecimalPlaces: 2 })
  prixUnitaireHT: number;
}

export class EmettreFactureDto {
  @ApiPropertyOptional({ default: true, description: 'Envoyer un email au client après émission' })
  @IsOptional() @IsBoolean()
  envoyerEmail?: boolean;
}

export class PayerFactureDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  datePaiement?: string;

  @ApiPropertyOptional({ example: 'VIR-2026-0412' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(100)
  referencePaiement?: string | null;
}

export class AnnulerFactureDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(500)
  motif?: string;
}
