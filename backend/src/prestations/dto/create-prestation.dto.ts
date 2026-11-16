import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unite } from '../../../generated/prisma/client.js';

export class CreatePrestationDto {
  @ApiProperty({ example: 1, description: 'ID de la catégorie de prestation' })
  @IsInt({ message: 'categorieId doit être un entier' })
  categorieId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID de la sous-catégorie (optionnel)',
  })
  @IsOptional()
  @IsInt({ message: 'sousCategorieId doit être un entier' })
  sousCategorieId?: number;

  @ApiProperty({
    example: 'Pose carrelage sol 60x60',
    description: 'Nom de la prestation',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la prestation est obligatoire' })
  nom: string;

  @ApiPropertyOptional({
    enum: Unite,
    example: Unite.M2,
    description: 'Unité de mesure',
    default: Unite.M2,
  })
  @IsOptional()
  @IsEnum(Unite, { message: 'Unité invalide' })
  unite?: Unite;

  @ApiProperty({ example: 35, description: 'Prix de vente minimum (€)' })
  @IsNumber({}, { message: 'prixVenteMin doit être un nombre' })
  @Min(0, { message: 'prixVenteMin doit être positif' })
  prixVenteMin: number;

  @ApiProperty({ example: 55, description: 'Prix de vente maximum (€)' })
  @IsNumber({}, { message: 'prixVenteMax doit être un nombre' })
  @Min(0, { message: 'prixVenteMax doit être positif' })
  prixVenteMax: number;

  @ApiPropertyOptional({
    example: 'Pose de carrelage au sol format 60x60 cm',
    description: 'Description détaillée',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
