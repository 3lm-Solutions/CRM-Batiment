import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common';

export class QueryAuditDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Devis' }) @IsOptional() @IsString() @MaxLength(50)
  entite?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  entiteId?: number;

  @ApiPropertyOptional({ example: 'PRIX_MODIFIE' }) @IsOptional() @IsString() @MaxLength(50)
  action?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  userId?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  du?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  au?: string;
}
