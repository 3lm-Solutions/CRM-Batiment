import { IsString, IsOptional, IsEmail, IsInt, IsNumber, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateSousTraitantDto {
  @IsString()
  nom: string;

  @IsString()
  @IsOptional()
  siret?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telephone?: string;

  @IsString()
  @IsOptional()
  adresse?: string;

  @IsString()
  @IsOptional()
  specialite?: string;

  @IsString()
  @IsOptional()
  statut?: string;
}

export class UpdateSousTraitantDto extends PartialType(CreateSousTraitantDto) {}

export class CreateContratSousTraitantDto {
  @IsInt()
  sousTraitantId: number;

  @IsInt()
  chantierId: number;

  @IsString()
  reference: string;

  @IsNumber()
  montantHT: number;

  @IsString()
  @IsOptional()
  statut?: string;

  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @IsDateString()
  @IsOptional()
  dateFin?: string;
}

export class UpdateContratSousTraitantDto extends PartialType(CreateContratSousTraitantDto) {}

export class CreateAssuranceSousTraitantDto {
  @IsInt()
  sousTraitantId: number;

  @IsString()
  typeAssurance: string;

  @IsString()
  numeroAttestation: string;

  @IsString()
  compagnieAssurance: string;

  @IsDateString()
  dateExpiration: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;

  @IsString()
  @IsOptional()
  statut?: string;
}

export class UpdateAssuranceSousTraitantDto extends PartialType(CreateAssuranceSousTraitantDto) {}

export class CreatePaiementSousTraitantDto {
  @IsInt()
  sousTraitantId: number;

  @IsInt()
  @IsOptional()
  contratId?: number;

  @IsNumber()
  montantHT: number;

  @IsNumber()
  montantTTC: number;

  @IsDateString()
  datePaiement: string;

  @IsString()
  modePaiement: string;

  @IsString()
  @IsOptional()
  statut?: string;
}

export class UpdatePaiementSousTraitantDto extends PartialType(CreatePaiementSousTraitantDto) {}

export class CreateDisponibiliteSousTraitantDto {
  @IsInt()
  sousTraitantId: number;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsBoolean()
  @IsOptional()
  disponible?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateDisponibiliteSousTraitantDto extends PartialType(CreateDisponibiliteSousTraitantDto) {}

export class CreateNotationSousTraitantDto {
  @IsInt()
  sousTraitantId: number;

  @IsInt()
  @IsOptional()
  chantierId?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  noteQualite: number;

  @IsInt()
  @Min(1)
  @Max(5)
  noteDelai: number;

  @IsInt()
  @Min(1)
  @Max(5)
  noteCommunication: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  noteGlobale: number;

  @IsString()
  @IsOptional()
  commentaire?: string;
}

export class UpdateNotationSousTraitantDto extends PartialType(CreateNotationSousTraitantDto) {}
