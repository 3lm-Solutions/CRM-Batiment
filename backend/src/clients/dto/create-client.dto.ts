import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsInt,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '../../../generated/prisma/client.js';
import { Type } from 'class-transformer';

export class CreateClientDto {
  @ApiProperty({ example: 'Dupont', description: 'Nom du client' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  nom: string;

  @ApiPropertyOptional({ example: 'Jean', description: 'Prénom du client' })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({ example: '0612345678', description: 'Téléphone' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({
    example: 'jean.dupont@email.fr',
    description: 'Email du client',
  })
  @IsOptional()
  @IsEmail({}, { message: "L'email doit être valide" })
  email?: string;

  @ApiPropertyOptional({
    example: '12 Rue de Paris, 75001 Paris',
    description: 'Adresse personnelle du client',
  })
  @IsOptional()
  @IsString()
  adresseClient?: string;

  @ApiPropertyOptional({
    example: '45 Avenue des Travaux, 69001 Lyon',
    description: 'Adresse du chantier',
  })
  @IsOptional()
  @IsString()
  adresseChantier?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID du type de projet' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeProjetId?: number;

  @ApiPropertyOptional({
    example: [1, 2],
    description: 'IDs des types de projet associes au client',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  typeProjetIds?: number[];

  @ApiPropertyOptional({
    enum: LeadSource,
    example: LeadSource.APPEL,
    description: "Source d'acquisition du client",
  })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({
    example: 'DEVIS',
    description:
      'Besoin rapide du client : DEVIS, CONTACT_RESPONSABLE, INFORMATION, VISITE_TECHNIQUE, URGENCE',
  })
  @IsOptional()
  @IsString()
  besoin?: string;

  @ApiPropertyOptional({
    example: 'Client recommandé par M. Martin',
    description: 'Notes libres',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
