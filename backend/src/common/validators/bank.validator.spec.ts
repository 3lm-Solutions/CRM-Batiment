import { isBic, isIban } from './bank.validator';

describe('IBAN / BIC', () => {
  it('accepts valid IBANs, with spaces or lower case', () => {
    expect(isIban('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(isIban('de89370400440532013000')).toBe(true);
  });
  it('refuses a wrong check digit or a bad shape', () => {
    expect(isIban('FR76 3000 6000 0112 3456 7890 188')).toBe(false);
    expect(isIban('FR')).toBe(false);
    expect(isIban(42)).toBe(false);
  });
  it('checks BICs', () => {
    expect(isBic('BNPAFRPP')).toBe(true);
    expect(isBic('bnpafrppxxx')).toBe(true);
    expect(isBic('BNP')).toBe(false);
  });
});
