import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, ToBoolean, TrimOrNull } from '../../../common';
import { InstallationEtape, SignalementType } from '../../../generated/prisma/client';
import { MISSIONS_FILTRE } from './installation-rules';

// ── bureau ──────────────────────────────────────────────────────────────────

export class QueryInstallationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InstallationEtape })
  @IsOptional()
  @IsEnum(InstallationEtape)
  etape?: InstallationEtape;

  @ApiPropertyOptional({ description: 'Seulement celles en retard (date confirmée passée)' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  enRetard?: boolean;

  @ApiPropertyOptional({ description: 'Seulement celles dont une livraison retarde la pose' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  alerteLivraison?: boolean;
}

export class CreerInstallationDto {
  @ApiProperty({ description: 'Chantier dont la pose est déléguée' })
  @IsInt()
  @Min(1)
  chantierId: number;
}

export class AttribuerDto {
  @ApiProperty({ description: 'Sous-traitant marqué « installateur », avec un compte' })
  @IsInt()
  @Min(1)
  sousTraitantId: number;

  @ApiPropertyOptional({ example: 'Accès par la cour, client absent le matin' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @ApiPropertyOptional({ example: '2026-11-25' })
  @IsOptional()
  @IsDateString()
  dateSouhaitee?: string;
}

export class ModifierInstallationDto {
  @ApiPropertyOptional({ example: '2026-11-26' })
  @IsOptional()
  @IsDateString()
  dateSouhaitee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class MotifDto {
  @ApiProperty({ example: 'Pas disponible avant décembre' })
  @TrimOrNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motif: string;
}

// ── installateur ────────────────────────────────────────────────────────────

export class QueryMissionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.keys(MISSIONS_FILTRE) })
  @IsOptional()
  @IsIn(Object.keys(MISSIONS_FILTRE))
  filtre?: keyof typeof MISSIONS_FILTRE;
}

export class ProposerDateDto {
  @ApiProperty({ example: '2026-11-27' })
  @IsDateString()
  date: string;
}

export class AvancerDto {
  @ApiProperty({ enum: ['POSE', 'FINITIONS'], description: 'Étape suivante' })
  @IsIn(['POSE', 'FINITIONS'])
  etape: 'POSE' | 'FINITIONS';
}

export class PhotosEtapeDto {
  @ApiPropertyOptional({ example: 45.75 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 4.85 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

/** Multipart: `type`, `description`, `savDemande`, `photos` (0 to 10). */
export class SignalerDto {
  @ApiProperty({ enum: SignalementType })
  @IsEnum(SignalementType)
  type: SignalementType;

  @ApiProperty({ example: 'Carrelage fissuré dans la cuisine (2 carreaux)' })
  @TrimOrNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ description: 'Demander l’ouverture d’un ticket SAV au bureau' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  savDemande?: boolean;
}

export class VerifierPvDto {
  @ApiProperty({ example: 'BATIFLOW:PV:12:K7M2QX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contenu: string;
}

/** Multipart: `fichier` (scan / photo of the signed PV) + optional QR content read on it. */
export class EnvoyerPvDto extends PhotosEtapeDto {
  @ApiPropertyOptional({
    example: 'BATIFLOW:PV:12:K7M2QX',
    description: 'Contenu du QR lu sur le PV. Vide = QR illisible : le bureau vérifie à la main.',
  })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(100)
  qrContenu?: string | null;
}
