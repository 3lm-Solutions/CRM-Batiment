import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateMateriauxDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  couleur?: string;

  @IsOptional()
  @IsString()
  finition?: string;

  @IsNumber()
  @Min(0)
  prixAchatFixe: number;

  @IsOptional()
  @IsString()
  unite?: string; // PIECE, M2, ML, etc.

  @IsOptional()
  @IsNumber()
  fournisseurId?: number;
}

export class UpdateMateriauxDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  couleur?: string;

  @IsOptional()
  @IsString()
  finition?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixAchatFixe?: number;

  @IsOptional()
  @IsString()
  unite?: string;

  @IsOptional()
  @IsNumber()
  fournisseurId?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class MateriauxQueryDto {
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @IsString()
  couleur?: string;

  @IsOptional()
  @IsString()
  finition?: string;

  @IsOptional()
  @IsNumber()
  fournisseurId?: number;

  @IsOptional()
  @IsString()
  orderBy?: string;

  @IsOptional()
  @IsNumber()
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  offset?: number = 0;
}
