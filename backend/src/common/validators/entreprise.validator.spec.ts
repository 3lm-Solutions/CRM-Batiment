import { compactNumero, isSiret, isTvaIntracom, siretCleValide } from './entreprise.validator';

describe('SIRET and intra-community VAT number', () => {
  it('SIRET: any 14 digits (27/10), the key only for an optional warning', () => {
    expect(isSiret('73282932000074')).toBe(true);
    expect(isSiret('732 829 320 00074')).toBe(true);
    expect(isSiret('12345678910123')).toBe(true); // wrong key: accepted
    expect(isSiret('7328293200007')).toBe(false);
    expect(isSiret('7328293200007A')).toBe(false);
    expect(isSiret(12345678901234)).toBe(false);
    expect(siretCleValide('73282932000074')).toBe(true);
    expect(siretCleValide('73282932000075')).toBe(false);
    expect(siretCleValide('35600000012341')).toBe(true); // La Poste: digit sum multiple of 5
  });

  it('checks the French VAT key, only the format for other countries', () => {
    expect(isTvaIntracom('FR44732829320')).toBe(true);
    expect(isTvaIntracom('fr 40 303 265 045')).toBe(true);
    expect(isTvaIntracom('FR45732829320')).toBe(false);
    expect(isTvaIntracom('FR4473282932')).toBe(false);
    expect(isTvaIntracom('BE0123456789')).toBe(true);
    expect(isTvaIntracom('12345')).toBe(false);
    expect(compactNumero(' fr.44-732 ')).toBe('FR44732');
  });
});
