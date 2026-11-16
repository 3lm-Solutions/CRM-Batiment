import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ModeValidation } from '../../../generated/prisma/client.js';

export class UpdateDevisDto {
  @ApiPropertyOptional({ example: 20.0, description: 'Taux de TVA' })
  @IsOptional()
  @IsNumber()
  tauxTVA?: number;

  @ApiPropertyOptional({
    enum: ModeValidation,
    example: ModeValidation.SIGNATURE,
  })
  @IsOptional()
  @IsEnum(ModeValidation)
  modeValidation?: ModeValidation;

  @ApiPropertyOptional({ example: 'Notes mises à jour' })
  @IsOptional()
  @IsString()
  notes?: string;
}
