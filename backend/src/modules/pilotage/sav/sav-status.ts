import { defineStateMachine } from '../../../common';
import { SavTicketStatut } from '../../../generated/prisma/client';

/**
 * Cahier des charges SAV 4.1: Nouveau (OUVERT), À qualifier, En attente, Planifié, En cours,
 * Résolu, Clôturé, Rejeté.
 *   A_QUALIFIER (ticket sent by the client) ─qualifier→ OUVERT
 *   OUVERT / A_QUALIFIER → PLANIFIE ⇄ EN_COURS ⇄ EN_ATTENTE_CLIENT
 *              └──→ RESOLU ─→ CLOTURE        (RESOLU → EN_COURS to reopen)
 *   Any open state can be closed directly (duplicate, no follow-up…) or rejected (with a reason);
 *   a rejected ticket can be reopened (REJETE → EN_COURS).
 */
export const SavMachine = defineStateMachine<SavTicketStatut>('SAV', 'ticket', {
  A_QUALIFIER: ['OUVERT', 'PLANIFIE', 'EN_COURS', 'EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE', 'REJETE'],
  OUVERT: ['PLANIFIE', 'EN_COURS', 'EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE', 'REJETE'],
  PLANIFIE: ['EN_COURS', 'EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE', 'REJETE'],
  EN_COURS: ['PLANIFIE', 'EN_ATTENTE_CLIENT', 'RESOLU', 'CLOTURE', 'REJETE'],
  EN_ATTENTE_CLIENT: ['PLANIFIE', 'EN_COURS', 'RESOLU', 'CLOTURE', 'REJETE'],
  RESOLU: ['CLOTURE', 'EN_COURS'],
  REJETE: ['EN_COURS'],
  CLOTURE: [],
});
