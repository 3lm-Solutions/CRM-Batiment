import { defineStateMachine } from '../../../common';
import { SavTicketStatut } from '../../../generated/prisma/client';

/**
 *   OUVERT → EN_COURS ⇄ EN_ATTENTE_CLIENT
 *              └──→ RESOLU ─→ CLOTURE        (RESOLU → EN_COURS to reopen)
 *   Any open state can be closed directly (duplicate, no follow-up…).
 */
export const SavMachine = defineStateMachine<SavTicketStatut>('SAV', 'ticket', {
  OUVERT: ['EN_COURS', 'RESOLU', 'CLOTURE'],
  EN_COURS: ['EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE'],
  EN_ATTENTE_CLIENT: ['EN_COURS', 'RESOLU', 'CLOTURE'],
  RESOLU: ['CLOTURE', 'EN_COURS'],
  CLOTURE: [],
});
