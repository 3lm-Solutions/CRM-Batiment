import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Étapes 5–6 (26/10): comments and alerts of the client on a job site. */
export type RetourType = 'COMMENTAIRE' | 'ALERTE';
export type RetourStatut = 'OUVERT' | 'TRAITE';

type Personne = { id: number; nom: string; prenom: string | null };

export interface RetourClient {
  id: number;
  type: RetourType;
  message: string;
  statut: RetourStatut;
  reponse: string | null;
  reponduLe: string | null;
  traiteLe: string | null;
  createdAt: string;
  chantierId: number;
  tache: { id: number; libelle: string } | null;
  photo: { id: number; moment: 'AVANT' | 'APRES'; date: string; fichierId: number } | null;
  reponduPar: Personne | null;
  traitePar: Personne | null;
}

export const useRetoursClient = (chantierId: number, q: { statut?: RetourStatut; type?: RetourType } = {}) =>
  useQuery({
    queryKey: ['chantiers', chantierId, 'retours', q],
    queryFn: async () =>
      (await api.get<{ data: RetourClient[]; totaux: { alertesOuvertes: number; commentairesOuverts: number } }>(`/chantiers/${chantierId}/retours`, { params: q })).data,
  });

export function useActionRetour(chantierId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; action: 'repondre' | 'traiter' | 'rouvrir'; reponse?: string; traite?: boolean }) =>
      (await api.post<RetourClient>(
        `/chantiers/${chantierId}/retours/${input.id}/${input.action}`,
        input.action === 'repondre' ? { reponse: input.reponse, traite: input.traite ?? true } : {},
      )).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chantiers', chantierId, 'retours'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
