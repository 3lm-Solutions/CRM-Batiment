import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

/** Hours of the sous-traitants (21/10): entered in their portal, validated by the chef or the office. */
export type PointageStatut = 'SOUMIS' | 'VALIDE' | 'REFUSE';

export const POINTAGE_STATUT: Record<PointageStatut, { label: string; tone: 'amber' | 'green' | 'red' }> = {
  SOUMIS: { label: 'À valider', tone: 'amber' },
  VALIDE: { label: 'Validé', tone: 'green' },
  REFUSE: { label: 'Refusé', tone: 'red' },
};

export interface Totaux {
  valide: number;
  soumis: number;
  refuse: number;
}

export interface Pointage {
  id: number;
  date: string;
  heures: number;
  commentaire: string | null;
  statut: PointageStatut;
  motifRefus: string | null;
  chantier: { id: number; reference: string; adresse: string };
  tache: { id: number; libelle: string } | null;
  sousTraitant?: { id: number; nom: string };
  validePar?: { id: number; nom: string; prenom: string | null } | null;
  valideLe?: string | null;
}

// ── portal (sous-traitant) ──

const PORTAIL = '/portail/sous-traitant/pointages';

export const useMesPointages = (mois: string) =>
  useQuery({
    queryKey: ['portail-st', 'pointages', mois],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<{ mois: string; data: Pointage[]; totaux: Totaux }>(PORTAIL, { params: { mois } })).data,
  });

export function usePointer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { chantierId: number; tacheId?: number | null; date: string; heures: number; commentaire?: string | null }) =>
      (await api.post<Pointage>(PORTAIL, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portail-st', 'pointages'] }),
  });
}

export function useSupprimerPointage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`${PORTAIL}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portail-st', 'pointages'] }),
  });
}

// ── office / chef ──

export interface PointagesQuery {
  page: number;
  statut: PointageStatut | '';
  chantierId?: number;
  sousTraitantId?: number;
  du?: string;
  au?: string;
}

export const usePointages = (q: PointagesQuery, enabled = true) =>
  useQuery({
    queryKey: ['pointages', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Pointage> & { totaux: Totaux }>('/pointages', { params: { ...q, statut: q.statut || undefined, limit: 50 } })).data,
  });

export const useResumePointages = (sousTraitantId: number, enabled = true) =>
  useQuery({
    queryKey: ['pointages', 'resume', sousTraitantId],
    enabled,
    queryFn: async () => (await api.get<{ chantier: { id: number; reference: string }; valide: number; soumis: number }[]>(`/pointages/resume/${sousTraitantId}`)).data,
  });

export function useValiderPointages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => (await api.post<{ valides: number }>('/pointages/valider', { ids })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pointages'] }),
  });
}

export function useRefuserPointage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motif }: { id: number; motif: string }) => (await api.post<Pointage>(`/pointages/${id}/refuser`, { motif })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pointages'] }),
  });
}

/** 7.5 → « 7 h 30 » */
export const formatHeures = (h: number) => {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`;
};
