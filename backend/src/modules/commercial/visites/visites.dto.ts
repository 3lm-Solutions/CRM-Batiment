import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, ToStringArray, TrimOrNull } from '../../../common';
import { VisiteStatut } from '../../../generated/prisma/client';

export class CreateVisiteDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  clientId: number;

  @ApiPropertyOptional({ description: 'Demande de devis concernée' })
  @IsOptional()
  @IsInt()
  @Min(1)
  demandeDevisId?: number | null;

  @ApiProperty({ example: '2026-11-20T09:30:00+01:00' })
  @IsDateString()
  dateHeure: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  dureeMinutes?: number;

  @ApiPropertyOptional({ description: 'Par défaut : adresse du chantier, sinon du client' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(300)
  adresse?: string | null;

  @ApiPropertyOptional({ example: 'Métré salle de bain' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(500)
  objet?: string | null;

  @ApiPropertyOptional({ description: 'ADMIN / ASSISTANTE : la visite d’un autre commercial' })
  @IsOptional()
  @IsInt()
  @Min(1)
  commercialId?: number;
}

export class UpdateVisiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateHeure?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(600)
  dureeMinutes?: number;

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
  @MaxLength(500)
  objet?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  demandeDevisId?: number | null;
}

export class TerminerVisiteDto {
  @ApiPropertyOptional({ example: 'Métré fait, devis à préparer' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(5000)
  compteRendu?: string | null;
}

export class AnnulerVisiteDto {
  @ApiPropertyOptional({ example: 'Client absent' })
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  motif?: string | null;
}

export class QueryVisitesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  du?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  au?: string;

  @ApiPropertyOptional({ enum: VisiteStatut, isArray: true })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(VisiteStatut, { each: true })
  statuts?: VisiteStatut[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional({ description: 'ADMIN / ASSISTANTE : les visites de ce commercial' })
  @IsOptional()
  @IsInt()
  @Min(1)
  commercialId?: number;
}
