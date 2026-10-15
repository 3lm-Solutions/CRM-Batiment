import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto, ToStringArray, Trim } from '../../../../common';
import { DemandeStatut, LeadSource } from '../../../../generated/prisma/client';

export class CreateDemandeDevisDto {
  @ApiProperty() @IsInt() @Min(1)
  clientId: number;

  @ApiProperty({ example: 'Rénovation complète salle de bain 6 m², douche à l’italienne' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ enum: LeadSource, default: LeadSource.AUTRE }) @IsOptional() @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ description: 'Besoin structuré (surfaces, pièces, contraintes…) — ex. issu du chatbot' })
  @IsOptional() @IsObject()
  besoinStructure?: Record<string, unknown>;
}

export class UpdateDemandeDevisDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: LeadSource }) @IsOptional() @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  besoinStructure?: Record<string, unknown>;
}

export class QueryDemandesDevisDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DemandeStatut, isArray: true }) @IsOptional() @ToStringArray() @IsArray() @IsEnum(DemandeStatut, { each: true })
  statuts?: DemandeStatut[];

  @ApiPropertyOptional({ enum: LeadSource }) @IsOptional() @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  clientId?: number;
}
