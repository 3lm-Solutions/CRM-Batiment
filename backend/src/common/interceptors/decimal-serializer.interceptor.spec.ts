import { Prisma } from '../../generated/prisma/client';
import { serializeDecimals } from './decimal-serializer.interceptor';

describe('serializeDecimals', () => {
  it('converts nested Decimals to numbers', () => {
    const date = new Date('2026-01-01');
    const input = {
      totalHT: new Prisma.Decimal('1250.50'),
      lignes: [{ quantite: new Prisma.Decimal('14.5'), nom: 'Carrelage' }],
      createdAt: date,
      notes: null,
    };

    expect(serializeDecimals(input)).toEqual({
      totalHT: 1250.5,
      lignes: [{ quantite: 14.5, nom: 'Carrelage' }],
      createdAt: date,
      notes: null,
    });
  });

  it('leaves class instances untouched (e.g. file streams)', () => {
    class FileLike {
      constructor(public readonly name: string) {}
    }
    const file = new FileLike('devis.pdf');
    expect(serializeDecimals(file)).toBe(file);
  });
});
