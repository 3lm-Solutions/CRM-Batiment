import { IsOptional, IsInt, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryDevisDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'BROUILLON',
    description: 'Filtrer par statut',
  })
  @IsOptional()
  @IsString()
  statut?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filtrer par client' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional({
    example: 'DEV-2026',
    description: 'Recherche par référence',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
