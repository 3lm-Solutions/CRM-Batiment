import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TacheStatut } from '../../../generated/prisma/client.js';

export class UpdateSousTraitantTacheDto {
  @ApiPropertyOptional({ enum: TacheStatut })
  @IsOptional()
  @IsEnum(TacheStatut)
  statut?: TacheStatut;

  @ApiPropertyOptional({ example: 50, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  avancement?: number;

  @ApiPropertyOptional({
    example: 'Intervention commencée, matériel reçu.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;
}
