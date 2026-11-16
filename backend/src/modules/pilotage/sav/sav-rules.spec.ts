import { ajouterMois, eligibiliteSav } from './sav-rules';

const d = (s: string) => new Date(`${s}T10:00:00Z`);

describe('SAV after the works (Étape 2 of 26/10)', () => {
  it('adds months without spilling into the next month', () => {
    expect(ajouterMois(d('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(ajouterMois(d('2024-02-29'), 12).toISOString().slice(0, 10)).toBe('2025-02-28');
    expect(ajouterMois(d('2026-03-15'), 12).toISOString().slice(0, 10)).toBe('2027-03-15');
  });

  it('refuses a job site still in progress', () => {
    for (const statut of ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'ANNULE'] as const) {
      const r = eligibiliteSav(
        { statut, dateFin: null, updatedAt: d('2026-01-01') },
        12,
        d('2026-02-01'),
      );
      expect(r).toMatchObject({ possible: false, code: 'CHANTIER_NON_TERMINE' });
    }
  });

  it('accepts a finished job site during the period, refuses it after', () => {
    const ch = { statut: 'TERMINE' as const, dateFin: d('2026-03-15'), updatedAt: d('2026-03-20') };
    const ok = eligibiliteSav(ch, 12, d('2027-03-14'));
    expect(ok.possible).toBe(true);
    expect(ok.jusquau?.toISOString().slice(0, 10)).toBe('2027-03-15');
    const late = eligibiliteSav(ch, 12, d('2027-03-16'));
    expect(late).toMatchObject({ possible: false, code: 'SAV_EXPIRE' });
    expect(late.message).toContain('15/03/2027');
  });

  it('0 month = no limit; a closed site without end date uses its last update', () => {
    expect(
      eligibiliteSav(
        { statut: 'CLOTURE', dateFin: d('2010-01-01'), updatedAt: d('2010-01-01') },
        0,
        d('2026-10-26'),
      ),
    ).toMatchObject({ possible: true, jusquau: null });
    const r = eligibiliteSav(
      { statut: 'CLOTURE', dateFin: null, updatedAt: d('2026-01-10') },
      6,
      d('2026-10-26'),
    );
    expect(r).toMatchObject({ possible: false, code: 'SAV_EXPIRE' });
  });
});
