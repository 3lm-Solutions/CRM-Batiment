import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export const UNITES = ['M2', 'ML', 'M3', 'PIECE', 'JOUR', 'HEURE', 'LITRE', 'KG', 'FORFAIT'] as const;
export type Unite = (typeof UNITES)[number];

export interface Prestation {
  id: number;
  nom: string;
  description: string | null;
  unite: Unite;
  prixVenteMin: number;
  prixVenteMax: number;
  actif: boolean;
  categorie: { id: number; nom: string };
  sousCategorie: { id: number; nom: string } | null;
  _count?: { compositions: number; options: number };
}

interface Component {
  id: number;
  quantiteParUnite: number;
  materiau: { id: number; nom: string; unite: Unite; prixAchatFixe: number; actif: boolean } | null;
  serviceMainOeuvre: { id: number; nom: string; unite: Unite; prixUnitaire: number; actif: boolean } | null;
}

export interface PrestationDetail extends Prestation {
  compositions: Component[];
  options: {
    id: number;
    nom: string;
    obligatoire: boolean;
    choix: { id: number; nom: string; impactPrix: number; actif: boolean; compositions: Component[] }[];
  }[];
}

export interface PricingResult {
  compositionSource: 'BASE' | 'CHOIX';
  compositionChoix: string | null;
  lignes: { kind: 'MATERIAU' | 'MAIN_OEUVRE'; id: number; nom: string; unite: Unite; quantiteNecessaire: number; prixUnitaire: number; coutTotal: number }[];
  coutMateriaux: number;
  coutMainOeuvre: number;
  coutTotal: number;
  coutParUnite: number;
  impactOptionsParUnite: number;
  prixVenteSuggereUnite: number;
  prixCibleMargeUnite: number;
  totalVenteHT: number;
  profit: number;
  margePourcent: number;
  alerteMarge: boolean;
  avertissements: string[];
}

export interface Materiau {
  id: number;
  nom: string;
  couleur: string | null;
  finition: string | null;
  unite: Unite;
  prixAchatFixe: number;
  stockActuel: number;
  stockMinimum: number;
  actif: boolean;
  fournisseur: { id: number; nom: string } | null;
}

export interface ServiceMo {
  id: number;
  nom: string;
  unite: Unite;
  prixUnitaire: number;
  productiviteJour: number | null;
  coutJournalier: number | null;
  actif: boolean;
}

export interface Categorie {
  id: number;
  nom: string;
  description: string | null;
  actif: boolean;
  sousCategories: { id: number; nom: string; actif: boolean; _count: { prestations: number } }[];
  _count: { prestations: number };
}

export interface ListQuery {
  page: number;
  search?: string;
  categorieId?: number | '';
  actif?: '' | 'true' | 'false';
  limit?: number;
}

const clean = (q: ListQuery) => ({ ...q, categorieId: q.categorieId || undefined, actif: q.actif || undefined });

export const usePrestations = (q: ListQuery) =>
  useQuery({
    queryKey: ['catalogue', 'prestations', q],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PaginatedResponse<Prestation>>('/catalogue/prestations', { params: clean(q) })).data,
  });

export const usePrestation = (id: number | null) =>
  useQuery({
    queryKey: ['catalogue', 'prestation', id],
    enabled: !!id,
    queryFn: async () => (await api.get<PrestationDetail>(`/catalogue/prestations/${id}`)).data,
  });

export const useMateriaux = (q: ListQuery) =>
  useQuery({
    queryKey: ['catalogue', 'materiaux', q],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PaginatedResponse<Materiau>>('/catalogue/materiaux', { params: clean(q) })).data,
  });

export const useServicesMo = (q: ListQuery) =>
  useQuery({
    queryKey: ['catalogue', 'services', q],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PaginatedResponse<ServiceMo>>('/catalogue/services-mo', { params: clean(q) })).data,
  });

export const useCategories = () =>
  useQuery({ queryKey: ['catalogue', 'categories'], staleTime: 5 * 60_000, queryFn: async () => (await api.get<Categorie[]>('/catalogue/categories')).data });

export const useFournisseurOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ['fournisseurs', 'options'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await api.get<PaginatedResponse<{ id: number; nom: string }>>('/fournisseurs', { params: { limit: 100, actif: true } })).data.data,
  });

export const useChiffrage = () =>
  useMutation({
    mutationFn: async ({ id, ...body }: { id: number; quantite: number; choixIds: number[] }) =>
      (await api.post<PricingResult>(`/catalogue/prestations/${id}/chiffrage`, body)).data,
  });

/** Create (no id) or update (id) a catalogue entity; refreshes the whole catalogue cache. */
export function useSaveCatalogue(path: 'prestations' | 'materiaux' | 'services-mo' | 'categories') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id?: number } & Record<string, unknown>) =>
      (id ? await api.patch(`/catalogue/${path}/${id}`, body) : await api.post(`/catalogue/${path}`, body)).data as unknown,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogue'] }),
  });
}

export function useCreateSousCategorie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ categorieId, nom }: { categorieId: number; nom: string }) =>
      (await api.post(`/catalogue/categories/${categorieId}/sous-categories`, { nom })).data as unknown,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogue', 'categories'] }),
  });
}
