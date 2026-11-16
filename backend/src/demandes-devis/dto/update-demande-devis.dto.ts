import { IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDemandeDevisDto {
  @ApiPropertyOptional({
    example: 'Rénovation SDB 10m² avec douche italienne',
    description: 'Description mise à jour',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: {
      typeTravaux: 'Rénovation SDB',
      surface: 10,
      materiaux: ['carrelage', 'faïence', 'robinetterie'],
    },
    description: 'Besoin structuré mis à jour',
  })
  @IsOptional()
  @IsObject()
  besoinStructure?: Record<string, any>;
}
