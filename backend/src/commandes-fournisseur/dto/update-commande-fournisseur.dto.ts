import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unite } from '../../../generated/prisma/client.js';

export class UpdateCommandeFournisseurLigneDto {
  @ApiProperty({
    example: 'Sac ciment 35kg',
    description: 'Libelle materiau de la ligne',
  })
  @IsString()
  materiauNom!: string;

  @ApiProperty({
    example: 12,
    description: 'Quantite commandee',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantite!: number;

  @ApiProperty({
    enum: Unite,
    example: Unite.PIECE,
    description: 'Unite de mesure',
  })
  @IsEnum(Unite)
  unite!: Unite;

  @ApiProperty({
    example: 8.5,
    description: 'Prix unitaire achat HT',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prixUnitaire!: number;
}

export class UpdateCommandeFournisseurDto {
  @ApiPropertyOptional({
    example: '2026-04-25',
    description: 'Date de livraison prevue',
  })
  @IsOptional()
  @IsDateString()
  dateLivraisonPrevue?: string;

  @ApiPropertyOptional({
    example: 'Commande ajustee apres verification chantier.',
    description: 'Notes internes de la commande',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [UpdateCommandeFournisseurLigneDto],
    description: 'Lignes modifiables avant envoi fournisseur',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateCommandeFournisseurLigneDto)
  lignes!: UpdateCommandeFournisseurLigneDto[];
}
