import { defineStateMachine } from '../../../common';
import type { ProspectStatut } from '../../../generated/prisma/client';

/**
 *   NOUVEAU ──(coordonnées complètes)──→ A_QUALIFIER ──qualifier──→ QUALIFIE (DemandeDevis créée)
 *      └──────────────── rejeter ───────────┴──────────→ REJETE ──rouvrir──→ A_QUALIFIER
 * The sales team can also qualify a NOUVEAU prospect after completing it by hand.
 */
export const ProspectMachine = defineStateMachine<ProspectStatut>('PROSPECT', 'prospect', {
  NOUVEAU: ['A_QUALIFIER', 'QUALIFIE', 'REJETE'],
  A_QUALIFIER: ['QUALIFIE', 'REJETE'],
  QUALIFIE: [],
  REJETE: ['A_QUALIFIER'],
});
