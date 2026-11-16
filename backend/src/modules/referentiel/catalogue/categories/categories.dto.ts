import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean, Trim, TrimOrNull } from '../../../../common';

export class CreateCategorieDto {
  @ApiProperty({ example: 'Carrelage' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateCategorieDto extends PartialType(CreateCategorieDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class CreateSousCategorieDto extends CreateCategorieDto {}
export class UpdateSousCategorieDto extends UpdateCategorieDto {}

export class QueryCategoriesDto {
  @ApiPropertyOptional({ description: 'Absent = toutes ; true = actives seulement' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  actif?: boolean;
}
