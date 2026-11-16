import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotationDto {
  @ApiProperty({ example: 4, description: 'Note de 1 à 5' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  note: number;

  @ApiPropertyOptional({ example: 'Très bon travail, ponctuel et soigné.' })
  @IsOptional()
  @IsString()
  commentaire?: string;

  @ApiPropertyOptional({ example: 'Qualité', description: 'Critère évalué' })
  @IsOptional()
  @IsString()
  critere?: string;
}
