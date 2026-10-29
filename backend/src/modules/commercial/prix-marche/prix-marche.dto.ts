import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common';

export class QueryPrixMarcheDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['PRESTATION', 'MATERIAU'], default: 'PRESTATION' })
  @IsOptional()
  @IsIn(['PRESTATION', 'MATERIAU'])
  type?: 'PRESTATION' | 'MATERIAU';
}
