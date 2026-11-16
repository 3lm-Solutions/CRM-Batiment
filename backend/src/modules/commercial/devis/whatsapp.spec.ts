import { lienWhatsapp, messageWhatsapp, numeroWhatsapp } from './whatsapp';

describe('whatsapp', () => {
  it('normalises French numbers to international digits', () => {
    expect(numeroWhatsapp('06 12 34 56 78')).toBe('33612345678');
    expect(numeroWhatsapp('06.12.34.56.78')).toBe('33612345678');
    expect(numeroWhatsapp('+33 6 12 34 56 78')).toBe('33612345678');
    expect(numeroWhatsapp('0033612345678')).toBe('33612345678');
    expect(numeroWhatsapp('+33 0612345678')).toBe('33612345678');
    expect(numeroWhatsapp('+216 20 123 456')).toBe('21620123456');
  });

  it('rejects empty or invalid numbers', () => {
    expect(numeroWhatsapp(null)).toBeNull();
    expect(numeroWhatsapp('')).toBeNull();
    expect(numeroWhatsapp('abc')).toBeNull();
    expect(numeroWhatsapp('123')).toBeNull();
  });

  it('builds an encoded wa.me link', () => {
    const msg = messageWhatsapp({
      clientNom: 'Jean Dupont',
      reference: 'DEV-2026-0001',
      totalTTC: '1 200,00 €',
      entreprise: 'Bati Pro',
      url: 'https://app/devis/x?t=1&a=2',
    });
    const lien = lienWhatsapp('33612345678', msg);
    expect(lien.startsWith('https://wa.me/33612345678?text=')).toBe(true);
    expect(decodeURIComponent(lien.split('text=')[1])).toBe(msg);
    expect(lien).not.toContain(' ');
  });
});
