import { assuranceStatut, noteGlobale } from './assurance-status';
import { ContratMachine } from './contrat-status';

describe('sous-traitants rules', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

  it('derives the insurance status from the expiry date', () => {
    expect(assuranceStatut(inDays(90), now)).toBe('VALIDE');
    expect(assuranceStatut(inDays(30), now)).toBe('A_RENOUVELER');
    expect(assuranceStatut(inDays(1), now)).toBe('A_RENOUVELER');
    expect(assuranceStatut(inDays(0), now)).toBe('EXPIREE');
    expect(assuranceStatut(inDays(-5), now)).toBe('EXPIREE');
  });

  it('an "à renouveler" insurance does become EXPIREE (old cron bug)', () => {
    const date = inDays(10);
    expect(assuranceStatut(date, now)).toBe('A_RENOUVELER');
    expect(assuranceStatut(date, inDays(11))).toBe('EXPIREE');
  });

  it('computes the global mark', () => {
    expect(noteGlobale(5, 4, 4)).toBe(4.33);
  });

  it('contract lifecycle', () => {
    expect(ContratMachine.can('BROUILLON', 'ACTIF')).toBe(true);
    expect(ContratMachine.can('TERMINE', 'ACTIF')).toBe(false);
  });
});
