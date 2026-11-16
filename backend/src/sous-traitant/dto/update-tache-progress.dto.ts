import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TacheStatut } from '../../../generated/prisma/client.js';

export class UpdateTacheProgressDto {
  @ApiPropertyOptional({
    enum: TacheStatut,
    description: 'Nouveau statut de la tache',
  })
  @IsOptional()
  @IsEnum(TacheStatut)
  statut?: TacheStatut;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 100,
    description: 'Pourcentage d avancement (0-100)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  avancement?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Commentaire ou notes sur la tache',
  })
  @IsOptional()
  @IsString()
  commentaire?: string;
}
