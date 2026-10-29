import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../../common';
import { RetourClientStatut, RetourClientType } from '../../../generated/prisma/client';

/** Sent by the client from his space (Étape 5 of 26/10). */
export class CreateRetourClientDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  chantierId: number;

  @ApiPropertyOptional({ description: 'Tâche concernée' })
  @IsOptional()
  @IsInt()
  @Min(1)
  tacheId?: number;

  @ApiPropertyOptional({
    description: 'Photo validée concernée (sa tâche est reprise automatiquement)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  photoId?: number;

  @ApiProperty({
    enum: RetourClientType,
    description: 'COMMENTAIRE ou ALERTE (problème à regarder vite)',
  })
  @IsEnum(RetourClientType)
  type: RetourClientType;

  @ApiProperty({ example: 'Le joint gris me convient très bien.' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

export class QueryRetoursDto {
  @ApiPropertyOptional({ enum: RetourClientStatut })
  @IsOptional()
  @IsEnum(RetourClientStatut)
  statut?: RetourClientStatut;

  @ApiPropertyOptional({ enum: RetourClientType })
  @IsOptional()
  @IsEnum(RetourClientType)
  type?: RetourClientType;
}

/** Answer of the chef / office (Étape 6 of 26/10): shown in the client space and emailed. */
export class RepondreRetourDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reponse: string;

  @ApiPropertyOptional({
    description: 'Marquer en même temps comme traité (défaut : oui)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  traite?: boolean;
}
