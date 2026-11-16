import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ChantierStatut } from '../../../generated/prisma/client.js';

export class QueryChantierDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Numero de page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Elements par page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'Dupont',
    description:
      'Recherche par client, reference chantier, adresse ou description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ChantierStatut,
    description: 'Filtrer par statut chantier',
  })
  @IsOptional()
  @IsEnum(ChantierStatut)
  statut?: ChantierStatut;
}
