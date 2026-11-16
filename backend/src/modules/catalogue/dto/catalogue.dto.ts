import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateCategorieDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategorieDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class CreateSousCategorieDto {
  @IsNumber()
  categorieId: number;

  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;
}
