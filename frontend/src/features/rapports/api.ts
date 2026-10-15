import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Fichier } from '@/lib/files';

export type RapportStatut = 'SOUMIS' | 'VALIDE' | 'REJETE';

/** Site report written by a sous-traitant from the portal (text + photos). */
export interface Rapport {
  id: number;
  chantierId: number;
  tacheId: number | null;
  contenu: string;
  avancement: number | null;
  statut: RapportStatut;
  commentaireValidation: string | null;
  valideLe: string | null;
  createdAt: string;
  auteur: { id: number; nom: string; prenom: string | null };
  tache: { id: number; libelle: string } | null;
  chantier?: { id: number; reference: string };
  photos: Fichier[];
}

/** Staff view: reports of one job site. */
export const useRapportsChantier = (chantierId: number) =>
  useQuery({
    queryKey: ['rapports', 'chantier', chantierId],
    queryFn: async () => (await api.get<Rapport[]>(`/chantiers/${chantierId}/rapports`)).data,
  });

export function useReviewRapport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, commentaire }: { id: number; decision: 'valider' | 'rejeter'; commentaire?: string }) =>
      (await api.post<Rapport>(`/rapports/${id}/${decision}`, { commentaire: commentaire || undefined })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapports'] });
      // A validated report may have moved a task's progress
      void qc.invalidateQueries({ queryKey: ['chantiers'] });
    },
  });
}

export const photoPath = (id: number) => `/fichiers/${id}/contenu`;
