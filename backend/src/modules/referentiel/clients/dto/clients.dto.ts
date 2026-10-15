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
import { NormalizeEmail, PaginationQueryDto, ToBoolean, ToIntArray, Trim, TrimOrNull, IsPhone } from '../../../../common';
import { LeadSource } from '../../../../generated/prisma/client';

export class CreateClientDto {
  @ApiProperty({ example: 'Martin' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MaxLength(100)
  nom: string;

  @ApiPropertyOptional({ example: 'Claire' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(100)
  prenom?: string | null;

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
