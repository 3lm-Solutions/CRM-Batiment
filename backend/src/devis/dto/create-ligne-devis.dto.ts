import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unite } from '../../../generated/prisma/client.js';

export class CreateLigneDevisDto {
  @ApiPropertyOptional({ example: 1, description: 'ID prestation catalogue' })
  @IsOptional()
  @IsInt()
  prestationId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID matériau' })
  @IsOptional()
  @IsInt()
  materiauId?: number;

  @ApiPropertyOptional({ example: 1, description: "ID service main d'œuvre" })
  @IsOptional()
  @IsInt()
  serviceMainOeuvreId?: number;

  @ApiPropertyOptional({ example: 'Carrelage sol grès cérame 60x60' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 8.0, description: 'Quantité' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  quantite: number;

  @ApiPropertyOptional({ enum: Unite, example: Unite.M2, default: Unite.M2 })
  @IsOptional()
  @IsEnum(Unite)
  unite?: Unite;

  @ApiPropertyOptional({ example: '60x60cm' })
  @IsOptional()
  @IsString()
  dimension?: string;

  @ApiPropertyOptional({ example: 'Gris anthracite' })
  @IsOptional()
  @IsString()
  couleur?: string;

  @ApiPropertyOptional({ example: 'Mat' })
  @IsOptional()
  @IsString()
  finition?: string;

  @ApiPropertyOptional({
    example: 45.0,
    description:
      'Prix unitaire de vente HT (auto-calculé si prestationId fourni)',
  })
  @IsOptional()
  @IsNumber()
  prixUnitaireVente?: number;

  @ApiPropertyOptional({
    example: 25.0,
    description: "Prix d'achat unitaire (coût)",
  })
  @IsOptional()
  @IsNumber()
  prixAchat?: number;

  @ApiPropertyOptional({
    example: 15.0,
    description: "Coût main d'œuvre unitaire",
  })
  @IsOptional()
  @IsNumber()
  mainOeuvre?: number;

  @ApiPropertyOptional({ example: 1, description: "Ordre d'affichage" })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordre?: number;
}
