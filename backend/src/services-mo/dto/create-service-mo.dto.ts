import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unite } from '../../../generated/prisma/client.js';

export class CreateServiceMoDto {
  @ApiProperty({
    example: 'Pose carrelage',
    description: "Nom du service de main d'œuvre",
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du service est obligatoire' })
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

  @ApiProperty({ example: 25, description: 'Prix unitaire (€)' })
  @IsNumber({}, { message: 'prixUnitaire doit être un nombre' })
  @Min(0, { message: 'prixUnitaire doit être positif' })
  prixUnitaire: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Productivité par jour (ex: 15 m²/jour)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'productiviteJour doit être un nombre' })
  @Min(0)
  productiviteJour?: number;

  @ApiPropertyOptional({
    example: 250,
    description: "Coût journalier de l'ouvrier (€/jour)",
  })
  @IsOptional()
  @IsNumber({}, { message: 'coutJournalier doit être un nombre' })
  @Min(0)
  coutJournalier?: number;
}
