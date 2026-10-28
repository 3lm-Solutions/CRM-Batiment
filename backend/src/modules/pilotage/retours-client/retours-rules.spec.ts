import { assertChantierOuvertAuxRetours, assertQuotaRetours, MAX_RETOURS_JOUR, objetRetour } from './retours-rules';

const code = (fn: () => void) => {
  try {
    fn();
    return 'OK';
  } catch (e) {
    return (e as { getResponse?: () => { code: string } }).getResponse?.().code ?? String(e);
  }
};

describe('Retours client — règles (26/10)', () => {
  it('open during the works and right after; closed or cancelled job sites refuse', () => {
    for (const s of ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE'] as const) expect(code(() => assertChantierOuvertAuxRetours(s))).toBe('OK');
    expect(code(() => assertChantierOuvertAuxRetours('CLOTURE'))).toBe('CHANTIER_FERME');
    expect(code(() => assertChantierOuvertAuxRetours('ANNULE'))).toBe('CHANTIER_FERME');
  });

  it('daily quota', () => {
    expect(code(() => assertQuotaRetours(MAX_RETOURS_JOUR - 1))).toBe('OK');
    expect(code(() => assertQuotaRetours(MAX_RETOURS_JOUR))).toBe('TROP_DE_MESSAGES');
  });

  it('says what the message is about', () => {
    expect(objetRetour({ chantier: 'CH-1' })).toBe('le chantier CH-1');
    expect(objetRetour({ chantier: 'CH-1', tache: 'Faïence' })).toBe('la tâche « Faïence »');
    expect(objetRetour({ chantier: 'CH-1', tache: 'Faïence', photo: { moment: 'APRES', date: new Date('2026-10-26T00:00:00Z') } })).toBe('« Faïence » — photo après du 26/10/2026');
  });
});
