import { BusinessException } from '../../../common';
import { assertMontants, fournisseurCle, normaliserNumero } from './depense-rules';

describe('depense rules', () => {
  it('normalises the invoice number: uppercase, no space - . /', () => {
    expect(normaliserNumero(' fa-12/b ')).toBe('FA12B');
    expect(normaliserNumero('FA 12.B')).toBe('FA12B');
  });

  it('supplier key: the id when chosen from the list, else the normalised name', () => {
    expect(fournisseurCle(7, 'Point P')).toBe('f:7');
    expect(fournisseurCle(null, '  Point  P ')).toBe('n:POINT P');
    expect(fournisseurCle(null, 'point p')).toBe(fournisseurCle(null, 'POINT P'));
  });

  it('accepts HT + TVA = TTC within 5 cents, refuses beyond', () => {
    expect(() => assertMontants(100, 20, 120)).not.toThrow();
    expect(() => assertMontants(100, 20, 120.04)).not.toThrow();
    expect(() => assertMontants(100, 20, 130)).toThrow(BusinessException);
    try {
      assertMontants(100, 20, 130);
    } catch (e) {
      expect((e as BusinessException).code).toBe('MONTANTS_INCOHERENTS');
    }
  });
});
