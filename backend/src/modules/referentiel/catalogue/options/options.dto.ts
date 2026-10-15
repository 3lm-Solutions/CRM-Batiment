import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Trim, TrimOrNull } from '../../../../common';

export class CreateOptionDto {
  @ApiProperty({ example: 'Type de chape' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ default: false, description: 'Un choix est obligatoire dans le devis' })
  @IsOptional() @IsBoolean()
  obligatoire?: boolean;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0)
  ordre?: number;
}

export class UpdateOptionDto extends PartialType(CreateOptionDto) {}

export class CreateChoixDto {
  @ApiProperty({ example: 'Chape fibrée' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ example: 5, description: 'Supplément (ou remise si négatif) sur le prix de vente unitaire HT' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  impactPrix?: number;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0)
  ordre?: number;
}

export class UpdateChoixDto extends PartialType(CreateChoixDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;
}
