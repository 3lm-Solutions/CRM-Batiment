import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export interface Fournisseur {
  id: number;
  nom: string;
  contact: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  delaiLivraison: number | null;
  conditions: string | null;
  actif: boolean;
  /** Supplier-portal login, if any */
  userId: number | null;
  utilisateur?: { id: number; email: string; prenom: string | null; nom: string } | null;
  _count: { materiaux: number; commandesFournisseur: number };
  /** First 3 active materials (the list shows « Carrelage 60x60, Colle… +4 ») */
  materiaux?: { id: number; nom: string }[];
}

/** `userId` only on creation (existing portal account); afterwards PUT /fournisseurs/:id/compte. */
export type FournisseurInput = Partial<Omit<Fournisseur, 'id' | '_count' | 'userId' | 'utilisateur' | 'materiaux'>> & {
  userId?: number | null;
  /** The materials it supplies: replaces the current list (one supplier per material) */
  materiauIds?: number[];
};

export const useFournisseurs = (q: { page: number; search?: string; actif?: '' | 'true' | 'false'; limit?: number }, enabled = true) =>
  useQuery({
    queryKey: ['fournisseurs', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Fournisseur>>('/fournisseurs', { params: { ...q, actif: q.actif || undefined } })).data,
  });

function useFournisseurWrite<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fournisseurs'] });
      // a material's supplier may have changed
      void qc.invalidateQueries({ queryKey: ['catalogue', 'materiaux'] });
    },
  });
}

export const useSaveFournisseur = () =>
  useFournisseurWrite(async ({ id, ...body }: FournisseurInput & { id?: number }) =>
    (id ? await api.patch<Fournisseur>(`/fournisseurs/${id}`, body) : await api.post<Fournisseur>('/fournisseurs', body)).data,
  );

/** « Rattacher des matériaux » (e.g. from a new supplier order). The list replaces the current one. */
export function useRemplacerMateriaux() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, materiauIds }: { id: number; materiauIds: number[] }) => (await api.put(`/fournisseurs/${id}/materiaux`, { materiauIds })).data as unknown,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fournisseurs'] });
      void qc.invalidateQueries({ queryKey: ['catalogue', 'materiaux'] });
    },
  });
}

export const useDeleteFournisseur = () => useFournisseurWrite(async (id: number) => api.delete(`/fournisseurs/${id}`));

export const useLierCompteFournisseur = () =>
  useFournisseurWrite(async ({ id, userId }: { id: number; userId: number | null }) => (await api.put<Fournisseur>(`/fournisseurs/${id}/compte`, { userId })).data);
