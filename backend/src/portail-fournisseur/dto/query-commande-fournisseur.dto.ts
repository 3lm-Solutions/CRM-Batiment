import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CommandeFournisseurStatut } from '../../../generated/prisma/client.js';

export class QueryCommandeFournisseurDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Numero de page',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Elements par page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'BAF-2026-0004',
    description:
      'Recherche sur la reference commande, devis, client ou chantier',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: CommandeFournisseurStatut,
    description: 'Filtre sur le statut logistique de la commande',
  })
  @IsOptional()
  @IsEnum(CommandeFournisseurStatut)
  statutLivraison?: CommandeFournisseurStatut;
}
