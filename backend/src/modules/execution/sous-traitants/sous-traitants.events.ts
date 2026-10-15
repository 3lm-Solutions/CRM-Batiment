export const SousTraitantEvents = {
  ASSURANCE_STATUT: 'sous-traitant.assurance.statut',
} as const;

/** Emitted by the daily job when an insurance becomes A_RENOUVELER or EXPIREE (Step 10 notifies). */
export interface AssuranceStatutEvent {
  companyId: number;
  assuranceId: number;
  sousTraitantId: number;
  sousTraitantNom: string;
  typeAssurance: string;
  statut: 'A_RENOUVELER' | 'EXPIREE';
  dateExpiration: Date;
}
