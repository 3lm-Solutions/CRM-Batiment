import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimOrNull } from '../../../../common';
import { Unite } from '../../../../generated/prisma/client';

/**
 * Two kinds of lines:
 *  - from the catalogue: prestationId (+ choixIds). Costs and suggested price come from the
 *    pricing engine; prixUnitaireVente may override the suggestion.
 *  - free line: description + prixUnitaireVente required (costs optional).
 */
export class AddLigneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  prestationId?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(1, { each: true })
  choixIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  materiauId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  serviceMainOeuvreId?: number;

  @ApiPropertyOptional({ description: 'Obligatoire pour une ligne libre' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({ example: 14.5 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantite: number;

  @ApiPropertyOptional({ enum: Unite })
  @IsOptional()
  @IsEnum(Unite)
  unite?: Unite;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(100)
  dimension?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(60)
  couleur?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(60)
  finition?: string | null;

  @ApiPropertyOptional({
    description: 'Prix de vente unitaire HT (défaut : prix suggéré du catalogue)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaireVente?: number;

  @ApiPropertyOptional({ description: 'Coût matériaux unitaire (défaut : calculé)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixAchat?: number;

  @ApiPropertyOptional({ description: 'Coût main d’œuvre unitaire (défaut : calculé)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mainOeuvre?: number;
}

/** A catalogue line keeps its prestation; choices can be changed (costs are re-priced). */
export class UpdateLigneDto {
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(1, { each: true })
  choixIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantite?: number;

  @ApiPropertyOptional({ enum: Unite })
  @IsOptional()
  @IsEnum(Unite)
  unite?: Unite;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(100)
  dimension?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(60)
  couleur?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(60)
  finition?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixUnitaireVente?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixAchat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mainOeuvre?: number;
}
