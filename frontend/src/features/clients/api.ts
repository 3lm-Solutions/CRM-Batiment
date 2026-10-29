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
  EMAIL: 'Email',
  AUTRE: 'Autre',
} as const;
export type LeadSource = keyof typeof LEAD_SOURCES;
export const LEAD_SOURCE_OPTIONS = Object.entries(LEAD_SOURCES).map(([value, label]) => ({ value, label }));

/** Étape 1 (26/10): private person or company. For a company, `nom` is its company name. */
export const TYPES_CLIENT = { PARTICULIER: 'Particulier', PROFESSIONNEL: 'Professionnel' } as const;
export type TypeClient = keyof typeof TYPES_CLIENT;
/** 27/10: prospect → qualified prospect → client (first signed quote). Moves up automatically. */
export const STATUTS_CLIENT = { PROSPECT: 'Prospect', QUALIFIE: 'Prospect qualifié', CLIENT: 'Client' } as const;
export type StatutClient = keyof typeof STATUTS_CLIENT;
export const STATUT_CLIENT_TONE: Record<StatutClient, 'slate' | 'blue' | 'green'> = { PROSPECT: 'slate', QUALIFIE: 'blue', CLIENT: 'green' };

export const TYPE_CLIENT_OPTIONS = Object.entries(TYPES_CLIENT).map(([value, label]) => ({ value, label }));

/** « 73282932000074 » → « 732 829 320 00074 » */
export const formatSiret = (s: string) => (/^\d{14}$/.test(s) ? `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}` : s);

/** Company fields of a client, as printed on quotes and invoices. */
export interface ClientPro {
  typeClient?: TypeClient;
  siret?: string | null;
  tvaIntracom?: string | null;
  contactNom?: string | null;
}

export interface Client {
  id: number;
  typeClient: TypeClient;
  statut: StatutClient;
  devenuClientLe: string | null;
  nom: string;
  prenom: string | null;
  siret: string | null;
  tvaIntracom: string | null;
  contactNom: string | null;
  contactFonction: string | null;
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
  /** Chef de chantier (29/10): only the signed quotes of his job sites, without amount */
  devis: { id: number; reference: string; statut: string; totalTTC?: number; createdAt: string }[];
  chantiers: { id: number; reference: string; statut: string; adresse: string }[];
  _count: { demandesDevis: number; devis: number; chantiers: number; savTickets: number };
}

export interface ClientInput {
  id?: number;
  typeClient: TypeClient;
  statut?: StatutClient;
  nom: string;
  prenom: string | null;
  siret: string | null;
  tvaIntracom: string | null;
  contactNom: string | null;
  contactFonction: string | null;
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
  typeClient?: TypeClient | '';
  /** PROSPECT,QUALIFIE (page Prospects) or CLIENT (page Clients) */
  statuts?: StatutClient[];
  archived?: boolean;
  limit?: number;
}

export const useClients = (q: ClientsQuery, enabled = true) =>
  useQuery({
    queryKey: ['clients', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Client>>('/clients', { params: { ...q, statuts: q.statuts?.length ? q.statuts.join(',') : undefined, source: q.source || undefined, typeClient: q.typeClient || undefined, archived: q.archived || undefined } })).data,
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

/** 27/10: change only the stage (prospect / qualified / client). */
export function useChangerStatutClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, statut }: { id: number; statut: StatutClient }) => (await api.patch<Client>(`/clients/${id}`, { statut })).data,
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
