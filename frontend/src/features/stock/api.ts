import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import type { Unite } from '../catalogue/api';

export type TypeMouvement = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';

export interface StockItem {
  id: number;
  nom: string;
  unite: Unite;
  prixAchatFixe: number;
  stockActuel: number;
  stockMinimum: number;
  alerte: boolean;
  valeurStock: number;
  fournisseur: { id: number; nom: string } | null;
}

export interface Mouvement {
  id: number;
  type: TypeMouvement;
  quantite: number;
  stockAvant: number;
  stockApres: number;
  motif: string | null;
  reference: string | null;
  createdAt: string;
  materiau: { id: number; nom: string; unite: Unite };
  user: { id: number; nom: string; prenom: string | null } | null;
  chantier: { id: number; reference: string } | null;
}

export const useStock = (q: { page: number; search?: string; alerte?: boolean }) =>
  useQuery({
    queryKey: ['stock', 'list', q],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PaginatedResponse<StockItem>>('/stock', { params: { ...q, alerte: q.alerte || undefined } })).data,
  });

export const useMouvements = (q: { page: number; materiauId?: number; type?: TypeMouvement | '' }) =>
  useQuery({
    queryKey: ['stock', 'mouvements', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Mouvement>>('/stock/mouvements', { params: { ...q, type: q.type || undefined } })).data,
  });

export function useCreateMouvement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { materiauId: number; type: TypeMouvement; quantite: number; chantierId?: number; motif?: string }) =>
      (await api.post<Mouvement>('/stock/mouvements', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock'] }),
  });
}
