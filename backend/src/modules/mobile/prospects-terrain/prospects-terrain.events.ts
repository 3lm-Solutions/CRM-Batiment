/** 16/11 (mobile lot 1): emitted after the commit; NotificationsListener tells the sales team. */
export const ProspectTerrainEvents = { CREE: 'prospect-terrain.cree' } as const;

export interface ProspectTerrainCreeEvent {
  companyId: number;
  demandeId: number;
  reference: string;
  clientNom: string;
  auteurId: number;
  auteurNom: string;
}
