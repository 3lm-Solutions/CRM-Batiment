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
  Min,
} from 'class-validator';
import {
  SavTicketCategorie,
  SavTicketPriorite,
  SavTicketStatut,
} from '../../../generated/prisma/client.js';

export class CreateSavTicketDto {
  @ApiProperty({ example: 1, description: 'Client concerne par la reclamation' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId!: number;

  @ApiPropertyOptional({ example: 12, description: 'Devis lie au ticket SAV' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  devisId?: number;

  @ApiPropertyOptional({ example: 5, description: 'Facture liee au ticket SAV' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  factureId?: number;

  @ApiPropertyOptional({ example: 8, description: 'Chantier lie au ticket SAV' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional({ example: 3, description: 'Utilisateur assigne au traitement' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number;

  @ApiProperty({ example: 'Fissure constatee apres reception' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  titre!: string;

  @ApiProperty({ example: 'Le client signale une fissure au niveau du mur du salon.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({ enum: SavTicketStatut, default: SavTicketStatut.OUVERT })
  @IsOptional()
  @IsEnum(SavTicketStatut)
  statut?: SavTicketStatut;

  @ApiPropertyOptional({ enum: SavTicketPriorite, default: SavTicketPriorite.NORMALE })
  @IsOptional()
  @IsEnum(SavTicketPriorite)
  priorite?: SavTicketPriorite;

  @ApiPropertyOptional({ enum: SavTicketCategorie, default: SavTicketCategorie.AUTRE })
  @IsOptional()
  @IsEnum(SavTicketCategorie)
  categorie?: SavTicketCategorie;

  @ApiPropertyOptional({ example: '2026-07-20', description: 'Date limite de traitement' })
  @IsOptional()
  @IsDateString()
  dateEcheance?: string;
}
