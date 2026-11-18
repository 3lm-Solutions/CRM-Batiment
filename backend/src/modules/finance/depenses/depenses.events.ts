/** 18/11 (mobile lot A): emitted after the commit — NotificationsListener and AuditListener. */
export const DepenseEvents = {
  /** A supplier invoice was sent from the field: the office has to check it */
  CREEE: 'depense.creee',
  /** The office validated or refused it */
  DECIDEE: 'depense.decidee',
} as const;

export interface DepenseEvent {
  companyId: number;
  depenseId: number;
  reference: string;
  fournisseurNom: string;
  numeroFacture: string;
  /** Who sent it (gets the decision) */
  createurId: number | null;
  /** Who did the action of this event */
  userId: number;
  decision?: 'VALIDEE' | 'REFUSEE';
  motif?: string | null;
}
