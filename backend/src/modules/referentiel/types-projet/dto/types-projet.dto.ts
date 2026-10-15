import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean, ToIntArray, Trim, TrimOrNull } from '../../../../common';

export class CreateTypeProjetDto {
  @ApiProperty({ example: 'Rénovation salle de bain' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Catégories de prestations proposées pour ce type de projet, dans l’ordre d’affichage',
  })
  @IsOptional() @ToIntArray() @IsArray() @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true })
  categorieIds?: number[];
}

export class UpdateTypeProjetDto extends PartialType(CreateTypeProjetDto) {
  @ApiPropertyOptional({ description: 'false = désactiver (masqué des formulaires)' })
  @IsOptional() @IsBoolean()
  actif?: boolean;
}

export class QueryTypesProjetDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional() @ToBoolean() @IsBoolean()
  actif?: boolean = true;
}
