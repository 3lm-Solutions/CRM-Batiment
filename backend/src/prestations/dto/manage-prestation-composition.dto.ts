import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePrestationCompositionDto {
  @ApiProperty({ example: 12, description: 'ID de la prestation' })
  @Type(() => Number)
  @IsInt()
  prestationId: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'ID matériau lié à la composition (optionnel si serviceMainOeuvreId est fourni)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  materiauId?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      "ID service main d'oeuvre lié à la composition (optionnel si materiauId est fourni)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceMainOeuvreId?: number;

  @ApiProperty({
    example: 1.5,
    description: 'Quantité par unité de prestation',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantiteParUnite: number;
}

export class UpdatePrestationCompositionDto {
  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description: 'Nouveau matériau (null pour retirer)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  materiauId?: number | null;

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description: "Nouveau service main d'oeuvre (null pour retirer)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceMainOeuvreId?: number | null;

  @ApiPropertyOptional({
    example: 2.0,
    description: 'Quantité par unité de prestation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantiteParUnite?: number;
}
