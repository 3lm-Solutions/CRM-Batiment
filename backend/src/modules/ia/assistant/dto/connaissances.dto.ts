import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto, ToBoolean, Trim } from '../../../../common';

export class CreateConnaissanceDto {
  @ApiProperty({ example: 'Délais d’intervention' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  titre: string;

  @ApiProperty({ example: 'Délais', description: 'Regroupement libre : Services, Délais, Devis, Zone, Garanties…' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(60)
  categorie: string;

  @ApiProperty({ description: 'Texte que l’assistant peut citer. Jamais de prix, de marge ni de conditions fournisseur.' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(8000)
  contenu: string;

  @ApiPropertyOptional({ default: 0, description: '0–10 : départage les documents également pertinents' })
  @IsOptional() @IsInt() @Min(0) @Max(10)
  priorite?: number;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  actif?: boolean;
}

export class UpdateConnaissanceDto extends PartialType(CreateConnaissanceDto) {}

export class QueryConnaissancesDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @MaxLength(60)
  categorie?: string;

  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean()
  actif?: boolean;
}

export class RechercheConnaissanceDto {
  @ApiProperty({ example: 'combien de temps pour isoler des combles' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(300)
  q: string;
}
