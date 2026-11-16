import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum TaskAssignmentType {
  AUCUNE = 'AUCUNE',
  SOUS_TRAITANT = 'SOUS_TRAITANT',
  EQUIPE_INTERNE = 'EQUIPE_INTERNE',
}

export class CreateTacheDto {
  @ApiProperty({ example: 'Poser le carrelage salle de bain' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  libelle!: string;

  @ApiPropertyOptional({
    example: 'Pose carrelage mural 30x60 avec joints hydrofuges',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-04-20' })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({ example: '2026-04-25' })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({ example: false, description: 'Tache terminee ou non' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @ApiPropertyOptional({
    enum: TaskAssignmentType,
    description: 'Type d affectation de la tache',
  })
  @IsOptional()
  @IsEnum(TaskAssignmentType)
  assigneeType?: TaskAssignmentType;

  @ApiPropertyOptional({
    example: 12,
    description: 'ID utilisateur sous-traitant (si assigneeType=SOUS_TRAITANT)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sousTraitantId?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'ID equipe interne (si assigneeType=EQUIPE_INTERNE)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  equipeId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Ordre d affichage de la tache',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordre?: number;
}
