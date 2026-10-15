import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export type SavStatut = 'OUVERT' | 'EN_COURS' | 'EN_ATTENTE_CLIENT' | 'RESOLU' | 'CLOTURE';
export type SavPriorite = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';
export type SavCategorie = 'DEFAUT_TRAVAUX' | 'RETARD' | 'FACTURATION' | 'QUALITE' | 'SAV_TECHNIQUE' | 'AUTRE';

export const SAV_CATEGORIES: Record<SavCategorie, string> = {
  DEFAUT_TRAVAUX: 'Défaut de travaux',
  RETARD: 'Retard',
  FACTURATION: 'Facturation',
  QUALITE: 'Qualité',
  SAV_TECHNIQUE: 'SAV technique',
  AUTRE: 'Autre',
};

type Person = { id: number; nom: string; prenom: string | null };

export interface SavListItem {
  id: number;
  reference: string;
  titre: string;
  statut: SavStatut;
  priorite: SavPriorite;
  categorie: SavCategorie;
  dateEcheance: string | null;
  createdAt: string;
  /** INTERNE, or ESPACE_CLIENT when the client opened it from his online space */
  origine: string;
  client: { id: number; nom: string };
  assignedTo: Person | null;
}

export interface SavTicket extends Omit<SavListItem, 'client'> {
  description: string;
  dateResolution: string | null;
  client: Person & { telephone: string | null };
  devis: { id: number; reference: string } | null;
  facture: { id: number; reference: string | null } | null;
  chantier: { id: number; reference: string } | null;
  createur: Person | null;
  notes: { id: number; contenu: string; createdAt: string; user: Person | null }[];
}

export interface SavQuery {
  page: number;
  search?: string;
  statuts?: SavStatut[];
  priorite?: SavPriorite | '';
  categorie?: SavCategorie | '';
  clientId?: number;
}

export const useSavTickets = (q: SavQuery) =>
  useQuery({
    queryKey: ['sav', 'list', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<SavListItem>>('/sav', {
          params: { ...q, statuts: q.statuts?.join(',') || undefined, priorite: q.priorite || undefined, categorie: q.categorie || undefined },
        })
      ).data,
  });

export const useSavTicket = (id: number) =>
  useQuery({ queryKey: ['sav', id], queryFn: async () => (await api.get<SavTicket>(`/sav/${id}`)).data });

function useSavWrite<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['sav'] }) });
}

export interface SavInput {
  clientId?: number;
  devisId?: number;
  factureId?: number;
  chantierId?: number;
  titre?: string;
  description?: string;
  priorite?: SavPriorite;
  categorie?: SavCategorie;
  assignedToId?: number | null;
  dateEcheance?: string | null;
}

export const useSaveSav = () =>
  useSavWrite(async ({ id, ...body }: SavInput & { id?: number }) =>
    (id ? await api.patch<SavTicket>(`/sav/${id}`, body) : await api.post<SavTicket>('/sav', body)).data,
  );

export const useAddSavNote = (id: number) => useSavWrite(async (contenu: string) => (await api.post<SavTicket>(`/sav/${id}/notes`, { contenu })).data);

export type SavAction = 'prendre-en-charge' | 'attente-client' | 'resoudre' | 'rouvrir' | 'cloturer';
export const useSavAction = (id: number) =>
  useSavWrite(async ({ action, note }: { action: SavAction; note?: string }) =>
    (await api.post<SavTicket>(`/sav/${id}/${action}`, action === 'resoudre' ? { note: note || null } : {})).data,
  );
