// Type metadata (emitDecoratorMetadata) for enableImplicitConversion — loaded by Nest in the app, not by Jest
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { NormalizeEmail, ToBoolean, ToIntArray, Trim, TrimOrNull } from './transforms';

class Probe {
  @ToBoolean() actif?: unknown;
  @Trim() nom?: unknown;
  @TrimOrNull() notes?: unknown;
  @NormalizeEmail() email?: unknown;
  @ToIntArray() ids?: unknown;
}

const parse = (plain: Record<string, unknown>) => plainToInstance(Probe, plain);

describe('DTO transforms', () => {
  it('ToBoolean: "false" really becomes false (the old @Type(() => Boolean) bug)', () => {
    expect(parse({ actif: 'false' }).actif).toBe(false);
    expect(parse({ actif: 'true' }).actif).toBe(true);
    expect(parse({ actif: 'maybe' }).actif).toBe('maybe'); // left for @IsBoolean to reject
  });

  it('ToBoolean: "false" stays false with enableImplicitConversion on a boolean property (global pipe options)', () => {
    class TypedProbe {
      @ToBoolean() actif?: boolean;
    }
    const parseImplicit = (plain: Record<string, unknown>) =>
      plainToInstance(TypedProbe, plain, { enableImplicitConversion: true });
    expect(parseImplicit({ actif: 'false' }).actif).toBe(false);
    expect(parseImplicit({ actif: '0' }).actif).toBe(false);
    expect(parseImplicit({ actif: 'true' }).actif).toBe(true);
    expect(parseImplicit({}).actif).toBeUndefined();
  });

  it('Trim / TrimOrNull', () => {
    expect(parse({ nom: '  Dupont ' }).nom).toBe('Dupont');
    expect(parse({ nom: '   ' }).nom).toBeUndefined();
    expect(parse({ notes: '  ' }).notes).toBeNull();
  });

  it('NormalizeEmail', () => {
    expect(parse({ email: ' Jean@Mail.FR ' }).email).toBe('jean@mail.fr');
  });

  it('ToIntArray from a query string or an array', () => {
    expect(parse({ ids: '1,2,3' }).ids).toEqual([1, 2, 3]);
    expect(parse({ ids: ['4', '5'] }).ids).toEqual([4, 5]);
  });
});
