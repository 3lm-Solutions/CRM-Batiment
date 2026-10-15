import { DevisStatut } from '../../../generated/prisma/client';
import { BusinessException } from '../../../common';
import { assertEditable, assertTransition, canTransition, DEVIS_TRANSITIONS, sourcesOf } from './devis-status';

describe('devis state machine', () => {
  it.each([
    ['BROUILLON', 'ENVOYE'],
    ['ENVOYE', 'ACCEPTE'],
    ['ENVOYE', 'SIGNE'], // verbal signature
    ['ACCEPTE', 'SIGNE'],
    ['REFUSE', 'REVISE'],
    ['REVISE', 'RENVOYE'],
    ['RENVOYE', 'ACCEPTE'],
  ] as [DevisStatut, DevisStatut][])('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['BROUILLON', 'SIGNE'], // skipping the client
    ['BROUILLON', 'ACCEPTE'],
    ['REFUSE', 'SIGNE'],
    ['SIGNE', 'BROUILLON'],
    ['ANNULE', 'ENVOYE'],
    ['ACCEPTE', 'REVISE'], // supplier orders already exist after acceptance
  ] as [DevisStatut, DevisStatut][])('forbids %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(BusinessException);
  });

  it('SIGNE and ANNULE are final', () => {
    expect(DEVIS_TRANSITIONS.SIGNE).toEqual([]);
    expect(DEVIS_TRANSITIONS.ANNULE).toEqual([]);
  });

  it('every non-final state can be cancelled', () => {
    for (const [from, to] of Object.entries(DEVIS_TRANSITIONS)) {
      if (to.length) expect(to).toContain('ANNULE');
      else expect(['SIGNE', 'ANNULE']).toContain(from);
    }
  });

  it('lists the sources of a target state', () => {
    expect(sourcesOf('SIGNE').sort()).toEqual(['ACCEPTE', 'ENVOYE', 'RENVOYE']);
  });

  it('only drafts and revisions are editable', () => {
    expect(() => assertEditable('BROUILLON')).not.toThrow();
    expect(() => assertEditable('REVISE')).not.toThrow();
    expect(() => assertEditable('ENVOYE')).toThrow(BusinessException);
  });
});
