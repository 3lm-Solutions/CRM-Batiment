import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, ToBoolean, Trim, TrimOrNull } from '../../../../common';
import { Unite } from '../../../../generated/prisma/client';

export class CreatePrestationDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  categorieId: number;

  @ApiPropertyOptional({ description: 'Doit appartenir à la catégorie' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sousCategorieId?: number | null;

  @ApiProperty({ example: 'Pose carrelage sol' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ enum: Unite, default: Unite.M2 })
  @IsOptional()
  @IsEnum(Unite)
  unite?: Unite;

  @ApiProperty({ example: 40, description: 'Prix de vente HT unitaire minimum' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixVenteMin: number;

  @ApiProperty({ example: 65 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixVenteMax: number;

  /** Sent by the create form too (default true). Was accepted on update only: every creation failed with 400. */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class UpdatePrestationDto extends PartialType(CreatePrestationDto) {}

export class QueryPrestationsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  categorieId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sousCategorieId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  actif?: boolean;
}
