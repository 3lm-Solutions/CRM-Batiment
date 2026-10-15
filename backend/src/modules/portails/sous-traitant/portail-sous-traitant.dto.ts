import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto, TrimOrNull } from '../../../common';
import { TacheStatut } from '../../../generated/prisma/client';

/** What a sous-traitant may change on a task assigned to him: progress only, never dates or assignees. */
export class AvancementTacheDto {
  @ApiPropertyOptional({ enum: TacheStatut }) @IsOptional() @IsEnum(TacheStatut)
  statut?: TacheStatut;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsOptional() @IsInt() @Min(0) @Max(100)
  avancement?: number;

  @ApiPropertyOptional() @IsOptional() @TrimOrNull() @IsString() @MaxLength(2000)
  commentaire?: string | null;
}

export class QueryRapportsDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  chantierId?: number;
}
