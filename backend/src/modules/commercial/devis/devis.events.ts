/**
 * Quote domain events, emitted AFTER the change is committed.
 * Step 7 (workflow) and Step 10 (audit, notifications) listen to them.
 */
export const DevisEvents = {
  ENVOYE: 'devis.envoye',
  ACCEPTE: 'devis.accepte',
  REFUSE: 'devis.refuse',
  SIGNE: 'devis.signe',
  ANNULE: 'devis.annule',
  PRIX_MODIFIE: 'devis.prix.modifie',
} as const;

export interface DevisEvent {
  companyId: number;
  devisId: number;
  reference: string;
  /** null when the action comes from the client through a link */
  userId: number | null;
  at: Date;
}

export interface DevisPriceChangedEvent extends DevisEvent {
  ligneId: number;
  libelle: string;
  ancienPrix: number;
  nouveauPrix: number;
}
