import { toDates } from './to-dates';

describe('toDates', () => {
  it('turns a date without a time into a Date', () => {
    const out = toDates({ dateDebut: '2026-11-10', nom: 'x' }, ['dateDebut']);
    expect(out.dateDebut).toBeInstanceOf(Date);
    expect((out.dateDebut as Date).toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(out).toMatchObject({ nom: 'x' });
  });

  it('keeps null (clear the date) and leaves a missing field out', () => {
    const out = toDates({ dateDebut: null as string | null, dateFin: undefined }, [
      'dateDebut',
      'dateFin',
    ]);
    expect(out.dateDebut).toBeNull();
    expect('dateFin' in out && out.dateFin !== undefined).toBe(false);
  });
});
