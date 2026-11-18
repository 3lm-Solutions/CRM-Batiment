import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto, ToStringArray, TrimOrNull } from '../../../common';
import {
  CommandeFournisseurStatut,
  EcartType,
  ReceptionControle,
} from '../../../generated/prisma/client';

export class QueryCommandesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CommandeFournisseurStatut, isArray: true })
  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsEnum(CommandeFournisseurStatut, { each: true })
  statuts?: CommandeFournisseurStatut[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  fournisseurId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  devisId?: number;
}

class LigneNouvelleCommandeDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  materiauId: number;

  @ApiProperty({ example: 10 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantite: number;
}

/** Manual order: one supplier, its materials only (prices from the catalogue). */
export class CreateCommandeDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  fournisseurId: number;

  @ApiPropertyOptional({ description: 'Chantier livré (vide = réapprovisionnement du stock)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateLivraisonPrevue?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiProperty({ type: [LigneNouvelleCommandeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneNouvelleCommandeDto)
  lignes: LigneNouvelleCommandeDto[];
}

export class UpdateCommandeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateLivraisonPrevue?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

class QuantiteLigneDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  ligneId: number;

  @ApiProperty({ example: 12 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantite: number;
}

export class UpdateLignesCommandeDto {
  @ApiProperty({ type: [QuantiteLigneDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuantiteLigneDto)
  lignes: QuantiteLigneDto[];
}

/** 18/11 (mobile lot A): a gap noted while checking the delivery against its delivery note. */
export class EcartDto {
  @ApiProperty({ enum: EcartType })
  @IsEnum(EcartType)
  type: EcartType;

  @ApiPropertyOptional({
    description: 'Ligne de la commande concernée (vide pour un article inconnu)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ligneId?: number;

  @ApiProperty({ example: 'Sac de colle C2 — 2 sacs déchirés' })
  @TrimOrNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  libelle: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantite?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(1000)
  commentaire?: string | null;
}

export class ReceptionDto {
  @ApiProperty({
    type: [QuantiteLigneDto],
    description:
      'Quantités reçues dans CETTE livraison (peut être vide si la livraison n’a apporté que des écarts)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuantiteLigneDto)
  lignes: QuantiteLigneDto[];

  @ApiPropertyOptional({
    type: [EcartDto],
    description:
      'Mobile (lot A) : écarts constatés avec le bon de livraison. « En trop » et « inconnu » n’entrent pas dans le stock ; la réception passe « à vérifier » par le bureau.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EcartDto)
  ecarts?: EcartDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @TrimOrNull()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

/** 18/11 (mobile lot A): office queue of checked deliveries. */
export class QueryReceptionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReceptionControle })
  @IsOptional()
  @IsEnum(ReceptionControle)
  statutControle?: ReceptionControle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  commandeId?: number;
}

export class RefuserReceptionDto {
  @ApiProperty({ example: 'Le bon de livraison ne correspond pas à la commande' })
  @TrimOrNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motif: string;
}

/** Multipart fields sent with a photo taken on the phone (optional proof of place). */
export class PositionPhotoDto {
  @ApiPropertyOptional({ example: 45.75 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 4.85 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
