import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse, Role } from '@/shared';
import { api } from '@/lib/api';

export type ChantierStatut = 'PLANIFIE' | 'EN_COURS' | 'SUSPENDU' | 'TERMINE' | 'CLOTURE' | 'ANNULE';
export type TacheStatut = 'A_FAIRE' | 'EN_COURS' | 'BLOQUEE' | 'TERMINEE';
export const TACHE_STATUTS: TacheStatut[] = ['A_FAIRE', 'EN_COURS', 'BLOQUEE', 'TERMINEE'];

type Person = { id: number; nom: string; prenom: string | null };

export interface ChantierListItem {
  id: number;
  reference: string;
  statut: ChantierStatut;
  adresse: string;
  dateDebut: string | null;
  dateFin: string | null;
  client: Person;
  chefChantier: Person | null;
  avancement: number;
  nombreTaches: number;
}

export interface Tache {
  id: number;
  chantierId: number;
  libelle: string;
  description: string | null;
  statut: TacheStatut;
  dateDebut: string | null;
  dateFin: string | null;
  avancement: number;
  commentaire: string | null;
  ordre: number;
  affectations: { id: number; userId: number | null; user: (Person & { role: Role }) | null }[];
}

export interface DocumentChantier {
  id: number;
  nom: string;
  type: string;
  /** External link, or null when the document is an uploaded file */
  url: string | null;
  fichierId: number | null;
  createdAt: string;
}

export interface ChantierDetail extends Omit<ChantierListItem, 'nombreTaches' | 'client' | 'chefChantier'> {
  description: string | null;
  notes: string | null;
  plan2d: Record<string, unknown> | null;
  client: Person & { telephone: string | null; email?: string | null };
  chefChantier: (Person & { telephone: string | null }) | null;
  // totals only for the office
  devis: { id: number; reference: string; statut: string; totalHT?: number; totalTTC?: number }[];
  taches: Tache[];
  documents: DocumentChantier[];
  sousTraitantsVisibles?: { user: Person }[];
}

export interface ChantiersQuery {
  page: number;
  search?: string;
  statuts?: ChantierStatut[];
  clientId?: number;
  limit?: number;
}

export const useChantiers = (q: ChantiersQuery, enabled = true) =>
  useQuery({
    queryKey: ['chantiers', 'list', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<ChantierListItem>>('/chantiers', { params: { ...q, statuts: q.statuts?.join(',') || undefined } })).data,
  });

export const useChantier = (id: number) =>
  useQuery({ queryKey: ['chantiers', id], queryFn: async () => (await api.get<ChantierDetail>(`/chantiers/${id}`)).data });

/** Any write on a job site refreshes its detail and the lists. */
function useChantierMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['chantiers'] }) });
}

export interface ChantierInput {
  clientId?: number;
  adresse?: string;
  description?: string | null;
  notes?: string | null;
  chefChantierId?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

export const useSaveChantier = () =>
  useChantierMutation(async ({ id, ...body }: ChantierInput & { id?: number }) =>
    (id ? await api.patch<ChantierDetail>(`/chantiers/${id}`, body) : await api.post<ChantierDetail>('/chantiers', body)).data,
  );

export type ChantierAction = 'demarrer' | 'suspendre' | 'reprendre' | 'terminer' | 'cloturer' | 'annuler';
export const useChantierAction = (id: number) =>
  useChantierMutation(async (action: ChantierAction) => (await api.post(`/chantiers/${id}/${action}`)).data);

export const useDeleteChantier = () => useChantierMutation(async (id: number) => api.delete(`/chantiers/${id}`));

export const useSetAccesSousTraitants = (id: number) =>
  useChantierMutation(async (userIds: number[]) => (await api.put(`/chantiers/${id}/acces-sous-traitants`, { userIds })).data);

export const useAddDocument = (id: number) =>
  useChantierMutation(async (body: { nom: string; type: string; url?: string; fichierId?: number }) => (await api.post(`/chantiers/${id}/documents`, body)).data);

export const useDeleteDocument = (id: number) =>
  useChantierMutation(async (documentId: number) => api.delete(`/chantiers/${id}/documents/${documentId}`));

export interface TacheInput {
  libelle?: string;
  description?: string | null;
  statut?: TacheStatut;
  avancement?: number;
  dateDebut?: string | null;
  dateFin?: string | null;
  commentaire?: string | null;
  assigneeIds?: number[];
}

export const useSaveTache = (chantierId: number) =>
  useChantierMutation(async ({ id, ...body }: TacheInput & { id?: number }) =>
    (id
      ? await api.patch<Tache>(`/chantiers/${chantierId}/taches/${id}`, body)
      : await api.post<Tache>(`/chantiers/${chantierId}/taches`, body)
    ).data,
  );

export const useDeleteTache = (chantierId: number) =>
  useChantierMutation(async (id: number) => api.delete(`/chantiers/${chantierId}/taches/${id}`));
