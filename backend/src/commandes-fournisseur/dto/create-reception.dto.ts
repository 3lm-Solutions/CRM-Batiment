import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReceptionDto {
  @ApiProperty({
    example: 12.5,
    description: 'Quantite recue sur cette reception',
  })
  @IsNumber()
  @Min(0.01)
  quantiteRecue!: number;

  @ApiPropertyOptional({
    example: '2026-03-25',
    description: 'Date de reception reelle',
  })
  @IsOptional()
  @IsISO8601()
  dateReception?: string;

  @ApiPropertyOptional({
    example: 'Palette 2 abimee, reserve emise a la livraison.',
    description: 'Observation ou anomalie constatee a reception',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
