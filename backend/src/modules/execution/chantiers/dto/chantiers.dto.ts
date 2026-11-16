import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsUrl,
} from 'class-validator';
import { PaginationQueryDto, ToStringArray, Trim, TrimOrNull } from '../../../../common';
import { ChantierStatut, TacheStatut } from '../../../../generated/prisma/client';

export class CreateChantierDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  clientId: number;

  @ApiProperty({ example: '12 rue des Lilas, 69003 Lyon' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  adresse: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chefChantierId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFin?: string | null;
}

export class UpdateChantierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  adresse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Bureau uniquement' })
  @IsOptional()
  @IsInt()
  @Min(1)
  chefChantierId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFin?: string | null;
}

export class QueryChantiersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ChantierStatut, isArray: true })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(ChantierStatut, { each: true })
  statuts?: ChantierStatut[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chefChantierId?: number;
}

export class AccesSousTraitantsDto {
  @ApiProperty({
    type: [Number],
    description: 'Comptes SOUS_TRAITANT autorisés à voir ce chantier (liste complète)',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  userIds: number[];
}

export class Plan2dDto {
  @ApiProperty({ description: 'Plan 2D (format de l’éditeur)' })
  @IsObject()
  plan: Record<string, unknown>;
}

export class CreateDocumentDto {
  @ApiProperty({ example: 'PV de réception' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom: string;

  @ApiProperty({ example: 'PV' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  /** External link… */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(1000)
  url?: string;

  /** …or a file uploaded first with POST /fichiers (exactly one of the two) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  fichierId?: number;
}

export class CreateTacheDto {
  @ApiProperty({ example: 'Pose du carrelage salle de bain' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  libelle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFin?: string | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Utilisateurs affectés (chef, sous-traitants…)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  assigneeIds?: number[];
}

export class UpdateTacheDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  libelle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TacheStatut })
  @IsOptional()
  @IsEnum(TacheStatut)
  statut?: TacheStatut;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  avancement?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateDebut?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFin?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  commentaire?: string | null;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  assigneeIds?: number[];
}
