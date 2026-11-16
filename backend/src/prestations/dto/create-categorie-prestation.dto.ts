import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoriePrestationDto {
  @ApiProperty({ example: 'Carrelage', description: 'Nom de la catégorie' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire' })
  nom: string;

  @ApiPropertyOptional({
    example: 'Pose et fourniture de carrelage',
    description: 'Description de la catégorie',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
