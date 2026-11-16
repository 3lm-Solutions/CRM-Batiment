import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class AssignSousTraitantDto {
  @ApiProperty({ example: 12, description: 'ID du sous-traitant a affecter au chantier' })
  @Type(() => Number)
  @IsInt()
  sousTraitantId: number;
}
