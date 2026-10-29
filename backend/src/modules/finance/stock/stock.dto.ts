import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto, ToBoolean, Trim } from '../../../common';
import { TypeMouvementStock } from '../../../generated/prisma/client';

export class CreateMouvementDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  materiauId: number;

  @ApiProperty({ enum: TypeMouvementStock })
  @IsEnum(TypeMouvementStock)
  type: TypeMouvementStock;

  @ApiProperty({
    example: 12,
    description: 'ENTREE/SORTIE : quantité (> 0). AJUSTEMENT : nouveau stock compté (inventaire).',
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantite: number;

  @ApiPropertyOptional({ description: 'Chantier consommateur (sortie) ou destinataire' })
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional({ example: 'Casse sur chantier' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  motif?: string;
}

export class QueryStockDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'true = uniquement sous le seuil minimum' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  alerte?: boolean;
}

export class QueryMouvementsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  materiauId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional({ enum: TypeMouvementStock })
  @IsOptional()
  @IsEnum(TypeMouvementStock)
  type?: TypeMouvementStock;
}
