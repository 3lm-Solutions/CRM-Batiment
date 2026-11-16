import { maskEmail } from './devis-liens.service';

describe('maskEmail', () => {
  it('hides the middle of the local part', () => {
    expect(maskEmail('jean.dupont@mail.fr')).toBe('j*********t@mail.fr');
  });
  it('leaves very short or invalid addresses alone', () => {
    expect(maskEmail('ab@mail.fr')).toBe('ab@mail.fr');
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });
});
