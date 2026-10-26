import { assertJourPointable, assertTotalJour, bornesMois, jourUtc } from './pointage-rules';

describe('pointage — règles', () => {
  const now = new Date('2026-10-21T15:00:00Z');

  it('keeps only the calendar day', () => {
    expect(jourUtc('2026-10-20').toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(jourUtc('2026-10-20T22:30:00.000Z').toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('refuses a future day and a day older than 60 days', () => {
    expect(() => assertJourPointable(jourUtc('2026-10-21'), now)).not.toThrow();
    expect(() => assertJourPointable(jourUtc('2026-10-22'), now)).toThrow('jour à venir');
    expect(() => assertJourPointable(jourUtc('2026-08-01'), now)).toThrow('60 derniers jours');
  });

  it('caps a day at 24 h', () => {
    expect(() => assertTotalJour(16, 8)).not.toThrow();
    expect(() => assertTotalJour(16, 8.25)).toThrow('24 h');
  });

  it('computes the month bounds, December included', () => {
    const d = bornesMois('2026-12', now);
    expect(d.du.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(d.au.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(bornesMois(undefined, now).mois).toBe('2026-10');
  });
});
