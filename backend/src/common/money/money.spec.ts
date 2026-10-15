import {
  computeTotals,
  lineTotal,
  marginPercent,
  roundToStep,
  percentOf,
  roundMoney,
  sumMoney,
} from './money';

describe('money', () => {
  it('avoids floating-point drift (0.1 + 0.2)', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the JS bug we are protecting against
    expect(sumMoney([0.1, 0.2]).toNumber()).toBe(0.3);
  });

  it('rounds half-up to the cent', () => {
    expect(roundMoney('2.345').toString()).toBe('2.35');
    expect(roundMoney('2.344').toString()).toBe('2.34');
  });

  it('computes a line total', () => {
    expect(lineTotal('18.50', '14.5').toString()).toBe('268.25');
  });

  it('computes a 30% acompte exactly', () => {
    expect(percentOf('1234.57', 30).toString()).toBe('370.37');
  });

  it('computes HT / TVA / TTC', () => {
    const t = computeTotals('1000.10', 20);
    expect([t.totalHT.toString(), t.totalTVA.toString(), t.totalTTC.toString()]).toEqual([
      '1000.1',
      '200.02',
      '1200.12',
    ]);
  });

  it('computes the margin rate on the sale price', () => {
    expect(marginPercent(1000, 750).toNumber()).toBe(25);
    expect(marginPercent(0, 100).toNumber()).toBe(0);
    expect(marginPercent(1000, 1200).toNumber()).toBe(-20);
  });

  it('rounds to a price step', () => {
    expect(roundToStep('47.30', '0.5').toString()).toBe('47.5');
    expect(roundToStep('47.24', '0.5').toString()).toBe('47');
    expect(roundToStep('47.236', '0.01').toString()).toBe('47.24');
    expect(roundToStep('123', '5').toString()).toBe('125');
  });
});
