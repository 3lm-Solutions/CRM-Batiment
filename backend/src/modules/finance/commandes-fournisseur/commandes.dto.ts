import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto, ToStringArray, TrimOrNull } from '../../../common';
import { CommandeFournisseurStatut } from '../../../generated/prisma/client';

export class QueryCommandesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CommandeFournisseurStatut, isArray: true })
  @IsOptional() @ToStringArray() @IsArray() @IsEnum(CommandeFournisseurStatut, { each: true })
  statuts?: CommandeFournisseurStatut[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  fournisseurId?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  devisId?: number;
}

export class UpdateCommandeDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateLivraisonPrevue?: string | null;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(2000)
  notes?: string | null;
}

class QuantiteLigneDto {
  @ApiProperty() @IsInt() @Min(1)
  ligneId: number;

  @ApiProperty({ example: 12 }) @IsNumber({ maxDecimalPlaces: 3 }) @IsPositive()
  quantite: number;
}

export class UpdateLignesCommandeDto {
  @ApiProperty({ type: [QuantiteLigneDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuantiteLigneDto)
  lignes: QuantiteLigneDto[];
}

export class ReceptionDto {
  @ApiProperty({ type: [QuantiteLigneDto], description: 'Quantités reçues dans CETTE livraison' })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuantiteLigneDto)
  lignes: QuantiteLigneDto[];

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(2000)
  notes?: string | null;
}
