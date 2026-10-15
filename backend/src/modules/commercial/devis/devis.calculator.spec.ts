import { toDecimal } from '../../../common';
import { computeDevisTotals, computeLine, isMarginAlert } from './devis.calculator';

describe('devis calculator', () => {
  it('computes a line from unit prices', () => {
    const l = computeLine({ quantite: '14.5', prixUnitaireVente: '48.90', prixAchat: '12.40', mainOeuvre: '18' });
    expect(l.totalHT.toString()).toBe('709.05');
    expect(l.coutTotal.toString()).toBe('440.8');
  });

  it('computes quote totals from rounded line totals', () => {
    const t = computeDevisTotals(
      [
        { totalHT: '709.05', coutTotal: '440.80' },
        { totalHT: '120.00', coutTotal: '95.00' },
      ],
      20,
    );
    expect(t.totalHT.toString()).toBe('829.05');
    expect(t.totalTVA.toString()).toBe('165.81');
    expect(t.totalTTC.toString()).toBe('994.86');
    expect(t.coutTotal.toString()).toBe('535.8');
    expect(t.profit.toString()).toBe('293.25');
    expect(t.margePourcent.toString()).toBe('35.37');
  });

  it('handles an empty quote', () => {
    const t = computeDevisTotals([], 20);
    expect(t.totalTTC.toNumber()).toBe(0);
    expect(t.margePourcent.toNumber()).toBe(0);
  });

  it('alerts below the margin threshold, never on an empty quote', () => {
    expect(isMarginAlert({ totalHT: toDecimal(100), margePourcent: toDecimal(12) }, 15)).toBe(true);
    expect(isMarginAlert({ totalHT: toDecimal(100), margePourcent: toDecimal(20) }, 15)).toBe(false);
    expect(isMarginAlert({ totalHT: toDecimal(0), margePourcent: toDecimal(0) }, 15)).toBe(false);
  });
});
