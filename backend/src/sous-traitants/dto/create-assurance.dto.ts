import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssuranceDto {
  @ApiProperty({ example: 'Responsabilité Civile' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'AXA' })
  @IsOptional()
  @IsString()
  compagnie?: string;

  @ApiPropertyOptional({ example: 'POL-123456' })
  @IsOptional()
  @IsString()
  numeroPolice?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  dateDebut: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  dateExpiration: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  montantGarantie?: number;
}
