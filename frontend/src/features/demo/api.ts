import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export type DemoStatut = 'PENDING' | 'CONTACTED' | 'SCHEDULED' | 'DONE' | 'CANCELED';

export interface DemoRequest {
  id: number;
  nom: string;
  prenom: string | null;
  email: string;
  telephone: string | null;
  entreprise: string | null;
  message: string | null;
  statut: DemoStatut;
  source: string;
  dateContact: string | null;
  dateDemo: string | null;
  notes: string | null;
  createdAt: string;
  assignedTo: { id: number; nom: string; prenom: string | null } | null;
}

export const useDemoRequests = (q: { page: number; search?: string; statuts?: DemoStatut[] }) =>
  useQuery({
    queryKey: ['demo-requests', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<DemoRequest>>('/demo-requests', { params: { ...q, statuts: q.statuts?.join(',') || undefined } })).data,
  });

/** One request (opened from a notification link). */
export const useDemoRequest = (id: number | null) =>
  useQuery({ queryKey: ['demo-requests', 'one', id], enabled: id !== null, queryFn: async () => (await api.get<DemoRequest>(`/demo-requests/${id}`)).data });

function useDemoWrite<TVars>(fn: (vars: TVars) => Promise<DemoRequest>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['demo-requests'] }) });
}

export const useUpdateDemo = () =>
  useDemoWrite(async ({ id, ...body }: { id: number; assignedToId?: number | null; notes?: string | null }) => (await api.patch<DemoRequest>(`/demo-requests/${id}`, body)).data);

export type DemoAction = 'contacter' | 'planifier' | 'terminer' | 'annuler';
export const useDemoAction = () =>
  useDemoWrite(async ({ id, action, dateDemo }: { id: number; action: DemoAction; dateDemo?: string }) =>
    (await api.post<DemoRequest>(`/demo-requests/${id}/${action}`, action === 'planifier' ? { dateDemo } : {})).data,
  );

/** Public form (no account). `website` is a honeypot: humans never fill it. */
export const useSubmitDemo = () =>
  useMutation({
    mutationFn: async (body: { nom: string; prenom?: string; email: string; telephone?: string; entreprise?: string; message?: string; website?: string }) =>
      (await api.post<{ message: string }>('/public/demo-requests', body)).data,
  });
