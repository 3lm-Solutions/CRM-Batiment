import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** Reminder settings of the company (ADMIN). */
export class UpdateRelancesReglagesDto {
  @ApiPropertyOptional({ description: 'Coupe toutes les relances automatiques' })
  @IsOptional()
  @IsBoolean()
  relancesActives?: boolean;

  @ApiPropertyOptional({
    example: [7, 14],
    description: 'Jours après l’envoi d’un devis sans réponse (1 à 4 relances)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(120, { each: true })
  relanceDevisJours?: number[];

  @ApiPropertyOptional({
    example: [1, 15, 30],
    description: 'Jours après l’échéance d’une facture impayée (1 à 4 relances)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(180, { each: true })
  relanceFactureJours?: number[];
}

export class QueryRelancesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  devisId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  factureId?: number;
}
