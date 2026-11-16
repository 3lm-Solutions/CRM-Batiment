import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FactureLigneInputDto {
  @ApiProperty({ example: 'Pose placo mur salon' })
  @IsString()
  @MaxLength(400)
  description!: string;

  @ApiPropertyOptional({ example: '2026-04-08' })
  @IsOptional()
  @IsISO8601()
  datePrestation?: string;

  @ApiProperty({ example: 12.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantite!: number;

  @ApiProperty({ example: 'm2' })
  @IsString()
  @MaxLength(20)
  unite!: string;

  @ApiProperty({ example: 45.8 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prixUnitaireHT!: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  tauxTVA?: number;
}
