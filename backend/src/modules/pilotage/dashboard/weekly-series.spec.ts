import { rate, weekStart, weeklySeries } from './weekly-series';

describe('dashboard weekly series', () => {
  const now = new Date('2026-10-14T10:00:00Z'); // Wednesday

  it('finds the Monday of the week', () => {
    expect(weekStart(now).toISOString().slice(0, 10)).toBe('2026-10-12');
    expect(weekStart(new Date('2026-10-12T00:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-10-12',
    );
    expect(weekStart(new Date('2026-10-18T23:00:00Z')).toISOString().slice(0, 10)).toBe(
      '2026-10-12',
    ); // Sunday
  });

  it('returns every week, oldest first, empty ones included', () => {
    const s = weeklySeries([], now, 4);
    expect(s.map((p) => p.semaine)).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
    expect(s.every((p) => p.envoyes === 0)).toBe(true);
  });

  it('counts sent, accepted (incl. signed) and refused per week', () => {
    const s = weeklySeries(
      [
        { dateEnvoi: new Date('2026-10-13'), statut: 'SIGNE' },
        { dateEnvoi: new Date('2026-10-12'), statut: 'REFUSE' },
        { dateEnvoi: new Date('2026-10-06'), statut: 'ACCEPTE' },
        { dateEnvoi: new Date('2026-10-07'), statut: 'ENVOYE' },
        { dateEnvoi: new Date('2025-01-01'), statut: 'SIGNE' }, // outside the window
      ],
      now,
      2,
    );
    expect(s).toEqual([
      { semaine: '2026-10-05', envoyes: 2, acceptes: 1, refuses: 0 },
      { semaine: '2026-10-12', envoyes: 2, acceptes: 1, refuses: 1 },
    ]);
  });

  it('computes a rate with one decimal, 0 when nothing was sent', () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(0, 0)).toBe(0);
  });
});
