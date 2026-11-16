import { pdfDate, pdfMontant, pdfTexte } from './pdf-document';

describe('pdf-document helpers', () => {
  it('replaces characters Helvetica (WinAnsi) cannot draw', () => {
    expect(pdfTexte('L’entreprise « Œuvre » — 1 234 €')).toBe("L'entreprise « OEuvre » - 1 234 €");
    expect(pdfTexte('ligne 1\nligne 2')).toBe('ligne 1 ligne 2');
    expect(pdfTexte('漢字')).toBe('??');
    expect(pdfTexte(null)).toBe('');
  });

  it('formats amounts the French way with plain spaces', () => {
    expect(pdfMontant(1234.5)).toBe('1 234,50 €');
    expect(pdfMontant(-12)).toBe('-12,00 €');
    expect(pdfMontant(0)).toBe('0,00 €');
    expect(pdfMontant({ toNumber: () => 1000000 })).toBe('1 000 000,00 €');
  });

  it('formats dates as DD/MM/YYYY', () => {
    expect(pdfDate(new Date(2026, 10, 5))).toBe('05/11/2026');
    expect(pdfDate(null)).toBe('');
  });
});
