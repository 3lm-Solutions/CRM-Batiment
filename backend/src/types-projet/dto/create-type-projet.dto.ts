import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTypeProjetDto {
  @ApiProperty({
    example: 'Renovation salle de bain',
    description: 'Nom du type de projet',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  nom: string;

  @ApiPropertyOptional({
    example: 'Travaux de renovation complete de salle de bain',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: [1, 3, 5],
    type: [Number],
    description:
      'IDs des categories de prestations associees a ce type de projet',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  categorieIds?: number[];
}
