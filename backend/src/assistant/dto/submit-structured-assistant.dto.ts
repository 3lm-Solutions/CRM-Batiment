import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class StructuredOptionChoiceDto {
  @ApiProperty({
    example: 12,
    description: 'Identifiant de l option prestation',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optionId: number;

  @ApiProperty({
    example: [31, 32],
    description: 'Liste des choix selectionnes pour cette option',
    type: [Number],
  })
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  choixOptionIds: number[];
}

export class SubmitStructuredAssistantDto {
  @ApiProperty({ example: 1, description: 'ID de la societe ciblee' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId: number;

  @ApiProperty({ example: 'Amine Ben Salah' })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ example: '0612345678' })
  @IsString()
  @IsNotEmpty()
  telephone: string;

  @ApiProperty({ example: 'amine@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'renovation cuisine',
    description: 'Service/projet demande par le client',
  })
  @IsString()
  @IsNotEmpty()
  serviceRequested: string;

  @ApiPropertyOptional({
    example: 'Renovation complete avec electricite et plomberie.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'prix',
    description:
      'Type de besoin: devis | prix | categorie | service_disponible',
  })
  @IsOptional()
  @IsString()
  requestType?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selectedCategoryId?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selectedSousCategorieId?: number;

  @ApiPropertyOptional({ example: 19 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selectedPrestationId?: number;

  @ApiPropertyOptional({
    type: [StructuredOptionChoiceDto],
    description: 'Choix des options de la prestation selectionnee',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructuredOptionChoiceDto)
  selectedOptions?: StructuredOptionChoiceDto[];

  @ApiPropertyOptional({
    example: false,
    description: 'Si true, valide le dossier et genere un PDF telechargeable.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  confirmValidation?: boolean;
}
