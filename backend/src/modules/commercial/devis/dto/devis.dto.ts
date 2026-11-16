import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsSignaturePng,
  PaginationQueryDto,
  ToIntArray,
  ToStringArray,
  Trim,
  TrimOrNull,
} from '../../../../common';
import { DevisStatut } from '../../../../generated/prisma/client';

export class CreateDevisDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  clientId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  demandeDevisId?: number;

  @ApiPropertyOptional({ example: 10, description: 'Défaut : TVA de l’entreprise' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tauxTVA?: number;

  @ApiPropertyOptional({ description: 'Notes internes (jamais montrées au client)' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateDevisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tauxTVA?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

const SORTABLE = ['reference', 'dateCreation', 'dateEnvoi', 'totalTTC'] as const;
export const DEVIS_SORT_FIELDS = SORTABLE;

export class QueryDevisDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DevisStatut, isArray: true, example: 'ENVOYE,RENVOYE' })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(DevisStatut, { each: true })
  statuts?: DevisStatut[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  createurId?: number;
}

export class ReviserDevisDto {
  @ApiProperty({ example: 'Le client souhaite un carrelage moins cher' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  justification: string;
}

export class AnnulerDevisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}

export class SignerConseillerDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'Accord verbal du client : le devis passe directement à SIGNE sans signature client en ligne',
  })
  @IsOptional()
  @IsBoolean()
  verbal?: boolean;
}

export class ReordonnerLignesDto {
  @ApiProperty({ type: [Number], description: 'Tous les ids de lignes, dans le nouvel ordre' })
  @ToIntArray()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  ligneIds: number[];
}

// ── 05/11 (re-applied 16/11) + mobile lot B1 ──────────────────────────────

/** Refusal recorded by the team (the client said no by phone / in person). */
export class RefuserDevisInterneDto {
  @ApiProperty({ example: 'Budget trop élevé' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motif: string;
}

export class RejeterSignaturePapierDto {
  @ApiProperty({ example: 'Page 2 non signée' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motif: string;
}

/** Signature on the advisor's phone, in front of the client (mobile lot B1). */
export class SignerSurPlaceDto {
  @IsSignaturePng()
  signatureClientBase64: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nomSignataire: string;

  @ApiPropertyOptional({ example: 48.8566 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 2.3522 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class VerifierQrDto {
  @ApiProperty({ example: 'BATIFLOW:DEV:12:1:7K3Q9P' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  contenu: string;
}

/** 16/11 (mobile lot 1): draft started by a chef de chantier for the Devis IA. */
export class BrouillonChefDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  clientId: number;

  @ApiPropertyOptional({ description: 'Le prospect terrain envoyé par le chef' })
  @IsOptional()
  @IsInt()
  @Min(1)
  demandeDevisId?: number;
}

/** 16/11 (lot 1): multipart fields sent with the scan of the paper signature (proof). */
export class SignaturePapierDto {
  @ApiPropertyOptional({ example: 48.8566 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 2.3522 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
