import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto, ToStringArray, Trim, TrimOrNull } from '../../../common';
import { SavTicketCategorie, SavTicketPriorite, SavTicketStatut } from '../../../generated/prisma/client';

export class CreateSavTicketDto {
  @ApiProperty() @IsInt() @Min(1)
  clientId: number;

  @ApiPropertyOptional({ description: 'Devis, facture ou chantier concerné (du même client)' }) @IsOptional() @IsInt() @Min(1)
  devisId?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  factureId?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  chantierId?: number;

  @ApiProperty({ example: 'Fissure sur la chape du salon' }) @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  titre: string;

  @ApiProperty() @Trim() @IsString() @IsNotEmpty() @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ enum: SavTicketPriorite }) @IsOptional() @IsEnum(SavTicketPriorite)
  priorite?: SavTicketPriorite;

  @ApiPropertyOptional({ enum: SavTicketCategorie }) @IsOptional() @IsEnum(SavTicketCategorie)
  categorie?: SavTicketCategorie;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  assignedToId?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateEcheance?: string;
}

export class UpdateSavTicketDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  titre?: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: SavTicketPriorite }) @IsOptional() @IsEnum(SavTicketPriorite)
  priorite?: SavTicketPriorite;

  @ApiPropertyOptional({ enum: SavTicketCategorie }) @IsOptional() @IsEnum(SavTicketCategorie)
  categorie?: SavTicketCategorie;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1)
  assignedToId?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateEcheance?: string | null;
}

export class QuerySavDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SavTicketStatut, isArray: true })
  @IsOptional() @ToStringArray() @IsArray() @IsEnum(SavTicketStatut, { each: true })
  statuts?: SavTicketStatut[];

  @ApiPropertyOptional({ enum: SavTicketPriorite }) @IsOptional() @IsEnum(SavTicketPriorite)
  priorite?: SavTicketPriorite;

  @ApiPropertyOptional({ enum: SavTicketCategorie }) @IsOptional() @IsEnum(SavTicketCategorie)
  categorie?: SavTicketCategorie;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  clientId?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  assignedToId?: number;
}

export class SavNoteDto {
  @ApiProperty() @Trim() @IsString() @IsNotEmpty() @MaxLength(5000)
  contenu: string;

  @ApiPropertyOptional({ description: 'Réponse visible par le client dans son espace (et envoyée par email). Défaut : note interne.' })
  @IsOptional() @IsBoolean()
  visibleClient?: boolean;
}

export class ResoudreSavDto {
  @ApiPropertyOptional({ description: 'Note de résolution (ajoutée au fil)' }) @IsOptional() @TrimOrNull() @IsString() @MaxLength(5000)
  note?: string | null;

  @ApiPropertyOptional({ description: 'La note est aussi un message au client (espace client + email)' })
  @IsOptional() @IsBoolean()
  visibleClient?: boolean;
}

export class SavChantiersQueryDto {
  @ApiProperty() @IsInt() @Min(1)
  clientId: number;
}
