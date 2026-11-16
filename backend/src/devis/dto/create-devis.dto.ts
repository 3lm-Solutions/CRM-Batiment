import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModeValidation } from '../../../generated/prisma/client.js';

export class CreateDevisDto {
  @ApiProperty({ example: 1, description: 'ID du client' })
  @IsInt()
  @IsNotEmpty()
  clientId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID de la demande de devis (optionnel)',
  })
  @IsOptional()
  @IsInt()
  demandeDevisId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID du chantier lié (optionnel)',
  })
  @IsOptional()
  @IsInt()
  chantierId?: number;

  @ApiPropertyOptional({
    example: 20.0,
    description: 'Taux de TVA (défaut 20%)',
  })
  @IsOptional()
  @IsNumber()
  tauxTVA?: number;

  @ApiPropertyOptional({
    enum: ModeValidation,
    example: ModeValidation.EMAIL,
    description: 'Mode de validation du devis',
  })
  @IsOptional()
  @IsEnum(ModeValidation)
  modeValidation?: ModeValidation;

  @ApiPropertyOptional({ example: 'Devis pour rénovation complète SDB' })
  @IsOptional()
  @IsString()
  notes?: string;
}
