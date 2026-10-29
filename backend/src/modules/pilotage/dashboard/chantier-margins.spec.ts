import { chantierMargins } from './chantier-margins';

const c = (id: number, devis: { totalHT: number; profit: number }[]) => ({
  id,
  reference: `CH-${id}`,
  statut: 'EN_COURS',
  client: { nom: 'X', prenom: null },
  devis,
});

describe('chantierMargins (dashboard, C9)', () => {
  it('margin per job site from its signed quotes, worst first, flagged under the threshold', () => {
    const r = chantierMargins(
      [
        c(1, [{ totalHT: 10000, profit: 3000 }]),
        c(2, [{ totalHT: 2000, profit: 200 }]),
        c(3, [
          { totalHT: 1000, profit: 100 },
          { totalHT: 1000, profit: 300 },
        ]),
      ],
      15,
    );
    expect(r.liste.map((x) => [x.id, x.margePourcent, x.alerte])).toEqual([
      [2, 10, true],
      [3, 20, false],
      [1, 30, false],
    ]);
    expect(r.sousSeuil).toBe(1);
    // weighted: (3000 + 200 + 400) / (10000 + 2000 + 2000) = 25.7 %
    expect(r.margeMoyennePonderee).toBe(25.7);
  });

  it('a job site at 0 € has no margin and goes last; no job site → null average', () => {
    const r = chantierMargins(
      [c(1, [{ totalHT: 0, profit: 0 }]), c(2, [{ totalHT: 100, profit: 50 }])],
      15,
    );
    expect(r.liste.map((x) => x.margePourcent)).toEqual([50, null]);
    expect(chantierMargins([], 15).margeMoyennePonderee).toBeNull();
  });
});
