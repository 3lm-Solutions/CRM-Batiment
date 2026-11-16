import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryFacturesDto {
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
    enum: ['BROUILLON', 'ENVOYEE', 'PAYEE', 'ANNULEE'],
  })
  @IsOptional()
  @IsIn(['BROUILLON', 'ENVOYEE', 'PAYEE', 'ANNULEE'])
  statut?: 'BROUILLON' | 'ENVOYEE' | 'PAYEE' | 'ANNULEE';

  @ApiPropertyOptional({
    example: 'FAC-2026',
    description: 'Recherche par reference facture, devis ou client',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
