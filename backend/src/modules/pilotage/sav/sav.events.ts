export const SavEvents = { CREE: 'sav.cree', ASSIGNE: 'sav.assigne' } as const;

export interface SavEvent {
  companyId: number;
  ticketId: number;
  reference: string;
  titre: string;
  priorite: string;
  assignedToId: number | null;
}
