import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class ChiffrageDto {
  @ApiProperty({ example: 14.5, description: 'Quantité dans l’unité de la prestation' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantite: number;

  @ApiPropertyOptional({ type: [Number], description: 'Choix d’options sélectionnés' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsInt({ each: true })
  @Min(1, { each: true })
  choixIds?: number[];
}
