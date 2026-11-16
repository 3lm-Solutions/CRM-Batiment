import { IsOptional, IsInt, IsString, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryMateriauDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Numéro de page',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Éléments par page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'carrelage',
    description: 'Recherche dans le nom',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Filtrer par fournisseur',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fournisseurId?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtrer par statut actif/inactif',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  actif?: boolean;
}
