import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateRapportTacheDto {
  @ApiPropertyOptional({
    example: 'Chape coulee ce matin, sechage en cours.',
    description: 'Compte rendu / description (optionnel si une photo est jointe)',
  })
  @IsOptional()
  @IsString()
  texte?: string;
}
