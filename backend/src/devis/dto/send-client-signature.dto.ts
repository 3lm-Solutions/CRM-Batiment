import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SendClientSignatureDto {
  @ApiPropertyOptional({
    description:
      'Telephone cible pour la signature client (fallback sur le telephone client du devis)',
    example: '+33612345678',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  telephone?: string;

  @ApiPropertyOptional({
    description: 'Duree de validite du lien en heures (defaut: 24h)',
    example: 24,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  expiresInHours?: number;
}
