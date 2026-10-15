import { defineStateMachine } from '../../../common';
import { CommandeFournisseurStatut } from '../../../generated/prisma/client';

/**
 *   CREEE ─envoyer→ ENVOYEE ─(expédiée)→ EXPEDIEE
 *                      └──── réceptions ────→ PARTIELLE ─→ RECUE ─clôturer→ CLOTUREE
 *   CREEE / ENVOYEE → ANNULEE.  A partial order can be closed (remaining quantity abandoned).
 */
export const CommandeMachine = defineStateMachine<CommandeFournisseurStatut>('COMMANDE', 'bon de commande', {
  CREEE: ['ENVOYEE', 'ANNULEE'],
  ENVOYEE: ['EXPEDIEE', 'PARTIELLE', 'RECUE', 'ANNULEE'],
  EXPEDIEE: ['PARTIELLE', 'RECUE'],
  PARTIELLE: ['RECUE', 'CLOTUREE'],
  RECUE: ['CLOTUREE'],
  CLOTUREE: [],
  ANNULEE: [],
});

export const RECEIVABLE: CommandeFournisseurStatut[] = ['ENVOYEE', 'EXPEDIEE', 'PARTIELLE'];
