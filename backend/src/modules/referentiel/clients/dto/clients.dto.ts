import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsSiret, IsTvaIntracom, NormalizeEmail, PaginationQueryDto, ToBoolean, ToIntArray, ToStringArray, Trim, TrimOrNull, IsPhone } from '../../../../common';
import { LeadSource, StatutClient, TypeClient } from '../../../../generated/prisma/client';

export class CreateClientDto {
  @ApiPropertyOptional({ enum: StatutClient, default: StatutClient.PROSPECT, description: 'Prospect, prospect qualifié ou client. Évolue tout seul (devis envoyé → qualifié, devis signé → client).' })
  @IsOptional() @IsEnum(StatutClient)
  statut?: StatutClient;

  @ApiPropertyOptional({ enum: TypeClient, default: TypeClient.PARTICULIER, description: 'Particulier ou professionnel (entreprise)' })
  @IsOptional() @IsEnum(TypeClient)
  typeClient?: TypeClient;

  @ApiProperty({ example: 'Martin', description: 'Nom du particulier, ou raison sociale du professionnel' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Le nom (ou la raison sociale) est obligatoire' })
  @MaxLength(150)
  nom: string;

  @ApiPropertyOptional({ example: 'Claire' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(100)
  prenom?: string | null;

  // ── professional client only (ignored and emptied for a private person) ──
  @ApiPropertyOptional({ example: '73282932000074', description: 'Professionnel : SIRET (facultatif, vérifié s’il est saisi)' })
  @IsOptional() @IsSiret()
  siret?: string | null;

  @ApiPropertyOptional({ example: 'FR44732829320', description: 'Professionnel : n° de TVA intracommunautaire' })
  @IsOptional() @IsTvaIntracom()
  tvaIntracom?: string | null;

  @ApiPropertyOptional({ example: 'Paul Durand', description: 'Professionnel : personne à contacter' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(150)
  contactNom?: string | null;

  @ApiPropertyOptional({ example: 'Responsable travaux' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(100)
  contactFonction?: string | null;

  @ApiPropertyOptional({ example: '0612345678' })
  @IsOptional() @TrimOrNull()
  @IsPhone()
  telephone?: string | null;

  @ApiPropertyOptional({ example: 'claire.martin@mail.fr' })
  @IsOptional() @NormalizeEmail() @IsEmail({}, { message: "L'email doit être valide" })
  email?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  adresseClient?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  adresseChantier?: string | null;

  @ApiPropertyOptional({ enum: LeadSource, default: LeadSource.AUTRE })
  @IsOptional() @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ description: 'Besoin exprimé par le client' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(2000)
  besoin?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [Number], example: [1, 4] })
  @IsOptional()
  @ToIntArray()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(1, { each: true })
  typeProjetIds?: number[];
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

const SORTABLE_CLIENT_FIELDS = ['nom', 'createdAt', 'updatedAt'] as const;
export type ClientSortField = (typeof SORTABLE_CLIENT_FIELDS)[number];
export const CLIENT_SORT_FIELDS = SORTABLE_CLIENT_FIELDS;

export class QueryClientsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: StatutClient, isArray: true, description: 'Ex. PROSPECT,QUALIFIE pour la page Prospects, CLIENT pour la page Clients' })
  @IsOptional() @ToStringArray() @IsArray() @IsEnum(StatutClient, { each: true })
  statuts?: StatutClient[];

  @ApiPropertyOptional({ enum: TypeClient })
  @IsOptional() @IsEnum(TypeClient)
  typeClient?: TypeClient;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional() @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional() @ToIntArray() @IsArray() @IsInt({ each: true })
  typeProjetIds?: number[];

  @ApiPropertyOptional({ default: false, description: 'true = uniquement les clients archivés' })
  @IsOptional() @ToBoolean() @IsBoolean()
  archived?: boolean;
}
