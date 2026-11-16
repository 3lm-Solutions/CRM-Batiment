import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '../../../generated/prisma/client.js';

export class CreateDemandeDevisDto {
  @ApiProperty({ example: 1, description: 'ID du client associé' })
  @IsInt({ message: 'clientId doit être un entier' })
  @IsNotEmpty({ message: 'Le client est obligatoire' })
  clientId: number;

  @ApiProperty({
    example: 'Rénovation complète salle de bain 8m², carrelage + plomberie',
    description: 'Description du besoin',
  })
  @IsString()
  @IsNotEmpty({ message: 'La description est obligatoire' })
  description: string;

  @ApiPropertyOptional({
    enum: LeadSource,
    example: LeadSource.APPEL,
    description: 'Source de la demande',
  })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({
    example: {
      typeTravaux: 'Rénovation salle de bain',
      surface: 8,
      unite: 'm²',
      materiaux: ['carrelage', 'faïence'],
      urgence: 'normal',
      budget: '5000-8000€',
    },
    description:
      'Besoin structuré (JSON libre, collecté par chatbot ou manuellement)',
  })
  @IsOptional()
  @IsObject()
  besoinStructure?: Record<string, any>;
}
