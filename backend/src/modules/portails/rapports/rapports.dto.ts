import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../../common';

/** Multipart form: every field arrives as a string, hence @Type(() => Number). */
export class CreateRapportDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  chantierId: number;

  @ApiPropertyOptional({ description: 'Tâche concernée (doit vous être affectée)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  tacheId?: number;

  @ApiProperty({ example: 'Chape coulée ce matin, séchage en cours. Reste les plinthes.' })
  @Trim() @IsString() @IsNotEmpty() @MaxLength(5000)
  contenu: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, description: 'Avancement de la tâche, appliqué à la validation' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  avancement?: number;
}

export class ReviewRapportDto {
  @ApiPropertyOptional({ description: 'Obligatoire pour renvoyer le rapport' })
  @IsOptional() @Trim() @IsString() @MaxLength(2000)
  commentaire?: string;
}
