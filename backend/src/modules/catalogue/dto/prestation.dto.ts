import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsEnum,
} from 'class-validator';

export class CreatePrestationDto {
  @IsString()
  nom: string;

  @IsNumber()
  categorieId: number;

  @IsOptional()
  @IsNumber()
  sousCategorieId?: number;

  @IsNumber()
  @Min(0)
  prixVenteMin: number;

  @IsNumber()
  @Min(0)
  prixVenteMax: number;

  @IsOptional()
  @IsString()
  unite?: string; // M2, ML, PIECE, etc.

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePrestationDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixVenteMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixVenteMax?: number;

  @IsOptional()
  @IsString()
  unite?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class PrestationQueryDto {
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @IsNumber()
  categorieId?: number;

  @IsOptional()
  @IsNumber()
  sousCategorieId?: number;

  @IsOptional()
  @IsNumber()
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  offset?: number = 0;
}

export class AddCompositionDto {
  @IsOptional()
  @IsNumber()
  materiauId?: number;

  @IsOptional()
  @IsNumber()
  serviceMainOeuvreId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantiteParUnite?: number;
}

export class AddOptionDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  obligatoire?: boolean;

  @IsOptional()
  @IsNumber()
  ordre?: number;
}

export class AddChoixOptionDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  impactPrix?: number;

  @IsOptional()
  @IsNumber()
  ordre?: number;
}
