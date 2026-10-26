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
  notes: { id: number; contenu: string; createdAt: string; visibleClient: boolean; user: Person | null }[];
  /** status timeline (null user = the client or the system) */
  historique?: { id: number; statut: SavStatut; createdAt: string; user: Person | null }[];
  /** Photos (C42 of 21/10); uploadedById null = sent by the client from his space */
  photos?: SavPhoto[];
}

export interface SavPhoto {
  id: number;
  nom: string;
  mime: string;
  taille: number;
  createdAt: string;
  uploadedById: number | null;
}

/** Same limits as the API */
export const MAX_PHOTOS_PAR_TICKET = 10;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

export function useAddSavPhotos(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append('photos', f));
      return (await api.post<SavPhoto[]>(`/sav/${id}/photos`, form, { timeout: 120_000 })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sav', id] }),
  });
}

export function useDeleteSavPhoto(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fichierId: number) => api.delete(`/sav/${id}/photos/${fichierId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sav', id] }),
  });
}

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

/** `visibleClient`: a reply shown in the client's online space and emailed to him (otherwise an internal note). */
export const useAddSavNote = (id: number) =>
  useSavWrite(async ({ contenu, visibleClient }: { contenu: string; visibleClient?: boolean }) =>
    (await api.post<SavTicket>(`/sav/${id}/notes`, { contenu, visibleClient: !!visibleClient })).data,
  );

export type SavAction = 'prendre-en-charge' | 'attente-client' | 'resoudre' | 'rouvrir' | 'cloturer';
export const useSavAction = (id: number) =>
  useSavWrite(async ({ action, note, visibleClient }: { action: SavAction; note?: string; visibleClient?: boolean }) =>
    (await api.post<SavTicket>(`/sav/${id}/${action}`, action === 'resoudre' ? { note: note || null, visibleClient: !!visibleClient } : {})).data,
  );
