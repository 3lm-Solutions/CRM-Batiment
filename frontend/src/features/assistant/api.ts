import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

// ── public chatbot ─────────────────────────────────────────────────────────

export interface ChatSessionRef {
  sessionId: number;
  token: string;
}

export interface ChatStart extends ChatSessionRef {
  entreprise: string;
  message: string;
  suggestions: string[];
  modeIA: boolean;
}

export interface ChatReply {
  reponse: string;
  suggestions: string[];
  champsManquants: string[];
  prospectEnregistre: boolean;
  besoinHumain: boolean;
}

export interface ChatHistory {
  messages: { id: number; role: 'user' | 'assistant'; contenu: string; createdAt: string }[];
  prospectEnregistre: boolean;
  champsManquants: string[];
}

export interface Coordonnees {
  nom: string;
  prenom?: string | null;
  email?: string;
  telephone?: string;
  adresse?: string | null;
  typeProjet?: string | null;
  description: string;
  delai?: string | null;
}

const BASE = '/public/assistant/sessions';
const headers = (s: ChatSessionRef) => ({ 'x-chat-token': s.token });

/** Plain functions: the widget manages its own state (no cache shared with the back-office). */
export const chatApi = {
  start: async (companyId: number) => (await api.post<ChatStart>(BASE, { companyId })).data,
  history: async (s: ChatSessionRef) => (await api.get<ChatHistory>(`${BASE}/${s.sessionId}`, { headers: headers(s) })).data,
  send: async (s: ChatSessionRef, contenu: string) =>
    (await api.post<ChatReply>(`${BASE}/${s.sessionId}/messages`, { contenu }, { headers: headers(s), timeout: 60_000 })).data,
  coordonnees: async (s: ChatSessionRef, body: Coordonnees) =>
    (await api.post<ChatReply>(`${BASE}/${s.sessionId}/coordonnees`, body, { headers: headers(s) })).data,
  feedback: async (s: ChatSessionRef, rating: 'UTILE' | 'PAS_UTILE', messageExcerpt: string) =>
    (await api.post(`${BASE}/${s.sessionId}/feedback`, { rating, messageExcerpt: messageExcerpt.slice(0, 500) }, { headers: headers(s) })).data,
};

// ── back-office ────────────────────────────────────────────────────────────

export type ProspectStatut = 'NOUVEAU' | 'A_QUALIFIER' | 'QUALIFIE' | 'REJETE';

/** Chatbot of the website, or an email read in the mailbox (22/10) */
export type ProspectSource = 'CHATBOT' | 'EMAIL';

export interface ProspectListItem {
  id: number;
  statut: ProspectStatut;
  source: ProspectSource;
  emailSujet: string | null;
  clientNom: string | null;
  clientPrenom: string | null;
  clientEmail: string | null;
  clientTelephone: string | null;
  adresse: string | null;
  typeProjet: string | null;
  description: string | null;
  delai: string | null;
  clientId: number | null;
  doublonDeId: number | null;
  demandeDevisId: number | null;
  derniereActivite: string;
  createdAt: string;
  _count: { messages: number };
}

export interface Prospect extends ProspectListItem {
  notesInternes: string | null;
  motifRejet: string | null;
  traiteLe: string | null;
  traitePar: { id: number; nom: string; prenom: string | null } | null;
  client: { id: number; nom: string; prenom: string | null; email: string | null; telephone: string | null } | null;
  demandeDevis: { id: number; reference: string; statut: string } | null;
  doublonDe: { id: number; clientNom: string | null; statut: ProspectStatut; createdAt: string } | null;
  messages: { id: number; role: string; contenu: string; createdAt: string }[];
  feedbacks: { rating: string; commentaire: string | null; createdAt: string }[];
}

export interface AssistantStats {
  periodeJours: number;
  conversations: number;
  parStatut: Partial<Record<ProspectStatut, number>>;
  feedbacks: Partial<Record<'UTILE' | 'PAS_UTILE', number>>;
  erreurs: Record<string, number>;
}

export const useProspects = (q: { page: number; search?: string; statuts?: ProspectStatut[]; source?: ProspectSource | '' }) =>
  useQuery({
    queryKey: ['assistant', 'prospects', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<ProspectListItem>>('/assistant/prospects', { params: { ...q, statuts: q.statuts?.join(',') || undefined, source: q.source || undefined } })).data,
  });

// ── prospects by email (22/10) ──
export interface BilanReleve {
  date: string;
  lus: number;
  prospects: number;
  rejetes: number;
  suites: number;
  ignores: number;
  erreurs: number;
  erreur?: string;
}

export interface EmailStatut {
  active: boolean;
  boite: string | null;
  intervalleMinutes: number;
  enCours: boolean;
  dernier: BilanReleve | null;
}

export const useEmailStatut = () =>
  useQuery({ queryKey: ['assistant', 'emails'], refetchInterval: 60_000, queryFn: async () => (await api.get<EmailStatut>('/assistant/prospects/emails/statut')).data });

export function useReleverEmails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<BilanReleve>('/assistant/prospects/emails/relever', {}, { timeout: 120_000 })).data,
    onSettled: () => qc.invalidateQueries({ queryKey: ['assistant'] }),
  });
}

export const useProspect = (id: number) =>
  useQuery({ queryKey: ['assistant', 'prospect', id], queryFn: async () => (await api.get<Prospect>(`/assistant/prospects/${id}`)).data });

export const useAssistantStats = () =>
  useQuery({ queryKey: ['assistant', 'stats'], queryFn: async () => (await api.get<AssistantStats>('/assistant/prospects/statistiques')).data });

export const useAssistantErreurs = (enabled: boolean) =>
  useQuery({
    queryKey: ['assistant', 'erreurs'],
    enabled,
    queryFn: async () => (await api.get<{ id: number; type: string; detail: string | null; sessionId: number | null; createdAt: string }[]>('/assistant/prospects/erreurs')).data,
  });

function useAssistantWrite<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['assistant'] }) });
}

export type ProspectInput = Partial<Pick<Prospect, 'clientNom' | 'clientPrenom' | 'clientEmail' | 'clientTelephone' | 'adresse' | 'typeProjet' | 'description' | 'notesInternes'>>;

export const useUpdateProspect = (id: number) =>
  useAssistantWrite(async (body: ProspectInput) => (await api.patch<Prospect>(`/assistant/prospects/${id}`, body)).data);

/** 29/10: category of the client created by the qualification (ignored for an existing client). */
export interface QualificationInput {
  clientId?: number;
  typeClient?: 'PARTICULIER' | 'PROFESSIONNEL';
  raisonSociale?: string;
  siret?: string | null;
  tvaIntracom?: string | null;
  contactFonction?: string | null;
}

export const useQualifierProspect = (id: number) =>
  useAssistantWrite(async (body: QualificationInput = {}) =>
    (await api.post<{ prospect: Prospect; demande: { id: number; reference: string } }>(`/assistant/prospects/${id}/qualifier`, body)).data,
  );

export const useRejeterProspect = (id: number) =>
  useAssistantWrite(async (motif: string) => (await api.post<Prospect>(`/assistant/prospects/${id}/rejeter`, { motif })).data);

export const useRouvrirProspect = (id: number) => useAssistantWrite(async () => (await api.post<Prospect>(`/assistant/prospects/${id}/rouvrir`)).data);

// ── knowledge base ─────────────────────────────────────────────────────────

export interface Connaissance {
  id: number;
  titre: string;
  categorie: string;
  contenu: string;
  priorite: number;
  actif: boolean;
  updatedAt: string;
}

export const useConnaissances = (q: { page: number; search?: string; categorie?: string }) =>
  useQuery({
    queryKey: ['assistant', 'connaissances', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Connaissance>>('/assistant/connaissances', { params: { ...q, categorie: q.categorie || undefined } })).data,
  });

export const useCategoriesConnaissances = () =>
  useQuery({ queryKey: ['assistant', 'connaissances', 'categories'], queryFn: async () => (await api.get<{ categorie: string; nombre: number }[]>('/assistant/connaissances/categories')).data });

export const useRechercheConnaissances = (q: string) =>
  useQuery({
    queryKey: ['assistant', 'connaissances', 'recherche', q],
    enabled: q.trim().length >= 3,
    queryFn: async () => (await api.get<(Connaissance & { rank: number })[]>('/assistant/connaissances/recherche', { params: { q } })).data,
  });

export const useSaveConnaissance = () =>
  useAssistantWrite(async ({ id, ...body }: Partial<Omit<Connaissance, 'updatedAt'>>) =>
    (id ? await api.patch<Connaissance>(`/assistant/connaissances/${id}`, body) : await api.post<Connaissance>('/assistant/connaissances', body)).data,
  );

export const useDeleteConnaissance = () => useAssistantWrite(async (id: number) => api.delete(`/assistant/connaissances/${id}`));
