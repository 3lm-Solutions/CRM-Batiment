import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class UpdateChantierVisibilityDto {
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sousTraitantIds: number[];
}