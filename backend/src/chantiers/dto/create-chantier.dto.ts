import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ChantierStatut } from '../../../generated/prisma/client.js';

export class CreateChantierDto {
  @ApiProperty({
    example: 12,
    description: 'ID du client rattache au chantier',
  })
  @Type(() => Number)
  @IsInt()
  clientId!: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'ID utilisateur chef de chantier (optionnel)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chefChantierId?: number;

  @ApiPropertyOptional({
    example: 'CH-2026-0012',
    description: 'Reference chantier (auto-generee si absente)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiProperty({
    example: '24 Rue des Lilas, 75020 Paris',
    description: 'Adresse chantier',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  adresse!: string;

  @ApiPropertyOptional({
    example: 'Renovation complete salon + cuisine, contraintes acoustiques.',
    description: 'Description detaillee du chantier',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ChantierStatut,
    description: 'Statut initial du chantier',
  })
  @IsOptional()
  @IsEnum(ChantierStatut)
  statut?: ChantierStatut;

  @ApiPropertyOptional({
    example: '2026-04-10',
    description: 'Date debut chantier',
  })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({
    example: '2026-05-30',
    description: 'Date fin previsionnelle',
  })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({
    example: 'Acces chantier uniquement entre 8h et 17h.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
