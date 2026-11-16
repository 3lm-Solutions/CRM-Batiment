import { BadRequestException } from '@nestjs/common';

export type DevisStatus = 'BROUILLON' | 'ENVOYE' | 'ACCEPTE' | 'SIGNE' | 'REFUSE' | 'ANNULE' | 'REVISE' | 'RENVOYE';
export type ChantierStatus = 'VISITE_TECHNIQUE' | 'DEVIS_EN_PREPARATION' | 'DEVIS_ENVOYE' | 'NEGOCIATION_EN_COURS' | 'DEVIS_VALIDE' | 'COMMANDES_GENEREES' | 'MATERIAUX_EN_LIVRAISON' | 'MATERIAUX_RECEPTIONNES' | 'PLANIFIE' | 'DEMARRE' | 'EN_COURS' | 'TERMINE' | 'CLOTURE';

export const DEVIS_TRANSITIONS: Record<DevisStatus, DevisStatus[]> = {
  BROUILLON: ['ENVOYE', 'ANNULE'],
  ENVOYE: ['ACCEPTE', 'REFUSE', 'ANNULE'],
  ACCEPTE: ['SIGNE', 'ANNULE'],
  SIGNE: [],
  REFUSE: ['REVISE', 'ANNULE'],
  REVISE: ['RENVOYE', 'ANNULE'],
  RENVOYE: ['ACCEPTE', 'REFUSE', 'ANNULE'],
  ANNULE: [],
};

export const CHANTIER_TRANSITIONS: Record<ChantierStatus, ChantierStatus[]> = {
  VISITE_TECHNIQUE: ['DEVIS_EN_PREPARATION'],
  DEVIS_EN_PREPARATION: ['DEVIS_ENVOYE'],
  DEVIS_ENVOYE: ['NEGOCIATION_EN_COURS', 'DEVIS_VALIDE'],
  NEGOCIATION_EN_COURS: ['DEVIS_VALIDE', 'DEVIS_EN_PREPARATION'],
  DEVIS_VALIDE: ['COMMANDES_GENEREES', 'PLANIFIE'],
  COMMANDES_GENEREES: ['MATERIAUX_EN_LIVRAISON', 'PLANIFIE'],
  MATERIAUX_EN_LIVRAISON: ['MATERIAUX_RECEPTIONNES', 'PLANIFIE'],
  MATERIAUX_RECEPTIONNES: ['PLANIFIE'],
  PLANIFIE: ['DEMARRE'],
  DEMARRE: ['EN_COURS', 'TERMINE'],
  EN_COURS: ['TERMINE', 'CLOTURE'],
  TERMINE: ['CLOTURE'],
  CLOTURE: [],
};

function assertTransition<T extends string>(current: T, next: T, transitions: Record<T, T[]>) {
  if (current === next) return;
  const allowed = transitions[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestException(`Transition ${current} -> ${next} non autorisee. Transitions possibles : ${allowed.length ? allowed.join(', ') : 'aucune (statut final)'}`);
  }
}

export function validateDevisStatusTransition(current: DevisStatus, next: DevisStatus) {
  assertTransition(current, next, DEVIS_TRANSITIONS);
}

export function validateChantierStatusTransition(current: ChantierStatus, next: ChantierStatus) {
  assertTransition(current, next, CHANTIER_TRANSITIONS);
}
