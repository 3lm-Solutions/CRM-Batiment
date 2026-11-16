import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Length, MaxLength, Min } from 'class-validator';

export class CreateSousTraitantRapportDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chantierId!: number;

  @ApiProperty({ example: 'Compte rendu de la pose du carrelage' })
  @IsString()
  @Length(3, 140)
  titre!: string;

  @ApiProperty({ example: 'Travaux réalisés, difficultés rencontrées et actions restantes.' })
  @IsString()
  @Length(10, 12000)
  contenu!: string;
}
