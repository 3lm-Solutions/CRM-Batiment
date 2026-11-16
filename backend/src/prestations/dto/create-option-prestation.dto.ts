import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateChoixOptionDto {
  @ApiProperty({ example: 'Cloison en plâtre', description: 'Nom du choix' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiPropertyOptional({
    example: 'Cloison traditionnelle en carreaux de plâtre',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 5.0,
    description: 'Impact sur le prix (€/unité)',
    default: 0,
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

export class CreateOptionPrestationDto {
  @ApiProperty({ example: 1, description: 'ID de la prestation' })
  @IsInt()
  prestationId: number;

  @ApiProperty({ example: 'Type de cloison', description: "Nom de l'option" })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiPropertyOptional({ example: 'Choisir le type de cloison à démolir' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Option obligatoire ?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  obligatoire?: boolean;

  @ApiPropertyOptional({ example: 0, description: "Ordre d'affichage" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordre?: number;

  @ApiPropertyOptional({
    type: [CreateChoixOptionDto],
    description: 'Choix possibles pour cette option',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChoixOptionDto)
  choix?: CreateChoixOptionDto[];
}
