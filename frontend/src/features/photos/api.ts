import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Étapes 3–4 (26/10): before / after photos of the tasks, validated by the chef. */
export type PhotoMoment = 'AVANT' | 'APRES';
export type PhotoStatut = 'EN_ATTENTE' | 'VALIDEE' | 'MASQUEE';

export const PHOTO_MOMENTS: Record<PhotoMoment, string> = { AVANT: 'Avant', APRES: 'Après' };
export const PHOTO_STATUTS: Record<PhotoStatut, { label: string; tone: 'amber' | 'green' | 'slate' }> = {
  EN_ATTENTE: { label: 'À valider', tone: 'amber' },
  VALIDEE: { label: 'Validée', tone: 'green' },
  MASQUEE: { label: 'Masquée', tone: 'slate' },
};

/** Photos per upload (same limit as the API). */
export const MAX_PHOTOS_ENVOI = 10;

type Personne = { id: number; nom: string; prenom: string | null };

export interface PhotoAvancement {
  id: number;
  date: string;
  moment: PhotoMoment;
  commentaire: string | null;
  statut: PhotoStatut;
  motifMasquage: string | null;
  valideLe: string | null;
  createdAt: string;
  fichierId: number;
  chantier: { id: number; reference: string };
  tache: { id: number; libelle: string };
  checklistItem: { id: number; libelle: string } | null;
  auteur: Personne;
  validePar: Personne | null;
}

export interface PhotosTotaux {
  enAttente: number;
  validees: number;
  masquees: number;
}

export const photoPath = (fichierId: number) => `/fichiers/${fichierId}/contenu`;

/** Groups photos by day, then by task (+ sub-task), with the before and after side by side. */
export function grouperPhotos(photos: PhotoAvancement[]) {
  const jours = new Map<string, Map<string, { cle: string; tache: string; sousTache: string | null; avant: PhotoAvancement[]; apres: PhotoAvancement[] }>>();
  for (const p of photos) {
    const jour = p.date.slice(0, 10);
    if (!jours.has(jour)) jours.set(jour, new Map());
    const cle = `${p.tache.id}-${p.checklistItem?.id ?? 0}`;
    const groupes = jours.get(jour)!;
    if (!groupes.has(cle)) groupes.set(cle, { cle, tache: p.tache.libelle, sousTache: p.checklistItem?.libelle ?? null, avant: [], apres: [] });
    groupes.get(cle)![p.moment === 'AVANT' ? 'avant' : 'apres'].push(p);
  }
  return [...jours.entries()].map(([jour, groupes]) => ({ jour, groupes: [...groupes.values()] }));
}

// ── sous-traitant portal ──────────────────────────────────────────────────

const PORTAIL = '/portail/sous-traitant/photos';

export const useMesPhotos = (q: { chantierId?: number; tacheId?: number; mois?: string }, enabled = true) =>
  useQuery({
    queryKey: ['portail-st', 'photos', q],
    enabled,
    queryFn: async () => (await api.get<{ mois: string; data: PhotoAvancement[]; totaux: PhotosTotaux }>(PORTAIL, { params: q })).data,
  });

export function useEnvoyerPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tacheId: number; checklistItemId?: number; moment: PhotoMoment; date?: string; commentaire?: string; photos: File[] }) => {
      const body = new FormData();
      body.append('tacheId', String(input.tacheId));
      if (input.checklistItemId) body.append('checklistItemId', String(input.checklistItemId));
      body.append('moment', input.moment);
      if (input.date) body.append('date', input.date);
      if (input.commentaire) body.append('commentaire', input.commentaire);
      input.photos.forEach((p) => body.append('photos', p));
      return (await api.post<PhotoAvancement[]>(PORTAIL, body, { timeout: 180_000 })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portail-st', 'photos'] }),
  });
}

export function useSupprimerPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`${PORTAIL}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portail-st', 'photos'] }),
  });
}

// ── office / chef ─────────────────────────────────────────────────────────

export interface PhotosFiltres {
  tacheId?: number;
  checklistItemId?: number;
  auteurId?: number;
  statut?: PhotoStatut;
  moment?: PhotoMoment;
  du?: string;
  au?: string;
}

export const usePhotosChantier = (chantierId: number, filtres: PhotosFiltres = {}) =>
  useQuery({
    queryKey: ['chantiers', chantierId, 'photos', filtres],
    queryFn: async () =>
      (await api.get<{ data: PhotoAvancement[]; auteurs: Personne[]; totaux: PhotosTotaux }>(`/chantiers/${chantierId}/photos`, { params: filtres })).data,
  });

export function useDecisionPhotos(chantierId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ids, motif }: { action: 'valider' | 'masquer'; ids: number[]; motif?: string }) =>
      (await api.post<{ modifiees: number }>(`/chantiers/${chantierId}/photos/${action}`, action === 'masquer' ? { ids, motif: motif || null } : { ids })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chantiers', chantierId, 'photos'] }),
  });
}
