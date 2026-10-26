import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Role } from '@/shared';
import { api } from '@/lib/api';
import type { ChantierStatut, TacheStatut } from '../chantiers/api';

export interface PlanningTache {
  id: number;
  libelle: string;
  statut: TacheStatut;
  avancement: number;
  dateDebut: string;
  dateFin: string | null;
  chantier: { id: number; reference: string; adresse: string; statut: ChantierStatut };
  intervenants: { id: number; nom: string; prenom: string | null; role: Role }[];
}

export interface Indisponibilite {
  id: number;
  dateDebut: string;
  dateFin: string;
  notes: string | null;
  sousTraitant: { id: number; nom: string; userId: number | null };
}

export interface PlanningData {
  taches: PlanningTache[];
  indisponibilites: Indisponibilite[];
}

/** Dated tasks of the open job sites + unavailable sous-traitants over a period (21/10). */
export const usePlanning = (q: { du: string; au: string; chantierId?: number; userId?: number }) =>
  useQuery({
    queryKey: ['planning', q],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PlanningData>('/planning', { params: q })).data,
  });
