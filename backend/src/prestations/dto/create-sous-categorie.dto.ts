import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSousCategorieDto {
  @ApiProperty({ example: 1, description: 'ID de la catégorie parente' })
  @IsInt({ message: 'categorieId doit être un entier' })
  categorieId: number;

  @ApiProperty({ example: 'Cloisons', description: 'Nom de la sous-catégorie' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la sous-catégorie est obligatoire' })
  nom: string;

  @ApiPropertyOptional({
    example: 'Travaux liés aux cloisons',
    description: 'Description de la sous-catégorie',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
