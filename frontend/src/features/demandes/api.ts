import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import type { LeadSource } from '../clients/api';
import type { DevisStatut } from '../devis/api';

export type DemandeStatut = 'NOUVEAU' | 'EN_COURS' | 'QUALIFIE' | 'CONVERTI' | 'PERDU';

export interface Demande {
  id: number;
  reference: string;
  statut: DemandeStatut;
  description: string;
  source: LeadSource;
  createdAt: string;
  client: { id: number; nom: string; prenom: string | null; email: string | null; telephone: string | null };
  createur: { id: number; nom: string; prenom: string } | null;
  devis: { id: number; reference: string; statut: DevisStatut }[];
}

export interface DemandesQuery {
  page: number;
  search?: string;
  statuts?: DemandeStatut[];
}

export const useDemandes = (q: DemandesQuery) =>
  useQuery({
    queryKey: ['demandes', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Demande>>('/demandes-devis', { params: { ...q, statuts: q.statuts?.join(',') || undefined } })).data,
  });

export type DemandeAction = 'prendre-en-charge' | 'qualifier' | 'perdre' | 'reouvrir' | 'convertir-en-devis';

export function useDemandeAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: DemandeAction }) => (await api.post<{ id: number }>(`/demandes-devis/${id}/${action}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['demandes'] });
      void qc.invalidateQueries({ queryKey: ['devis', 'list'] });
    },
  });
}

/** E6 of 20/10: correct a request (not once converted). */
export function useUpdateDemande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; description: string; source: LeadSource }) => (await api.patch<Demande>(`/demandes-devis/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demandes'] }),
  });
}

/** Deleted for good (ADMIN, TECHNICO) — refused once a quote exists: mark it lost instead. */
export function useDeleteDemande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/demandes-devis/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demandes'] }),
  });
}

export function useCreateDemande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { clientId: number; description: string; source: LeadSource }) => (await api.post<Demande>('/demandes-devis', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demandes'] }),
  });
}
