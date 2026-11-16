import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaiementDto {
  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montant: number;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'PAI-2026-007' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ default: 'EN_ATTENTE', example: 'PAYE' })
  @IsOptional()
  @IsString()
  statut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
