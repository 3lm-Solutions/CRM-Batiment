import { defineStateMachine } from '../../../common';
import { DemoRequestStatut } from '../../../generated/prisma/client';

export const DemoMachine = defineStateMachine<DemoRequestStatut>('DEMO', 'demande de démo', {
  PENDING: ['CONTACTED', 'SCHEDULED', 'CANCELED'],
  CONTACTED: ['SCHEDULED', 'CANCELED'],
  SCHEDULED: ['DONE', 'SCHEDULED', 'CANCELED'],
  DONE: [],
  CANCELED: [],
});
