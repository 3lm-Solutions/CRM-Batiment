import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContratDto {
  @ApiPropertyOptional({ example: 'CTR-2026-001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebut: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montant: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'ACTIF', example: 'ACTIF' })
  @IsOptional()
  @IsString()
  statut?: string;
}
