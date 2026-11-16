import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import type { Unite } from '../catalogue/api';
import type { CommandeStatut } from '../commandes/api';

const BASE = '/portail/fournisseur';

export interface FournisseurDashboard {
  fournisseur: { id: number; nom: string };
  aAccuser: number;
  aExpedier: number;
  enLivraison: number;
  livrees: number;
}

export interface FCommandeItem {
  id: number;
  reference: string;
  statutLivraison: CommandeStatut;
  dateEnvoi: string | null;
  dateLivraisonPrevue: string | null;
  dateAccuseReception: string | null;
  nombreLignes: number;
  totalHT: number;
}

export interface FCommande extends Omit<FCommandeItem, 'nombreLignes'> {
  date: string;
  notes: string | null;
  commentaireFournisseur: string | null;
  adresseLivraison: string | null;
  lignes: { id: number; materiauNom: string; quantite: number; quantiteRecue: number; unite: Unite; prixUnitaire: number; totalHT: number }[];
}

export const useFournisseurDashboard = () =>
  useQuery({ queryKey: ['portail-f', 'dashboard'], queryFn: async () => (await api.get<FournisseurDashboard>(`${BASE}/tableau-de-bord`)).data });

export const useFCommandes = (q: { page: number; search?: string; statuts?: CommandeStatut[] }) =>
  useQuery({
    queryKey: ['portail-f', 'commandes', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<FCommandeItem>>(`${BASE}/commandes`, { params: { ...q, statuts: q.statuts?.join(',') || undefined } })).data,
  });

export const useFCommande = (id: number) =>
  useQuery({ queryKey: ['portail-f', 'commande', id], queryFn: async () => (await api.get<FCommande>(`${BASE}/commandes/${id}`)).data });

export function useRepondreCommande(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ...body }: { action: 'accuser-reception' | 'expediee'; dateLivraisonPrevue?: string; commentaire?: string | null }) =>
      (await api.post<FCommande>(`${BASE}/commandes/${id}/${action}`, body)).data,
    onSuccess: (c) => {
      qc.setQueryData(['portail-f', 'commande', id], c);
      void qc.invalidateQueries({ queryKey: ['portail-f', 'commandes'] });
      void qc.invalidateQueries({ queryKey: ['portail-f', 'dashboard'] });
    },
  });
}
