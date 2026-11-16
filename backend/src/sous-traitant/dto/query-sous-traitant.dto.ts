import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TacheStatut } from '../../../generated/prisma/client.js';

export class QuerySousTraitantDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'carrelage' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TacheStatut })
  @IsOptional()
  @IsEnum(TacheStatut)
  statut?: TacheStatut;
}
