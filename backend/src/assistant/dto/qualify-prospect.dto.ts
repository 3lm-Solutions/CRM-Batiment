import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QualifyProspectDto {
  @ApiPropertyOptional({
    example: 'Projet valide apres qualification telephonique.',
    description:
      'Description metier de la demande. Si vide, la note prospect chatbot est reutilisee.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Si true, cree aussi (ou reutilise) un devis brouillon rattache a la demande.',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  createDevisDraft?: boolean;
}
