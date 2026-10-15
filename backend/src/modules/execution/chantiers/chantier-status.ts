import { defineStateMachine } from '../../../common';
import { ChantierStatut } from '../../../generated/prisma/client';

/**
 *   PLANIFIE ─démarrer→ EN_COURS ─terminer→ TERMINE ─clôturer→ CLOTURE
 *                          ↕ suspendre / reprendre       └─rouvrir→ EN_COURS (réserves)
 *                       SUSPENDU
 *   Any non-final state → ANNULE.
 */
export const ChantierMachine = defineStateMachine<ChantierStatut>('CHANTIER', 'chantier', {
  PLANIFIE: ['EN_COURS', 'ANNULE'],
  EN_COURS: ['SUSPENDU', 'TERMINE', 'ANNULE'],
  SUSPENDU: ['EN_COURS', 'ANNULE'],
  TERMINE: ['CLOTURE', 'EN_COURS'],
  CLOTURE: [],
  ANNULE: [],
});
