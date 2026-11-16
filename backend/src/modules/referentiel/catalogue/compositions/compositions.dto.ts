import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

/** One line of a bill of materials: exactly one of materiauId / serviceMainOeuvreId. */
export class CompositionItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  materiauId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  serviceMainOeuvreId?: number;

  @ApiProperty({ example: 1.05, description: 'Quantité consommée pour UNE unité de prestation' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantiteParUnite: number;
}

/**
 * The whole composition is replaced in one call (atomic): the editor sends the full list.
 * Simpler and safer than the old one-endpoint-per-line API.
 */
export class ReplaceCompositionsDto {
  @ApiProperty({ type: [CompositionItemDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompositionItemDto)
  items: CompositionItemDto[];
}
