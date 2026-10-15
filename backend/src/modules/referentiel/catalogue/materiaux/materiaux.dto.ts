import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto, ToBoolean, Trim, TrimOrNull } from '../../../../common';
import { Unite } from '../../../../generated/prisma/client';

export class CreateMateriauDto {
  @ApiProperty({ example: 'Carrelage grès cérame 60x60' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  nom: string;

  @ApiPropertyOptional({ example: 'Gris anthracite' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(60)
  couleur?: string | null;

  @ApiPropertyOptional({ example: 'Mat' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(60)
  finition?: string | null;

  @ApiPropertyOptional({ enum: Unite, default: Unite.PIECE }) @IsOptional() @IsEnum(Unite)
  unite?: Unite;

  @ApiProperty({ example: 18.5, description: "Prix d'achat HT unitaire" })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  prixAchatFixe: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  fournisseurId?: number | null;

  @ApiPropertyOptional({ example: 20, description: 'Seuil d’alerte de stock' })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0)
  stockMinimum?: number;
}

/** stockActuel is NOT editable here: it only changes through stock movements (Step 8). */
export class UpdateMateriauDto extends PartialType(CreateMateriauDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;
}

export class QueryMateriauxDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  fournisseurId?: number;

  @ApiPropertyOptional({ enum: Unite }) @IsOptional() @IsEnum(Unite)
  unite?: Unite;

  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean()
  actif?: boolean;
}
