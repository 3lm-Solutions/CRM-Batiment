import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Unite } from '../catalogue/api';
import type { DevisStatut } from '../devis/api';
import type { ClientPro } from '../clients/api';

/** Exactly what the API exposes to a client link (no costs, no margins). */
export interface PublicDevis {
  lien: {
    type: 'VALIDATION' | 'SIGNATURE';
    statut: 'ACTIF' | 'OTP_ENVOYE' | 'OTP_VERIFIE' | 'UTILISE' | 'BLOQUE' | 'EXPIRE' | 'ANNULE';
    expiresAt: string;
    peutRepondre: boolean;
    peutDemanderCode: boolean;
    peutSigner: boolean;
  };
  devis: {
    reference: string;
    statut: DevisStatut;
    versionCourante: number;
    dateCreation: string;
    dateEnvoi: string | null;
    tauxTVA: number;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    signatureClientDate: string | null;
    company: { nom: string; adresse: string | null; email: string | null; telephone: string | null; siret: string | null; logo: string | null };
    client: ClientPro & { nom: string; prenom: string | null; adresseClient: string | null; adresseChantier: string | null };
    createur: { prenom: string; nom: string; email: string; telephone: string | null } | null;
    lignes: {
      ordre: number;
      description: string | null;
      quantite: number;
      unite: Unite;
      dimension: string | null;
      couleur: string | null;
      finition: string | null;
      prixUnitaireVente: number;
      totalHT: number;
    }[];
  };
}

export const usePublicDevis = (token: string) =>
  useQuery({
    queryKey: ['public-devis', token],
    retry: false,
    queryFn: async () => (await api.get<PublicDevis>(`/public/devis/${token}`)).data,
  });

type PublicAction =
  | { action: 'accepter' }
  | { action: 'refuser'; body: { motif?: string } }
  | { action: 'code' }
  | { action: 'code/verifier'; body: { code: string } }
  | { action: 'signer'; body: { signatureBase64: string } };

export function usePublicAction(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: PublicAction) =>
      (await api.post<{ message?: string; envoyeA?: string; expiresAt?: string }>(`/public/devis/${token}/${a.action}`, 'body' in a ? a.body : {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-devis', token] }),
  });
}
