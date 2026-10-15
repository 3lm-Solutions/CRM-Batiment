export const FactureEvents = {
  EMISE: 'facture.emise',
  PAYEE: 'facture.payee',
  ANNULEE: 'facture.annulee',
} as const;

export interface FactureEvent {
  companyId: number;
  factureId: number;
  reference: string | null;
  type: string;
  montantTTC: number;
  userId: number;
}
