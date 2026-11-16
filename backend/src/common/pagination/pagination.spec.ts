import { BadRequestException } from '@nestjs/common';
import { paginate, parseSort, toSkipTake } from './pagination';

describe('pagination helpers', () => {
  it('computes skip/take', () => {
    expect(toSkipTake({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it('builds meta with totalPages >= 1', () => {
    expect(paginate([], 0, { page: 1, limit: 20 }).meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    expect(paginate([1], 41, { page: 1, limit: 20 }).meta.totalPages).toBe(3);
  });

  it('parses a whitelisted sort', () => {
    expect(parseSort('nom:asc', ['nom', 'createdAt'] as const, { createdAt: 'desc' })).toEqual({
      nom: 'asc',
    });
  });

  it('falls back when no sort is given', () => {
    expect(parseSort(undefined, ['nom'] as const, { nom: 'asc' })).toEqual({ nom: 'asc' });
  });

  it('refuses a field outside the whitelist', () => {
    expect(() => parseSort('password:asc', ['nom'] as const, {})).toThrow(BadRequestException);
  });
});
