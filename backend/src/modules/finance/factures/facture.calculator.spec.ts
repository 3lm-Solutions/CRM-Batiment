import { BusinessException } from '../../../common';
import { acompteHT, buildLine, finaleHT, invoiceTotals, negate, situationHT } from './facture.calculator';
import { FactureMachine } from './facture-status';

describe('invoice calculator', () => {
  const devisHT = '10000.00';

  it('deposit = 35 % of the quote', () => {
    expect(acompteHT(devisHT, 35).toString()).toBe('3500');
  });

  it('progress invoices bill the cumulative progress minus what was already billed', () => {
    expect(situationHT(devisHT, 40, []).toString()).toBe('4000');
    expect(situationHT(devisHT, 70, ['4000']).toString()).toBe('3000');
    expect(() => situationHT(devisHT, 40, ['4000'])).toThrow(BusinessException);
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
