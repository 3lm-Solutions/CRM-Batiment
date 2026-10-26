import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Reminders (C3 of 21/10): automatic every morning, or « Relancer maintenant ». */
export interface Relance {
  id: number;
  type: 'DEVIS' | 'FACTURE';
  /** 0 = sent by hand; 1, 2, 3 = automatic reminder number */
  niveau: number;
  automatique: boolean;
  destinataire: string;
  emailEnvoye: boolean;
  createdAt: string;
  user: { id: number; nom: string; prenom: string | null } | null;
}

export interface RelancesReglages {
  relancesActives: boolean;
  /** Days after sending the quote */
  relanceDevisJours: number[];
  /** Days after the invoice due date */
  relanceFactureJours: number[];
}

export type RelanceCible = { devisId: number } | { factureId: number };

const key = (c: RelanceCible) => ['relances', c] as const;

export const useRelances = (cible: RelanceCible, enabled = true) =>
  useQuery({ queryKey: key(cible), enabled, queryFn: async () => (await api.get<Relance[]>('/relances', { params: cible })).data });

export function useRelancer(cible: RelanceCible) {
  const qc = useQueryClient();
  const path = 'devisId' in cible ? `/devis/${cible.devisId}/relancer` : `/factures/${cible.factureId}/relancer`;
  return useMutation({
    mutationFn: async () => (await api.post<Relance>(path)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(cible) });
      // a quote reminder creates a fresh client link, shown in « Suivi client »
      if ('devisId' in cible) void qc.invalidateQueries({ queryKey: ['devis', cible.devisId] });
    },
  });
}

export const useRelancesReglages = (enabled = true) =>
  useQuery({ queryKey: ['relances', 'reglages'], enabled, queryFn: async () => (await api.get<RelancesReglages>('/relances/reglages')).data });

export function useUpdateRelancesReglages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<RelancesReglages>) => (await api.patch<RelancesReglages>('/relances/reglages', dto)).data,
    onSuccess: (data) => qc.setQueryData(['relances', 'reglages'], data),
  });
}

export function useExecuterRelances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ devis: number; factures: number; erreurs: number }>('/relances/executer')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relances'] }),
  });
}
