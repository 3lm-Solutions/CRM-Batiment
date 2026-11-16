import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, Trim, TrimOrNull } from '../../../common';
import { PointageStatut } from '../../../generated/prisma/client';

/** Hours of one day on one job site, entered by the sous-traitant in his portal (21/10). */
export class CreatePointageDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  chantierId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  tacheId?: number | null;

  @ApiProperty({ example: '2026-10-21', description: 'Jour travaillé' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 7.5, description: 'Heures (par quart d’heure : 0,25 à 24)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  heures: number;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(500)
  commentaire?: string | null;
}

export class QueryMesPointagesDto {
  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Mois (AAAA-MM), le mois courant par défaut',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mois au format AAAA-MM' })
  mois?: string;
}

export class QueryPointagesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PointageStatut })
  @IsOptional()
  @IsEnum(PointageStatut)
  statut?: PointageStatut;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sousTraitantId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  du?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  au?: string;
}

export class ValiderPointagesDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids: number[];
}

export class RefuserPointageDto {
  @ApiProperty({ example: 'Pas présent ce jour-là' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motif: string;
}
