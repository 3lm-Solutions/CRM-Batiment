import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class QueryPlanningDto {
  @ApiProperty({ example: '2026-10-19' })
  @IsDateString()
  du: string;

  @ApiProperty({ example: '2026-10-25' })
  @IsDateString()
  au: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  chantierId?: number;

  @ApiPropertyOptional({ description: 'Un intervenant (compte utilisateur)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;
}
