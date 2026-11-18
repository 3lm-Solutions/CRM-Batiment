import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, ToStringArray, TrimOrNull } from '../../../common';
import { DepenseStatut } from '../../../generated/prisma/client';

/** Fields the phone may flag as « read with a doubt » by the OCR (shown highlighted to the office). */
export const CHAMPS_OCR = [
  'fournisseur',
  'numeroFacture',
  'dateFacture',
  'montantHT',
  'montantTVA',
  'montantTTC',
] as const;

/**
 * 18/11 (mobile lot A): supplier invoice read on the phone (multipart: `fichier` + these fields).
 * Numbers arrive as text in a multipart form: the global ValidationPipe converts them.
 */
export class CreerDepenseDto {
  @ApiPropertyOptional({ description: 'Fournisseur choisi dans la liste (sinon fournisseurNom)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  fournisseurId?: number;

  @ApiPropertyOptional({ example: 'Point P Lyon 3', description: 'Nom lu sur la facture' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(200)
  fournisseurNom?: string | null;

  @ApiProperty({ example: 'FA-2026-1187' })
  @TrimOrNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numeroFacture: string;

  @ApiProperty({ example: '2026-11-17' })
  @IsDateString()
  dateFacture: string;

  @ApiProperty({ example: 1250.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montantHT: number;

  @ApiProperty({ example: 250.1 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montantTVA: number;

  @ApiProperty({ example: 1500.6 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montantTTC: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  commandeFournisseurId?: number;

  @ApiPropertyOptional({
    enum: CHAMPS_OCR,
    isArray: true,
    description: 'Champs lus avec un doute (liste séparée par des virgules en multipart)',
  })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @ArrayMaxSize(CHAMPS_OCR.length)
  @IsIn(CHAMPS_OCR, { each: true })
  champsDouteux?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ example: 45.75 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 4.85 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

/** Corrections while the dépense is still a draft (JSON). */
export class ModifierDepenseDto extends PartialType(
  OmitType(CreerDepenseDto, ['latitude', 'longitude'] as const),
) {}

export class QueryDepensesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DepenseStatut })
  @IsOptional()
  @IsEnum(DepenseStatut)
  statut?: DepenseStatut;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;
}

export class RefuserDepenseDto {
  @ApiProperty({ example: 'Facture déjà payée par le siège' })
  @TrimOrNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motif: string;
}
