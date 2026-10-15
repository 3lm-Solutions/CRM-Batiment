import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { PaginatedResponse } from '../../shared';

export const MAX_PAGE_SIZE = 100;

/**
 * Base query DTO for every list endpoint. Module DTOs extend it and add their filters:
 *   export class QueryDevisDto extends PaginationQueryDto { @IsOptional() @IsEnum(DevisStatut) statut?: DevisStatut }
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Recherche texte libre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt:desc', description: 'champ:asc | champ:desc' })
  @IsOptional()
  @Matches(/^[A-Za-z]+:(asc|desc)$/, { message: 'sort doit être au format champ:asc ou champ:desc' })
  sort?: string;
}

/** `{ skip, take }` for Prisma findMany. */
export function toSkipTake(query: Pick<PaginationQueryDto, 'page' | 'limit'>) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

/** Wraps a page of results in the standard `{ data, meta }` shape. */
export function paginate<T>(
  data: T[],
  total: number,
  query: Pick<PaginationQueryDto, 'page' | 'limit'>,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

type SortDirection = 'asc' | 'desc';

/**
 * Turns `?sort=createdAt:desc` into a Prisma orderBy — only for WHITELISTED fields,
 * so nobody can sort (and thus probe) by `password` or any other column.
 */
export function parseSort<F extends string>(
  sort: string | undefined,
  allowed: readonly F[],
  fallback: { [K in F]?: SortDirection },
): { [K in F]?: SortDirection } {
  if (!sort) return fallback;

  const [field, direction] = sort.split(':') as [string, SortDirection];
  if (!(allowed as readonly string[]).includes(field)) {
    throw new BadRequestException(`Tri impossible sur "${field}". Champs autorisés : ${allowed.join(', ')}`);
  }
  return { [field]: direction } as { [K in F]?: SortDirection };
}
