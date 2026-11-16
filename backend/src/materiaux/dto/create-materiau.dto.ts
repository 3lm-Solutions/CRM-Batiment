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

export class CreateMateriauDto {
  @ApiProperty({
    example: 'Carrelage grès cérame 60x60',
    description: 'Nom du matériau',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du matériau est obligatoire' })
  nom: string;

  @ApiPropertyOptional({
    example: 'Gris anthracite',
    description: 'Couleur du matériau',
  })
  @IsOptional()
  @IsString()
  couleur?: string;

  @ApiPropertyOptional({ example: 'Mat', description: 'Finition du matériau' })
  @IsOptional()
  @IsString()
  finition?: string;

  @ApiPropertyOptional({
    enum: Unite,
    example: Unite.M2,
    description: 'Unité de mesure',
    default: Unite.PIECE,
  })
  @IsOptional()
  @IsEnum(Unite, { message: 'Unité invalide' })
  unite?: Unite;

  @ApiProperty({ example: 18.5, description: "Prix d'achat fixe (€)" })
  @IsNumber({}, { message: 'prixAchatFixe doit être un nombre' })
  @Min(0, { message: 'prixAchatFixe doit être positif' })
  prixAchatFixe: number;

  @ApiPropertyOptional({ example: 1, description: 'ID du fournisseur' })
  @IsOptional()
  @IsInt({ message: 'fournisseurId doit être un entier' })
  fournisseurId?: number;
}
