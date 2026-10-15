import { defineStateMachine } from '../../../common';
import { ContratSousTraitantStatut } from '../../../generated/prisma/client';

export const ContratMachine = defineStateMachine<ContratSousTraitantStatut>('CONTRAT', 'contrat', {
  BROUILLON: ['ACTIF', 'RESILIE'],
  ACTIF: ['TERMINE', 'RESILIE'],
  TERMINE: [],
  RESILIE: [],
});
