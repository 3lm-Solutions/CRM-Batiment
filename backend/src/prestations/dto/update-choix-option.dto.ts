import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateChoixOptionDto {
  @ApiPropertyOptional({
    example: 'Cloison en plâtre',
    description: 'Nom du choix',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nom?: string;

  @ApiPropertyOptional({
    example: 'Cloison traditionnelle en carreaux de plâtre',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 5.0,
    description: 'Impact sur le prix (€/unité)',
  })
  @IsOptional()
  @Type(() => Number)
  impactPrix?: number;

  @ApiPropertyOptional({ example: 0, description: "Ordre d'affichage" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordre?: number;
}
