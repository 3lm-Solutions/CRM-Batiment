import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TacheStatut } from '../../../generated/prisma/client.js';
import { CreateTacheDto } from './create-tache.dto.js';

export class UpdateTacheDto extends PartialType(CreateTacheDto) {
  @ApiPropertyOptional({
    enum: TacheStatut,
    description: 'Statut explicite de la tache (optionnel)',
  })
  @IsOptional()
  @IsEnum(TacheStatut)
  statut?: TacheStatut;
}
