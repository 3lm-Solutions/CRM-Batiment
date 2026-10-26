import { BusinessException } from '../../../common';
import { acompteHT, buildLine, finaleHT, invoiceTotals, negate, situationAmounts } from './facture.calculator';
import { FactureMachine } from './facture-status';

describe('invoice calculator', () => {
  const devisHT = '10000.00';

  it('deposit = 35 % of the quote', () => {
    expect(acompteHT(devisHT, 35).toString()).toBe('3500');
  });

  const situation = (avancementPrecedent: number, avancementCumule: number, acomptesHT: string[], situationsDejaHT: string[]) =>
    situationAmounts({ devisHT, acomptesHT, avancementPrecedent, avancementCumule, situationsDejaHT });

  it('without deposit, progress invoices bill the cumulative progress minus what was already billed', () => {
    expect(situation(0, 40, [], []).netHT.toString()).toBe('4000');
    expect(situation(40, 70, [], ['4000']).netHT.toString()).toBe('3000');
    expect(situation(40, 70, [], ['4000']).remboursementAcompteHT.toString()).toBe('0');
    expect(() => situation(40, 40, [], ['4000'])).toThrow(BusinessException);
  });

  it('with a deposit, each progress invoice repays its share of it (old bug: 105 % billed)', () => {
    const s1 = situation(0, 30, ['3500'], []);
    expect([s1.brutHT.toString(), s1.remboursementAcompteHT.toString(), s1.netHT.toString()]).toEqual(['3000', '1050', '1950']);
    const s2 = situation(30, 70, ['3500'], ['1950']);
    expect([s2.brutHT.toString(), s2.remboursementAcompteHT.toString(), s2.netHT.toString()]).toEqual(['4000', '1400', '2600']);
    const finale = finaleHT(devisHT, ['3500', '1950', '2600']);
    expect(finale.toString()).toBe('1950');
    expect(finale.plus('3500').plus('1950').plus('2600').toString()).toBe('10000');
  });

  it('deposit + progress invoices + final = exactly the quote, even with odd amounts', () => {
    const quote = '8291.37';
    const acompte = acompteHT(quote, 35);
    const billed: string[] = [];
    let previous = 0;
    for (const p of [33.33, 66.67, 99.99]) {
      const s = situationAmounts({ devisHT: quote, acomptesHT: [acompte], avancementPrecedent: previous, avancementCumule: p, situationsDejaHT: billed });
      billed.push(s.netHT.toString());
      previous = p;
    }
    const finale = finaleHT(quote, [acompte, ...billed]);
    expect(finale.gte(0)).toBe(true);
    expect([acompte, ...billed, finale].reduce((a, b) => a.plus(b), acompteHT(quote, 0)).toString()).toBe('8291.37');
  });

  it('a progress invoice created before the fix (no repayment) is caught up on the next one', () => {
    const s2 = situation(30, 70, ['3500'], ['3000']); // the old one billed 3000 with no repayment
    expect(s2.remboursementAcompteHT.toString()).toBe('2450');
    expect(s2.netHT.toString()).toBe('1550');
    expect(finaleHT(devisHT, ['3500', '3000', '1550']).toString()).toBe('1950'); // total still 10000
  });

  it('nothing to bill when the deposit already covers the progress', () => {
    expect(() => situation(0, 50, ['10000'], [])).toThrow(BusinessException);
  });

  it('the final invoice DEDUCTS deposit and progress invoices (old bug: 135 % billed)', () => {
    expect(finaleHT(devisHT, ['3500']).toString()).toBe('6500');
    expect(finaleHT(devisHT, ['3500', '4000', '2000']).toString()).toBe('500');
    expect(() => finaleHT(devisHT, ['8000', '3000'])).toThrow(BusinessException);
  });

  it('deposit + final = exactly the quote', () => {
    const acompte = acompteHT('8291.37', 35);
    const finale = finaleHT('8291.37', [acompte]);
    expect(acompte.plus(finale).toString()).toBe('8291.37');
  });

  it('builds lines and totals with VAT on the HT total', () => {
    const lines = [
      buildLine({ description: 'A', quantite: 3, prixUnitaireHT: '33.33', tauxTVA: 20 }),
      buildLine({ description: 'B', quantite: 1, prixUnitaireHT: '0.01', tauxTVA: 20 }),
    ];
    const t = invoiceTotals(lines, 20);
    expect([t.montantHT.toString(), t.montantTVA.toString(), t.montantTTC.toString()]).toEqual(['100', '20', '120']);
  });

  it('a credit note line is the negated original', () => {
    const line = buildLine({ description: 'A', quantite: 2, prixUnitaireHT: 50, tauxTVA: 20 });
    expect(negate(line).montantTTC.toString()).toBe('-120');
  });
});

describe('invoice state machine', () => {
  it('an issued invoice never goes back to draft', () => {
    expect(FactureMachine.can('ENVOYEE', 'BROUILLON')).toBe(false);
    expect(FactureMachine.can('PAYEE', 'ANNULEE')).toBe(false);
    expect(FactureMachine.can('BROUILLON', 'ENVOYEE')).toBe(true);
  });
});
