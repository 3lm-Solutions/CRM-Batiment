import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import type { Unite } from '../catalogue/api';

export type CommandeStatut = 'CREEE' | 'ENVOYEE' | 'EXPEDIEE' | 'PARTIELLE' | 'RECUE' | 'CLOTUREE' | 'ANNULEE';
/** Deliveries can be recorded in these states (same as the API). */
export const RECEIVABLE: CommandeStatut[] = ['ENVOYEE', 'EXPEDIEE', 'PARTIELLE'];

export interface CommandeListItem {
  id: number;
  reference: string;
  statutLivraison: CommandeStatut;
  date: string;
  dateEnvoi: string | null;
  dateLivraisonPrevue: string | null;
  notes: string | null;
  totalHT: number;
  fournisseur: { id: number; nom: string };
  devis: { id: number; reference: string };
}

export interface LigneCommande {
  id: number;
  materiauId: number | null;
  materiauNom: string;
  quantite: number;
  quantiteRecue: number;
  unite: Unite;
  prixUnitaire: number;
  totalHT: number;
  materiau: { id: number; nom: string; stockActuel: number } | null;
}

export interface Reception {
  id: number;
  dateReception: string;
  notes: string | null;
  user: { id: number; nom: string; prenom: string | null } | null;
  lignes: { id: number; ligneCommandeId: number; quantite: number }[];
}

export interface Commande extends Omit<CommandeListItem, 'fournisseur' | 'devis'> {
  fournisseur: { id: number; nom: string; email: string | null; telephone: string | null };
  devis: { id: number; reference: string; chantierId: number | null };
  lignes: LigneCommande[];
  receptions: Reception[];
}

export interface CommandesQuery {
  page: number;
  search?: string;
  statuts?: CommandeStatut[];
  fournisseurId?: number;
  devisId?: number;
}

export const useCommandes = (q: CommandesQuery) =>
  useQuery({
    queryKey: ['commandes', 'list', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<CommandeListItem>>('/commandes-fournisseur', { params: { ...q, statuts: q.statuts?.join(',') || undefined } })).data,
  });

export const useCommande = (id: number) =>
  useQuery({ queryKey: ['commandes', id], queryFn: async () => (await api.get<Commande>(`/commandes-fournisseur/${id}`)).data });

function useCommandeWrite<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commandes'] });
      // receptions move the stock
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export const useUpdateCommande = (id: number) =>
  useCommandeWrite(async (body: { dateLivraisonPrevue?: string | null; notes?: string | null }) => (await api.patch<Commande>(`/commandes-fournisseur/${id}`, body)).data);

export const useUpdateLignesCommande = (id: number) =>
  useCommandeWrite(async (lignes: { ligneId: number; quantite: number }[]) => (await api.put<Commande>(`/commandes-fournisseur/${id}/lignes`, { lignes })).data);

export const useEnvoyerCommande = (id: number) =>
  useCommandeWrite(async () => (await api.post<{ commande: Commande; emailSent: boolean }>(`/commandes-fournisseur/${id}/envoyer`)).data);

export type CommandeAction = 'expediee' | 'cloturer' | 'annuler';
export const useCommandeAction = (id: number) =>
  useCommandeWrite(async (action: CommandeAction) => (await api.post<Commande>(`/commandes-fournisseur/${id}/${action}`)).data);

export const useReception = (id: number) =>
  useCommandeWrite(async (body: { lignes: { ligneId: number; quantite: number }[]; notes?: string | null }) =>
    (await api.post<Commande>(`/commandes-fournisseur/${id}/receptions`, body)).data,
  );

/** Quantity still expected on a line. */
export const resteARecevoir = (l: { quantite: number; quantiteRecue: number }) => Math.max(0, l.quantite - l.quantiteRecue);
