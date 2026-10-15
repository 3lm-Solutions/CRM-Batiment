import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export const LEAD_SOURCES = {
  CHATBOT: 'Chatbot',
  TECHNICO_COMMERCIAL: 'Technico-commercial',
  APPEL: 'Appel',
  RECOMMANDATION: 'Recommandation',
  SITE_WEB: 'Site web',
  WHATSAPP: 'WhatsApp',
  AUTRE: 'Autre',
} as const;
export type LeadSource = keyof typeof LEAD_SOURCES;
export const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCES).map(([value, label]) => ({ value, label }));

export interface Client {
  id: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresseClient: string | null;
  adresseChantier: string | null;
  source: LeadSource;
  besoin: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  typeProjets: { id: number; nom: string }[];
  typeProjetIds: number[];
}

export interface ClientDetail extends Client {
  demandesDevis: { id: number; reference: string; statut: string; createdAt: string }[];
  devis: { id: number; reference: string; statut: string; totalTTC: number; createdAt: string }[];
  chantiers: { id: number; reference: string; statut: string; adresse: string }[];
  _count: { demandesDevis: number; devis: number; chantiers: number; savTickets: number };
}

export interface ClientInput {
  id?: number;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresseClient: string | null;
  adresseChantier: string | null;
  source: LeadSource;
  besoin: string | null;
  notes: string | null;
  typeProjetIds: number[];
}

export interface ClientsQuery {
  page: number;
  search?: string;
  source?: LeadSource | '';
  archived?: boolean;
  limit?: number;
}

export const useClients = (q: ClientsQuery, enabled = true) =>
  useQuery({
    queryKey: ['clients', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Client>>('/clients', { params: { ...q, source: q.source || undefined, archived: q.archived || undefined } })).data,
  });

export const useClient = (id: number) =>
  useQuery({ queryKey: ['clients', id], queryFn: async () => (await api.get<ClientDetail>(`/clients/${id}`)).data });

export const useTypesProjet = () =>
  useQuery({
    queryKey: ['types-projet'],
    staleTime: 10 * 60_000,
    queryFn: async () => (await api.get<{ id: number; nom: string }[]>('/types-projet')).data,
  });

export function useSaveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ClientInput) =>
      id ? (await api.patch<Client>(`/clients/${id}`, body)).data : (await api.post<Client>('/clients', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useClientAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'archive' | 'unarchive' | 'delete' }) => {
      if (action === 'delete') await api.delete(`/clients/${id}`);
      else await api.post(`/clients/${id}/${action}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
