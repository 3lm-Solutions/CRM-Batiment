export const RELANCE_ENVOYEE = 'relance.envoyee';

export interface RelanceEnvoyeeEvent {
  companyId: number;
  userId: number | null;
  type: 'DEVIS' | 'FACTURE';
  entiteId: number;
  reference: string | null;
  niveau: number;
  automatique: boolean;
  destinataire: string;
  emailEnvoye: boolean;
}
