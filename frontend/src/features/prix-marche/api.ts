import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

/** Prix de marché (29/10): the company's signed prices, or the imported list (CSV). */
export type SourcePrix = 'DEVIS' | 'COMMANDES' | 'BAREME';
export const SOURCES_PRIX: Record<SourcePrix, string> = { DEVIS: 'Devis signés', COMMANDES: 'Commandes', BAREME: 'Barème importé' };

export interface PrixMarche {
  source: SourcePrix;
  /** Number of signed quotes / orders found in the period */
  nombre: number;
  basse: number;
  haute: number;
  mediane: number | null;
  /** % per year (null = not enough data for a trend) */
  tendancePctAn: number | null;
  estimeAujourdhui: number | null;
  estime6Mois: number | null;
  bareme: { prixMin: number; prixMax: number; source: string | null } | null;
}
export type PositionPrix = 'BAS' | 'DANS' | 'HAUT';

export interface PrixMarcheItem {
  type: 'PRESTATION' | 'MATERIAU';
  id: number;
  nom: string;
  categorie: string | null;
  unite: string;
  /** Prestation: catalogue sale range; material: catalogue purchase price */
  catalogue: { min: number; max: number };
  vente: PrixMarche | null;
  achat: PrixMarche | null;
}

export interface PrixMarcheQuery {
  type: 'PRESTATION' | 'MATERIAU';
  page: number;
  search: string;
}

export const usePrixMarche = (q: PrixMarcheQuery) =>
  useQuery({
    queryKey: ['prix-marche', 'liste', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<PrixMarcheItem> & { periodeMois: number }>('/prix-marche', { params: { type: q.type, page: q.page, search: q.search || undefined } })).data,
  });

export interface LignePrixMarche {
  ligneId: number;
  vente: PrixMarche | null;
  achat: PrixMarche | null;
  position: PositionPrix | null;
}

/** Quote editor: refreshed whenever a line or a price changes (`signature`). */
export const usePrixMarcheDevis = (devisId: number, signature: string, enabled: boolean) =>
  useQuery({
    queryKey: ['prix-marche', 'devis', devisId, signature],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => (await api.get<{ periodeMois: number; lignes: LignePrixMarche[] }>(`/prix-marche/devis/${devisId}`)).data,
  });

export interface BaremeInfo {
  nombre: number;
  importeLe: string | null;
  importePar: { nom: string; prenom: string | null } | null;
}
export const useBareme = (enabled: boolean) =>
  useQuery({ queryKey: ['prix-marche', 'bareme'], enabled, queryFn: async () => (await api.get<BaremeInfo>('/prix-marche/bareme')).data });

export interface ResultatImport {
  importees: number;
  ignorees: number;
  erreurs: { ligne: number; raison: string }[];
  /** true: nothing valid, the current list was kept */
  conserve: boolean;
}

export function useImporterBareme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fichier: File) => {
      const body = new FormData();
      body.append('fichier', fichier);
      return (await api.post<ResultatImport>('/prix-marche/bareme/import', body, { timeout: 60_000 })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prix-marche'] }),
  });
}

export function useViderBareme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete<{ supprimees: number }>('/prix-marche/bareme')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prix-marche'] }),
  });
}

/** The template comes with the login token: fetched, then saved as a file. */
export async function telechargerModele() {
  const res = await api.get<Blob>('/prix-marche/bareme/modele', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prix-de-marche.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
