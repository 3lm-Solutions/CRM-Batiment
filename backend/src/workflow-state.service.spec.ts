import { BadRequestException } from '@nestjs/common';
import { validateChantierStatusTransition, validateDevisStatusTransition } from './workflow-transitions.js';

describe('WorkflowStateService transitions', () => {
  it('allows the normal devis progression', () => {
    expect(() => validateDevisStatusTransition('BROUILLON', 'ENVOYE')).not.toThrow();
    expect(() => validateDevisStatusTransition('ENVOYE', 'ACCEPTE')).not.toThrow();
    expect(() => validateDevisStatusTransition('ACCEPTE', 'SIGNE')).not.toThrow();
  });

  it('allows refusal and revision paths', () => {
    expect(() => validateDevisStatusTransition('ENVOYE', 'REFUSE')).not.toThrow();
    expect(() => validateDevisStatusTransition('REFUSE', 'REVISE')).not.toThrow();
    expect(() => validateDevisStatusTransition('REVISE', 'RENVOYE')).not.toThrow();
  });

  it('rejects incoherent devis transitions', () => {
    expect(() => validateDevisStatusTransition('BROUILLON', 'SIGNE')).toThrow(BadRequestException);
    expect(() => validateDevisStatusTransition('REFUSE', 'SIGNE')).toThrow(BadRequestException);
    expect(() => validateDevisStatusTransition('SIGNE', 'BROUILLON')).toThrow(BadRequestException);
  });

  it('rejects backward chantier transitions', () => {
    expect(() => validateChantierStatusTransition('EN_COURS', 'PLANIFIE')).toThrow(BadRequestException);
    expect(() => validateChantierStatusTransition('CLOTURE', 'EN_COURS')).toThrow(BadRequestException);
  });
});