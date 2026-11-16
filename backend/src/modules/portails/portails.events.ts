/** Domain events of the portals (Step 11), consumed by the notifications listener. */
export const PortailEvents = {
  RAPPORT_SOUMIS: 'portail.rapport.soumis',
  RAPPORT_REVU: 'portail.rapport.revu',
  TACHE_AVANCEE: 'portail.tache.avancee',
  COMMANDE_ACCUSEE: 'portail.commande.accusee',
  COMMANDE_EXPEDIEE: 'portail.commande.expediee',
} as const;

export interface RapportEvent {
  companyId: number;
  rapportId: number;
  chantierId: number;
  chantierReference: string;
  chefChantierId: number | null;
  auteurId: number;
  auteurNom: string;
  statut: 'SOUMIS' | 'VALIDE' | 'REJETE';
}

export interface TacheAvanceeEvent {
  companyId: number;
  chantierId: number;
  chantierReference: string;
  chefChantierId: number | null;
  tacheLibelle: string;
  avancement: number;
  auteurNom: string;
}

export interface CommandePortailEvent {
  companyId: number;
  commandeId: number;
  reference: string;
  fournisseurNom: string;
  dateLivraisonPrevue: Date | null;
}
