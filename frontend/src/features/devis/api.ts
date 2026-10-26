import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanySettings, PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import type { Unite } from '../catalogue/api';

export type DevisStatut = 'BROUILLON' | 'ENVOYE' | 'RENVOYE' | 'ACCEPTE' | 'SIGNE' | 'REFUSE' | 'REVISE' | 'ANNULE';
export const DEVIS_STATUTS: DevisStatut[] = ['BROUILLON', 'ENVOYE', 'RENVOYE', 'ACCEPTE', 'SIGNE', 'REFUSE', 'REVISE', 'ANNULE'];
/** Lines and header are editable in these states only (same rule as the API). */
export const EDITABLE: DevisStatut[] = ['BROUILLON', 'REVISE'];
export const AWAITING_CLIENT: DevisStatut[] = ['ENVOYE', 'RENVOYE'];

export interface OptionChoisie {
  optionId: number;
  optionNom: string;
  choixId: number;
  choixNom: string;
  impactPrix: number;
}

export interface LigneDevis {
  id: number;
  ordre: number;
  prestationId?: number | null;
  description: string | null;
  quantite: number;
  unite: Unite;
  dimension: string | null;
  couleur: string | null;
  finition: string | null;
  optionsChoisies: OptionChoisie[] | null;
  // absent for a chef de chantier
  prixUnitaireVente?: number;
  prixAchat?: number;
  mainOeuvre?: number;
  totalHT?: number;
  coutTotal?: number;
}

export interface DevisListItem {
  id: number;
  reference: string;
  statut: DevisStatut;
  versionCourante: number;
  dateCreation: string;
  dateEnvoi: string | null;
  totalHT?: number;
  totalTTC?: number;
  margePourcent?: number;
  alerteMarge?: boolean;
  client: { id: number; nom: string; prenom: string | null };
}

export interface LienClient {
  id: number;
  type: 'VALIDATION' | 'SIGNATURE';
  statut: string;
  destinataire: string;
  versionDevis: number;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface DevisDetail {
  id: number;
  reference: string;
  statut: DevisStatut;
  versionCourante: number;
  dateCreation: string;
  dateEnvoi: string | null;
  dateValidation: string | null;
  modeValidation: string | null;
  motifRefus: string | null;
  notes: string | null;
  tauxTVA?: number;
  totalHT?: number;
  totalTVA?: number;
  totalTTC?: number;
  coutTotal?: number;
  profit?: number;
  margePourcent?: number;
  alerteMarge?: boolean;
  signatureClientDate?: string | null;
  signatureConseillerDate?: string | null;
  client: { id: number; nom: string; prenom: string | null; email?: string | null; telephone?: string | null; adresseClient?: string | null; adresseChantier?: string | null };
  createur?: { id: number; nom: string; prenom: string } | null;
  demandeDevis?: { id: number; reference: string; description?: string } | null;
  chantier: { id: number; reference: string; statut: string } | null;
  lignes: LigneDevis[];
  liensClient?: LienClient[];
  _count?: { versions: number };
}

export interface DevisQuery {
  page: number;
  search?: string;
  statuts?: DevisStatut[];
}

export const useDevisList = (q: DevisQuery) =>
  useQuery({
    queryKey: ['devis', 'list', q],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<DevisListItem>>('/devis', { params: { ...q, statuts: q.statuts?.join(',') || undefined } })).data,
  });

export const useDevis = (id: number) =>
  useQuery({ queryKey: ['devis', id], queryFn: async () => (await api.get<DevisDetail>(`/devis/${id}`)).data });

export interface Version {
  id: number;
  numeroVersion: number;
  justification: string | null;
  totalHT: number;
  totalTTC: number;
  createdAt: string;
  auteur: { nom: string; prenom: string } | null;
}

export const useVersions = (id: number, enabled: boolean) =>
  useQuery({ queryKey: ['devis', id, 'versions'], enabled, queryFn: async () => (await api.get<Version[]>(`/devis/${id}/versions`)).data });

/** Every quote write returns the whole updated quote: the cache is replaced directly. */
function useDevisWrite<TVars>(id: number, fn: (vars: TVars) => Promise<DevisDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (devis) => {
      qc.setQueryData(['devis', id], devis);
      void qc.invalidateQueries({ queryKey: ['devis', 'list'] });
    },
  });
}

export function useCreateDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { clientId: number; demandeDevisId?: number }) => (await api.post<DevisDetail>('/devis', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devis', 'list'] }),
  });
}

export const useUpdateDevis = (id: number) =>
  useDevisWrite(id, async (body: { tauxTVA?: number; notes?: string | null }) => (await api.patch<DevisDetail>(`/devis/${id}`, body)).data);

export interface LigneInput {
  prestationId?: number;
  choixIds?: number[];
  description?: string | null;
  quantite?: number;
  unite?: Unite;
  dimension?: string | null;
  couleur?: string | null;
  finition?: string | null;
  prixUnitaireVente?: number;
  prixAchat?: number;
  mainOeuvre?: number;
}

export const useAddLigne = (id: number) =>
  useDevisWrite(id, async (body: LigneInput & { quantite: number }) => (await api.post<DevisDetail>(`/devis/${id}/lignes`, body)).data);

export const useUpdateLigne = (id: number) =>
  useDevisWrite(id, async ({ ligneId, ...body }: LigneInput & { ligneId: number }) =>
    (await api.patch<DevisDetail>(`/devis/${id}/lignes/${ligneId}`, body)).data);

export const useRemoveLigne = (id: number) =>
  useDevisWrite(id, async (ligneId: number) => (await api.delete<DevisDetail>(`/devis/${id}/lignes/${ligneId}`)).data);

export const useReorderLignes = (id: number) =>
  useDevisWrite(id, async (ligneIds: number[]) => (await api.put<DevisDetail>(`/devis/${id}/lignes/ordre`, { ligneIds })).data);

// ── assistant IA (Step 15) ─────────────────────────────────────────────────

export interface LigneProposee {
  prestationId: number;
  nom: string;
  categorie: string;
  unite: Unite;
  quantite: number;
  /** Suggested price from the catalogue (never from the AI) */
  prixUnitaireHT: number;
  totalHT: number;
  justification: string;
}

export interface PropositionIa {
  /** false = keyword matching (no OpenAI key, or the AI failed) */
  modeIA: boolean;
  lignes: LigneProposee[];
  nonCouverts: string[];
  hypotheses: string[];
  totalHT: number;
  avertissement: string | null;
  /** Quote from photos (C37 of 21/10): what the AI saw */
  analysePhoto?: AnalysePhoto | null;
}

export interface AnalysePhoto {
  piece: string;
  /** Approximate — to measure on site */
  surfaceEstimeeM2: number | null;
  objetReference: boolean;
  elementsVisibles: string[];
  etat: string;
  qualitePhoto: 'BONNE' | 'MOYENNE' | 'INSUFFISANTE';
}

/** Same limit as the API */
export const MAX_PHOTOS_IA = 3;

/** Nothing is saved: the proposal is shown for review. */
export const useProposerIa = (id: number) =>
  useMutation({
    mutationFn: async (description: string) =>
      (await api.post<PropositionIa>(`/devis/${id}/ia/proposer`, { description }, { timeout: 90_000 })).data,
  });

/** 1 to 3 photos (already shrunk) + optional text; the photos are not stored by the API. */
export const useProposerPhotoIa = (id: number) =>
  useMutation({
    mutationFn: async ({ photos, description }: { photos: File[]; description: string }) => {
      const body = new FormData();
      if (description.trim()) body.append('description', description.trim());
      photos.forEach((p) => body.append('photos', p));
      return (await api.post<PropositionIa>(`/devis/${id}/ia/proposer-photo`, body, { timeout: 120_000 })).data;
    },
  });

/** Adds the kept lines in one transaction. */
export const useAppliquerIa = (id: number) =>
  useDevisWrite(id, async (lignes: { prestationId: number; quantite: number }[]) =>
    (await api.post<DevisDetail>(`/devis/${id}/ia/appliquer`, { lignes })).data);

export type DevisAction = 'envoyer' | 'renvoyer-lien' | 'reviser' | 'annuler' | 'demander-signature' | 'signer-conseiller' | 'dupliquer';

/** Shape varies by action: { devis, lien, emailSent } | { lien, emailSent } | { devis, message } | DevisDetail */
export interface ActionResult {
  id?: number;
  devis?: DevisDetail;
  lien?: { url: string; expiresAt: string };
  emailSent?: boolean;
  message?: string;
}

export function useDevisAction(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, body }: { action: DevisAction; body?: object }) =>
      (await api.post<ActionResult>(`/devis/${id}/${action}`, body ?? {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devis'] }),
  });
}

export function useDeleteDevis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/devis/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devis', 'list'] }),
  });
}

export interface Company {
  nom: string;
  siret: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  /** data URL (PNG, JPEG, WebP), shown in the client space and on the quote link */
  logo?: string | null;
  /** Printed on invoices with the payment QR code (21/10) */
  iban?: string | null;
  bic?: string | null;
}

export const useCompany = (enabled = true) =>
  useQuery({ queryKey: ['company'], enabled, staleTime: 10 * 60_000, queryFn: async () => (await api.get<Company>('/company')).data });

export const useCompanySettings = (enabled = true) =>
  useQuery({
    queryKey: ['company', 'settings'],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => (await api.get<CompanySettings>('/company/settings')).data,
  });
