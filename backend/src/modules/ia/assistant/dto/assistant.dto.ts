import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsSiret,
  IsTvaIntracom,
  NormalizeEmail,
  PaginationQueryDto,
  ToStringArray,
  Trim,
  TrimOrNull,
  IsPhone,
} from '../../../../common';
import { ProspectStatut, TypeClient } from '../../../../generated/prisma/client';

// ── public chatbot ─────────────────────────────────────────────────────────

export class StartSessionDto {
  @ApiProperty({ example: 1, description: 'Entreprise du widget (configurée dans le site)' })
  @IsInt()
  @Min(1)
  companyId: number;
}

export class PostMessageDto {
  @ApiProperty({ example: 'Bonjour, je voudrais refaire ma salle de bain.' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  contenu: string;
}

/** Structured form of the widget ("Demander un devis") — validated like any form (spec P0). */
export class CoordonneesDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(80)
  prenom?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '06 12 34 56 78' })
  @IsOptional()
  @Trim()
  @IsPhone()
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(120)
  typeProjet?: string | null;

  @ApiProperty({ example: 'Salle de bain de 6 m² : douche à l’italienne et nouveau carrelage' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(120)
  delai?: string | null;
}

export class FeedbackDto {
  @ApiProperty({ enum: ['UTILE', 'PAS_UTILE'] })
  @IsIn(['UTILE', 'PAS_UTILE'])
  rating: 'UTILE' | 'PAS_UTILE';

  @ApiPropertyOptional({ description: 'Réponse évaluée (extrait)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  messageExcerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}

// ── back-office ────────────────────────────────────────────────────────────

export class QueryProspectsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProspectStatut, isArray: true })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(ProspectStatut, { each: true })
  statuts?: ProspectStatut[];

  @ApiPropertyOptional({
    enum: ['CHATBOT', 'EMAIL'],
    description: 'Chatbot du site ou email reçu (22/10)',
  })
  @IsOptional()
  @IsIn(['CHATBOT', 'EMAIL'])
  source?: 'CHATBOT' | 'EMAIL';
}

export class UpdateProspectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(80)
  clientNom?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(80)
  clientPrenom?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(254)
  clientEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(30)
  clientTelephone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(120)
  typeProjet?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  notesInternes?: string | null;
}

export class QualifierProspectDto {
  @ApiPropertyOptional({
    description: 'Client existant à utiliser (sinon : client trouvé par email/téléphone, ou créé)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  // ── 29/10: category of the client created by the qualification (ignored for an existing client) ──
  @ApiPropertyOptional({
    enum: TypeClient,
    default: TypeClient.PARTICULIER,
    description: 'Particulier ou professionnel',
  })
  @IsOptional()
  @IsEnum(TypeClient)
  typeClient?: TypeClient;

  @ApiPropertyOptional({
    example: 'Bâti Rénov SARL',
    description: 'Professionnel : raison sociale (obligatoire pour un pro)',
  })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(150)
  raisonSociale?: string | null;

  @ApiPropertyOptional({
    example: '73282932000074',
    description: 'Professionnel : SIRET (14 chiffres, facultatif)',
  })
  @IsOptional()
  @IsSiret()
  siret?: string | null;

  @ApiPropertyOptional({
    example: 'FR44732829320',
    description: 'Professionnel : n° de TVA intracommunautaire (facultatif)',
  })
  @IsOptional()
  @IsTvaIntracom()
  tvaIntracom?: string | null;

  @ApiPropertyOptional({
    example: 'Gérant',
    description: 'Professionnel : fonction de la personne qui a écrit',
  })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(100)
  contactFonction?: string | null;
}

export class RejeterProspectDto {
  @ApiProperty({ example: 'Hors zone d’intervention' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motif: string;
}
