/** Domain events of the clients. */
export const ClientEvents = {
  /** A client was created: his online space is opened automatically (see EspaceClientService). */
  CREE: 'client.cree',
} as const;

export interface ClientCreeEvent {
  companyId: number;
  clientId: number;
  /** The staff member who created him (recorded as the link's creator). */
  userId: number;
}
