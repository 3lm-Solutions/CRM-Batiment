import { DemandeStatut } from '../../../generated/prisma/client';
import { BusinessException } from '../../../common';

/**
 * Quote request lifecycle. CONVERTI is only reached through the conversion into a quote.
 *   NOUVEAU → EN_COURS → QUALIFIE → CONVERTI
 *   any non-final → PERDU ; PERDU → EN_COURS (reopen)
 */
export const DEMANDE_TRANSITIONS: Record<DemandeStatut, readonly DemandeStatut[]> = {
  NOUVEAU: ['EN_COURS', 'QUALIFIE', 'CONVERTI', 'PERDU'],
  EN_COURS: ['QUALIFIE', 'CONVERTI', 'PERDU'],
  QUALIFIE: ['CONVERTI', 'PERDU'],
  PERDU: ['EN_COURS'],
  CONVERTI: [],
};

export function assertDemandeTransition(from: DemandeStatut, to: DemandeStatut): void {
  if (!DEMANDE_TRANSITIONS[from].includes(to)) {
    throw new BusinessException(
      'TRANSITION_DEMANDE_INTERDITE',
      `Une demande ${from} ne peut pas passer à ${to}.`,
    );
  }
}
