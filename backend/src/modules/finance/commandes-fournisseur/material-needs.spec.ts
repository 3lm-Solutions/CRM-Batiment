import { CatalogueForNeeds, computeMaterialNeeds } from './material-needs';

const catalogue: CatalogueForNeeds = {
  prestations: new Map([
    [
      1, // Chape béton
      {
        base: [{ materiauId: 10, quantiteParUnite: 0.6 }], // ciment
        parChoix: new Map([
          [
            100,
            [
              { materiauId: 10, quantiteParUnite: 0.85 },
              { materiauId: 11, quantiteParUnite: 1.3 },
              { materiauId: null, quantiteParUnite: 1 },
            ],
          ],
          [101, []], // choice without its own composition
        ]),
      },
    ],
  ]),
  materiaux: new Map([
    [10, { nom: 'Ciment', unite: 'PIECE', prixAchatFixe: 9.5, fournisseurId: 1 }],
    [11, { nom: 'Sable', unite: 'PIECE', prixAchatFixe: 4, fournisseurId: 2 }],
    [12, { nom: 'Spot', unite: 'PIECE', prixAchatFixe: 12, fournisseurId: null }],
  ]),
};

describe('computeMaterialNeeds', () => {
  it('uses the base composition without a composition-bearing choice', () => {
    const r = computeMaterialNeeds(
      [{ quantite: 20, prestationId: 1, materiauId: null, choixIds: [101] }],
      catalogue,
    );
    const ciment = r.parFournisseur.get(1)![0];
    expect(ciment.quantite.toNumber()).toBe(12);
    expect(ciment.totalHT.toNumber()).toBe(114);
    expect(r.parFournisseur.has(2)).toBe(false);
  });

  it('a choice composition replaces the base one and splits by supplier', () => {
    const r = computeMaterialNeeds(
      [{ quantite: 20, prestationId: 1, materiauId: null, choixIds: [100] }],
      catalogue,
    );
    expect(r.parFournisseur.get(1)![0].quantite.toNumber()).toBe(17);
    expect(r.parFournisseur.get(2)![0].quantite.toNumber()).toBe(26);
  });

  it('adds up the same material across lines, and free material lines', () => {
    const r = computeMaterialNeeds(
      [
        { quantite: 10, prestationId: 1, materiauId: null, choixIds: [] },
        { quantite: 3, prestationId: null, materiauId: 10, choixIds: [] },
      ],
      catalogue,
    );
    expect(r.parFournisseur.get(1)![0].quantite.toNumber()).toBe(9); // 6 + 3
  });

  it('reports materials without supplier instead of dropping them', () => {
    const r = computeMaterialNeeds(
      [{ quantite: 4, prestationId: null, materiauId: 12, choixIds: [] }],
      catalogue,
    );
    expect(r.sansFournisseur).toEqual([{ materiauId: 12, nom: 'Spot' }]);
  });

  it('rounds quantities UP (never under-order)', () => {
    const r = computeMaterialNeeds(
      [{ quantite: 1.0001, prestationId: null, materiauId: 10, choixIds: [] }],
      catalogue,
    );
    expect(r.parFournisseur.get(1)![0].quantite.toString()).toBe('1.001');
  });
});
