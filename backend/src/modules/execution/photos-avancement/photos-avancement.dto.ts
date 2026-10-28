import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { TrimOrNull } from '../../../common';
import { PhotoAvancementStatut, PhotoMoment } from '../../../generated/prisma/client';

/** Fields sent with the photos (multipart): one task, one moment, one day. */
export class EnvoyerPhotosDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  tacheId: number;

  @ApiPropertyOptional({ description: 'Sous-tâche (ligne de checklist) de cette tâche' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  checklistItemId?: number;

  @ApiProperty({ enum: PhotoMoment }) @IsEnum(PhotoMoment)
  moment: PhotoMoment;

  @ApiPropertyOptional({ example: '2026-10-26', description: 'Jour concerné (aujourd’hui par défaut, 60 jours en arrière au plus)' })
  @IsOptional() @IsDateString()
  date?: string;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(500)
  commentaire?: string | null;
}

export class QueryMesPhotosDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  chantierId?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  tacheId?: number;

  @ApiPropertyOptional({ example: '2026-10', description: 'Mois (AAAA-MM), le mois courant par défaut' })
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mois au format AAAA-MM' })
  mois?: string;
}

export class QueryPhotosChantierDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  tacheId?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  checklistItemId?: number;

  @ApiPropertyOptional({ description: 'Compte du sous-traitant qui a envoyé la photo' }) @IsOptional() @IsInt() @Min(1)
  auteurId?: number;

  @ApiPropertyOptional({ enum: PhotoAvancementStatut }) @IsOptional() @IsEnum(PhotoAvancementStatut)
  statut?: PhotoAvancementStatut;

  @ApiPropertyOptional({ enum: PhotoMoment }) @IsOptional() @IsEnum(PhotoMoment)
  moment?: PhotoMoment;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  du?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  au?: string;
}

export class PhotosIdsDto {
  @ApiProperty({ type: [Number] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsInt({ each: true }) @Min(1, { each: true })
  ids: number[];
}

export class MasquerPhotosDto extends PhotosIdsDto {
  @ApiPropertyOptional({ example: 'Photo floue', description: 'Raison montrée au sous-traitant' })
  @IsOptional() @TrimOrNull() @IsString() @MaxLength(300)
  motif?: string | null;
}
