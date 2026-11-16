import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DemoRequestStatut } from '../../../generated/prisma/client.js';

export class QueryDemoRequestDto {
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
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'mariem' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DemoRequestStatut })
  @IsOptional()
  @IsEnum(DemoRequestStatut)
  statut?: DemoRequestStatut;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedToId?: number;
}
