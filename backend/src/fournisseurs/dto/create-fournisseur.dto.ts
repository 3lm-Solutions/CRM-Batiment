import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFournisseurDto {
  @ApiProperty({
    example: 'Céramique France',
    description: 'Nom du fournisseur',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du fournisseur est obligatoire' })
  nom: string;

  @ApiPropertyOptional({
    example: 'Jean Martin',
    description: 'Nom du contact principal',
  })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({
    example: 'contact@ceramique-france.fr',
    description: 'Email du fournisseur',
  })
  @IsOptional()
  @IsEmail({}, { message: "L'email doit être valide" })
  email?: string;

  @ApiPropertyOptional({
    example: '0145678901',
    description: 'Téléphone du fournisseur',
  })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({
    example: '15 Rue des Artisans, 93000 Bobigny',
    description: 'Adresse du fournisseur',
  })
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiPropertyOptional({
    example: 'Carrelage, Faïence, Colle',
    description: 'Types de matériaux fournis',
  })
  @IsOptional()
  @IsString()
  typesMateriaux?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Délai de livraison moyen (jours)',
  })
  @IsOptional()
  @IsInt({ message: 'delaiLivraison doit être un entier' })
  @Min(0)
  delaiLivraison?: number;

  @ApiPropertyOptional({
    example: 'Franco à partir de 500€ HT',
    description: 'Conditions commerciales',
  })
  @IsOptional()
  @IsString()
  conditions?: string;
}
