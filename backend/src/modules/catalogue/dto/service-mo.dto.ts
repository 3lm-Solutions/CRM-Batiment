import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateServiceMoDto {
  @IsString()
  nom: string;

  @IsNumber()
  @Min(0)
  prixUnitaire: number;

  @IsOptional()
  @IsString()
  unite?: string; // M2, ML, PIECE, etc.

  @IsOptional()
  @IsNumber()
  @Min(0)
  productiviteJour?: number; // m² par jour

  @IsOptional()
  @IsNumber()
  @Min(0)
  coutJournalier?: number; // Coût réel du jour
}

export class UpdateServiceMoDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @IsOptional()
  @IsString()
  unite?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  productiviteJour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coutJournalier?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class ServiceMoQueryDto {
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

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
