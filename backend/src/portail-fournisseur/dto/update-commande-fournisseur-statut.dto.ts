import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CommandeFournisseurStatut } from '../../../generated/prisma/client.js';

export class UpdateCommandeFournisseurStatutDto {
  @ApiProperty({
    enum: CommandeFournisseurStatut,
    description: 'Nouveau statut logistique applique par le fournisseur',
  })
  @IsEnum(CommandeFournisseurStatut)
  statutLivraison!: CommandeFournisseurStatut;

  @ApiPropertyOptional({
    example: '2026-04-01',
    description: 'Date de livraison prevue communiquee par le fournisseur',
  })
  @IsOptional()
  @IsISO8601()
  dateLivraisonPrevue?: string;

  @ApiPropertyOptional({
    example: 'Disponibilite confirmee. Expedition demain matin.',
    description: 'Note libre visible dans le suivi commande',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
