import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRagDocumentDto {
  @ApiProperty({
    example: 'Validite des devis',
    description: 'Titre court affiche comme source RAG',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le titre est obligatoire' })
  @MaxLength(160)
  titre: string;

  @ApiProperty({
    example: 'conditions',
    description: 'Categorie fonctionnelle du document',
  })
  @IsString()
  @IsNotEmpty({ message: 'La categorie est obligatoire' })
  @MaxLength(80)
  categorie: string;

  @ApiProperty({
    example:
      'Les devis sont valables 30 jours. Une visite technique peut etre necessaire avant validation.',
    description: 'Contenu texte utilise par le RAG',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le contenu est obligatoire' })
  @MaxLength(10000)
  contenu: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Document actif dans la recherche RAG',
  })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Priorite de tri quand plusieurs documents correspondent',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  priorite?: number;
}
