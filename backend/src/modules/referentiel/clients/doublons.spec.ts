import { cleEmail, cleTelephone } from './doublons';

describe('doublons de clients', () => {
  it('compares phone numbers on their last 9 digits', () => {
    expect(cleTelephone('06 12 34 56 78')).toBe('612345678');
    expect(cleTelephone('+33 6 12 34 56 78')).toBe('612345678');
    expect(cleTelephone('0033612345678')).toBe('612345678');
    expect(cleTelephone('06.12.34.56.78')).toBe(cleTelephone('+33612345678'));
  });

  it('ignores empty or too short numbers', () => {
    expect(cleTelephone(null)).toBeNull();
    expect(cleTelephone('')).toBeNull();
    expect(cleTelephone('1234')).toBeNull();
  });

  it('compares emails without case or spaces', () => {
    expect(cleEmail(' Paul.Martin@Mail.FR ')).toBe('paul.martin@mail.fr');
    expect(cleEmail('pas-un-email')).toBeNull();
    expect(cleEmail(undefined)).toBeNull();
  });
});
