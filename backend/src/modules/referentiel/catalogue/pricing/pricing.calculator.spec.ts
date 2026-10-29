import { BusinessException } from '../../../../common';
import { computePricing, PricingComponent, PricingInput } from './pricing.calculator';

const mat = (id: number, prix: number, qpu: number): PricingComponent => ({
  kind: 'MATERIAU',
  id,
  nom: `M${id}`,
  unite: 'KG',
  prixUnitaire: prix,
  quantiteParUnite: qpu,
});
const mo = (id: number, prix: number, qpu: number): PricingComponent => ({
  kind: 'MAIN_OEUVRE',
  id,
  nom: `MO${id}`,
  unite: 'M2',
  prixUnitaire: prix,
  quantiteParUnite: qpu,
});

const base = (overrides: Partial<PricingInput> = {}): PricingInput => ({
  quantite: 10,
  prixVenteMin: 40,
  prixVenteMax: 60,
  baseComponents: [mat(1, 10, 0.6), mo(2, 20, 1)], // per m²: 6 + 20 = 26 €
  selectedChoices: [],
  settings: { margeCiblePourcent: 30, seuilAlerteMargePourcent: 15, pasArrondiPrix: 0.01 },
  ...overrides,
});

describe('computePricing', () => {
  it('prices the base composition', () => {
    const r = computePricing(base());
    expect(r.compositionSource).toBe('BASE');
    expect(r.coutMateriaux.toNumber()).toBe(60);
    expect(r.coutMainOeuvre.toNumber()).toBe(200);
    expect(r.coutTotal.toNumber()).toBe(260);
    expect(r.coutParUnite.toNumber()).toBe(26);
    expect(r.prixVenteSuggereUnite.toNumber()).toBe(50); // middle of 40–60
    expect(r.totalVenteHT.toNumber()).toBe(500);
    expect(r.profit.toNumber()).toBe(240);
    expect(r.margePourcent.toNumber()).toBe(48);
    expect(r.alerteMarge).toBe(false);
  });

  it('a choice with its own composition REPLACES the base one (e.g. "Chape fibrée")', () => {
    const r = computePricing(
      base({
        selectedChoices: [
          { id: 9, nom: 'Chape fibrée', impactPrix: 0, components: [mat(3, 5, 2), mo(2, 20, 1.1)] },
        ],
      }),
    );
    expect(r.compositionSource).toBe('CHOIX');
    expect(r.compositionChoix).toBe('Chape fibrée');
    expect(r.lignes.map((l) => l.id)).toEqual([3, 2]); // material 1 is gone
    expect(r.coutTotal.toNumber()).toBe(100 + 220);
  });

  it('adds each choice price impact to the unit sale price', () => {
    const r = computePricing(
      base({
        selectedChoices: [
          { id: 1, nom: 'Brique', impactPrix: 5, components: [] },
          { id: 2, nom: 'Grande hauteur', impactPrix: 2.5, components: [] },
        ],
      }),
    );
    expect(r.impactOptionsParUnite.toNumber()).toBe(7.5);
    expect(r.prixVenteSuggereUnite.toNumber()).toBe(57.5);
    expect(r.compositionSource).toBe('BASE');
  });

  it('refuses two choices that both define a composition', () => {
    expect(() =>
      computePricing(
        base({
          selectedChoices: [
            { id: 1, nom: 'A', impactPrix: 0, components: [mat(1, 1, 1)] },
            { id: 2, nom: 'B', impactPrix: 0, components: [mat(1, 1, 1)] },
          ],
        }),
      ),
    ).toThrow(BusinessException);
  });

  it('computes the target-margin price from cost and rounds to the price step', () => {
    const r = computePricing(
      base({
        settings: { margeCiblePourcent: 30, seuilAlerteMargePourcent: 15, pasArrondiPrix: 0.5 },
      }),
    );
    // 26 / 0.7 = 37.142… -> 37
    expect(r.prixCibleMargeUnite.toNumber()).toBe(37);
  });

  it('raises a margin alert below the threshold', () => {
    const r = computePricing(base({ prixVenteMin: 27, prixVenteMax: 29 })); // sells 28, costs 26
    expect(r.margePourcent.toNumber()).toBeCloseTo(7.14, 2);
    expect(r.alerteMarge).toBe(true);
  });

  it('warns when there is no composition, without a misleading margin alert', () => {
    const r = computePricing(base({ baseComponents: [] }));
    expect(r.coutTotal.toNumber()).toBe(0);
    expect(r.alerteMarge).toBe(false);
    expect(r.avertissements[0]).toMatch(/sans composition/);
  });

  it('is exact to the cent (no float drift)', () => {
    const r = computePricing(
      base({ quantite: 3, baseComponents: [mat(1, 0.1, 1), mat(2, 0.2, 1)] }),
    );
    expect(r.coutTotal.toString()).toBe('0.9');
  });

  it('refuses a zero quantity', () => {
    expect(() => computePricing(base({ quantite: 0 }))).toThrow(BusinessException);
  });
});
