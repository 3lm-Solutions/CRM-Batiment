/** 18/11 (mobile lot A): emitted after the commit — NotificationsListener and AuditListener. */
export const ReceptionEvents = {
  /** A delivery was received with gaps: the office has to check it */
  ECARTS: 'reception.ecarts',
  /** The office accepted or refused a checked delivery */
  CONTROLEE: 'reception.controlee',
} as const;

export interface ReceptionEvent {
  companyId: number;
  receptionId: number;
  commandeId: number;
  /** Reference of the order, e.g. CMD-2026-0042 */
  reference: string;
  /** Who recorded the delivery (gets the decision) */
  auteurId: number | null;
  /** Who did the action of this event */
  userId: number;
  nbEcarts?: number;
  decision?: 'ACCEPTEE' | 'REFUSEE';
  motif?: string | null;
}
