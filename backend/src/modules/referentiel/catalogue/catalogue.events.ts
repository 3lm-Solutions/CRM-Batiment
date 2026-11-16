/**
 * Domain events emitted by the catalogue, AFTER the change is saved.
 * The audit module (Step 10) listens to them to build the price history
 * ("Historique des signatures et modifications de prix", spec Audit P0).
 */
export const CATALOGUE_PRICE_CHANGED = 'catalogue.prix.modifie';

export interface CataloguePriceChangedEvent {
  companyId: number;
  userId: number;
  entite: 'Materiau' | 'ServiceMainOeuvre' | 'Prestation';
  entiteId: number;
  libelle: string;
  champ: string;
  ancienneValeur: number;
  nouvelleValeur: number;
}
