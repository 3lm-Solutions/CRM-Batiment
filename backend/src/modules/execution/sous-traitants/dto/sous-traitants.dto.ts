import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { NormalizeEmail, PaginationQueryDto, Trim, TrimOrNull, IsPhone } from '../../../../common';
import {
  ModePaiement,
  PaiementStatut,
  SousTraitantStatut,
  TypeAssurance,
} from '../../../../generated/prisma/client';

const MONEY = { maxDecimalPlaces: 2 };

export class CreateSousTraitantDto {
  @ApiProperty({ example: 'Bernard Carrelage SARL' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(150)
  contact?: string | null;

  @ApiPropertyOptional({ example: '98765432100011' })
  @IsOptional() @TrimOrNull() @Matches(/^\d{14}$/, { message: 'Le SIRET doit contenir 14 chiffres' })
  siret?: string | null;

  @ApiPropertyOptional() @IsOptional() @NormalizeEmail() @IsEmail()
  email?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional({ example: 'Carrelage / Faïence' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(150)
  specialite?: string | null;

  @ApiPropertyOptional({ description: 'Compte SOUS_TRAITANT existant à rattacher dès la création (portail)' })
  @IsOptional() @IsInt() @Min(1)
  userId?: number | null;
}

/** The portal account changes through PUT /sous-traitants/:id/compte only. */
export class UpdateSousTraitantDto extends PartialType(OmitType(CreateSousTraitantDto, ['userId'] as const)) {
  @ApiPropertyOptional({ enum: SousTraitantStatut }) @IsOptional() @IsEnum(SousTraitantStatut)
  statut?: SousTraitantStatut;
}

export class QuerySousTraitantsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SousTraitantStatut }) @IsOptional() @IsEnum(SousTraitantStatut)
  statut?: SousTraitantStatut;
}

export class LierCompteDto {
  @ApiPropertyOptional({ nullable: true, description: 'Compte SOUS_TRAITANT (null = délier)' })
  @IsOptional() @IsInt() @Min(1)
  userId: number | null;
}

export class CreateContratDto {
  @ApiProperty() @IsInt() @Min(1)
  sousTraitantId: number;

  @ApiProperty() @IsInt() @Min(1)
  chantierId: number;

  @ApiProperty({ example: 4800 }) @IsNumber(MONEY) @Min(0)
  montantHT: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateFin?: string | null;
}

export class UpdateContratDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber(MONEY) @Min(0)
  montantHT?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateFin?: string | null;
}

export class CreateAssuranceDto {
  @ApiProperty({ enum: TypeAssurance }) @IsEnum(TypeAssurance)
  typeAssurance: TypeAssurance;

  @ApiProperty() @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  numeroAttestation: string;

  @ApiProperty({ example: 'SMABTP' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  compagnieAssurance: string;

  @ApiProperty({ example: '2027-03-31' }) @IsDateString()
  dateExpiration: string;

  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(1000)
  documentUrl?: string | null;

  /** Certificate uploaded first with POST /fichiers (Step 11) */
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  fichierId?: number | null;
}

/** `statut` is NOT editable: it is derived from dateExpiration. */
export class UpdateAssuranceDto extends PartialType(CreateAssuranceDto) {}

export class CreatePaiementDto {
  @ApiPropertyOptional({ description: 'Contrat réglé (doit appartenir au sous-traitant)' }) @IsOptional() @IsInt() @Min(1)
  contratId?: number | null;

  @ApiProperty({ example: 2000 }) @IsNumber(MONEY) @Min(0.01)
  montantHT: number;

  @ApiProperty({ example: 2400 }) @IsNumber(MONEY) @Min(0.01)
  montantTTC: number;

  @ApiProperty() @IsDateString()
  datePaiement: string;

  @ApiProperty({ enum: ModePaiement }) @IsEnum(ModePaiement)
  modePaiement: ModePaiement;

  @ApiPropertyOptional({ enum: PaiementStatut, default: PaiementStatut.REGLE }) @IsOptional() @IsEnum(PaiementStatut)
  statut?: PaiementStatut;
}

/** Every field of a payment can be corrected (report of 20/10). */
export class UpdatePaiementDto extends PartialType(CreatePaiementDto) {}

export class CreateDisponibiliteDto {
  @ApiProperty() @IsDateString()
  dateDebut: string;

  @ApiProperty() @IsDateString()
  dateFin: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  disponible?: boolean;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  notes?: string | null;
}

export class CreateNotationDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  chantierId?: number | null;

  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5)
  noteQualite: number;

  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5)
  noteDelai: number;

  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5)
  noteCommunication: number;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(2000)
  commentaire?: string | null;
}
