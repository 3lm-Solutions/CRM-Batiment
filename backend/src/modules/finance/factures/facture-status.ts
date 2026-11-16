import { defineStateMachine } from '../../../common';
import { FactureStatut } from '../../../generated/prisma/client';

/**
 * BROUILLON ─émettre→ ENVOYEE (numbered, frozen) ─→ PAYEE
 *     └─annuler→ ANNULEE        └─annuler (= credit note issued)→ ANNULEE
 * An issued invoice is never edited or deleted: it can only be cancelled by an AVOIR.
 * v2: the old code let an issued invoice go back to BROUILLON and be edited until paid.
 */
export const FactureMachine = defineStateMachine<FactureStatut>('FACTURE', 'facture', {
  BROUILLON: ['ENVOYEE', 'ANNULEE'],
  ENVOYEE: ['PAYEE', 'ANNULEE'],
  PAYEE: [],
  ANNULEE: [],
});
