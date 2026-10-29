import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../../../common';

export class ProposerDevisIaDto {
  @ApiProperty({
    example:
      'Rénovation salle de bain 8 m² : dépose de l’ancienne baignoire, douche à l’italienne, faïence murale et carrelage sol.',
  })
  @Trim()
  @IsString()
  @MinLength(10, { message: 'Décrivez les travaux en une phrase au moins (10 caractères).' })
  @MaxLength(3000)
  description: string;
}

/** Quote from photos (C37 of 21/10): multipart, files in « photos », optional text. */
export class ProposerPhotoIaDto {
  @ApiPropertyOptional({ example: 'Refaire la salle de bain, garder la baignoire.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(3000)
  description?: string;
}

export class LigneIaDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  prestationId: number;

  @ApiProperty({ example: 8 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(10_000)
  quantite: number;
}

/** The lines the technician kept (and possibly corrected) from the proposal. */
export class AppliquerDevisIaDto {
  @ApiProperty({ type: [LigneIaDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins une ligne.' })
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => LigneIaDto)
  lignes: LigneIaDto[];
}
