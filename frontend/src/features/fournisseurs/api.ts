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
  typesMateriaux: string | null;
  delaiLivraison: number | null;
  conditions: string | null;
  actif: boolean;
  /** Supplier-portal login, if any */
  userId: number | null;
  _count: { materiaux: number; commandesFournisseur: number };
}

export type FournisseurInput = Partial<Omit<Fournisseur, 'id' | '_count' | 'userId'>>;

export const useFournisseurs = (q: { page: number; search?: string; actif?: '' | 'true' | 'false' }) =>
  useQuery({
    queryKey: ['fournisseurs', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Fournisseur>>('/fournisseurs', { params: { ...q, actif: q.actif || undefined } })).data,
  });

function useFournisseurWrite<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['fournisseurs'] }) });
}

export const useSaveFournisseur = () =>
  useFournisseurWrite(async ({ id, ...body }: FournisseurInput & { id?: number }) =>
    (id ? await api.patch<Fournisseur>(`/fournisseurs/${id}`, body) : await api.post<Fournisseur>('/fournisseurs', body)).data,
  );

export const useDeleteFournisseur = () => useFournisseurWrite(async (id: number) => api.delete(`/fournisseurs/${id}`));

export const useLierCompteFournisseur = () =>
  useFournisseurWrite(async ({ id, userId }: { id: number; userId: number | null }) => (await api.put<Fournisseur>(`/fournisseurs/${id}/compte`, { userId })).data);
