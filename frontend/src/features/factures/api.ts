import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export type FactureStatut = 'BROUILLON' | 'ENVOYEE' | 'PAYEE' | 'ANNULEE';
export type FactureType = 'ACOMPTE' | 'SITUATION' | 'FINALE' | 'AVOIR';

export const FACTURE_TYPE_TITLE: Record<FactureType, string> = {
  ACOMPTE: "Facture d'acompte",
  SITUATION: 'Situation de travaux',
  FINALE: 'Facture',
  AVOIR: 'Avoir',
};

export interface FactureLigne {
  id: number;
  description: string;
  quantite: number;
  unite: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  ordre: number;
}

export interface FactureListItem {
  id: number;
  /** null while the invoice is a draft: numbers are assigned at issue */
  reference: string | null;
  typeFacture: FactureType;
  statut: FactureStatut;
  numeroSituation: number | null;
  date: string;
  dateEmission: string | null;
  dateEcheance: string | null;
  datePaiement: string | null;
  montantHT: number;
  montantTTC: number;
  referenceDevis: string | null;
  nomClient: string | null;
  prenomClient: string | null;
  devis: { id: number; reference: string; client: { id: number; nom: string; prenom: string | null } };
}

export interface Facture extends FactureListItem {
  avancementCumule: number | null;
  tauxTVA: number;
  montantTVA: number;
  acomptePercent: number | null;
  acompteMontant: number | null;
  emailClient: string | null;
  telephoneClient: string | null;
  adresseClient: string | null;
  /** company client (Étape 1 of 26/10) */
  clientSiret?: string | null;
  clientTvaIntracom?: string | null;
  companyNom: string | null;
  companyEmail: string | null;
  companyTelephone: string | null;
  companyAdresse: string | null;
  companySiret: string | null;
  /** Bank details at issue time + « view online » token (QR codes, 21/10) */
  companyIban?: string | null;
  companyBic?: string | null;
  lienPublicToken?: string | null;
  conditionsPaiement: string | null;
  communicationPaiement: string | null;
  notesLegales: string | null;
  referencePaiement: string | null;
  emailEnvoiClient: string | null;
  dateEnvoiClient: string | null;
  lignes: FactureLigne[];
  devis: FactureListItem['devis'] & { totalHT: number };
  factureOrigine: { id: number; reference: string | null } | null;
  avoirs: { id: number; reference: string | null; montantTTC: number }[];
}

export interface FacturesQuery {
  page: number;
  search?: string;
  statuts?: FactureStatut[];
  type?: FactureType | '';
  devisId?: number;
}

export const useFactures = (q: FacturesQuery, enabled = true) =>
  useQuery({
    queryKey: ['factures', 'list', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<FactureListItem>>('/factures', {
          params: { ...q, statuts: q.statuts?.join(',') || undefined, type: q.type || undefined },
        })
      ).data,
  });

export const useFacture = (id: number) =>
  useQuery({ queryKey: ['factures', id], queryFn: async () => (await api.get<Facture>(`/factures/${id}`)).data });

/** Writes return the whole invoice: the detail cache is replaced, lists refreshed. */
function useFactureWrite<TVars>(id: number, fn: (vars: TVars) => Promise<Facture>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (f) => {
      qc.setQueryData(['factures', id], f);
      void qc.invalidateQueries({ queryKey: ['factures', 'list'] });
    },
  });
}

export const useUpdateFacture = (id: number) =>
  useFactureWrite(id, async (body: { dateEcheance?: string | null; conditionsPaiement?: string | null; communicationPaiement?: string | null; notesLegales?: string | null }) =>
    (await api.patch<Facture>(`/factures/${id}`, body)).data,
  );

export interface FactureLigneInput {
  description: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT: number;
}

export const useSaveFactureLigne = (id: number) =>
  useFactureWrite(id, async ({ ligneId, ...body }: FactureLigneInput & { ligneId?: number }) =>
    (ligneId ? await api.patch<Facture>(`/factures/${id}/lignes/${ligneId}`, body) : await api.post<Facture>(`/factures/${id}/lignes`, body)).data,
  );

export const useRemoveFactureLigne = (id: number) =>
  useFactureWrite(id, async (ligneId: number) => (await api.delete<Facture>(`/factures/${id}/lignes/${ligneId}`)).data);

export const usePayerFacture = (id: number) =>
  useFactureWrite(id, async (body: { datePaiement?: string; referencePaiement?: string | null }) => (await api.post<Facture>(`/factures/${id}/payer`, body)).data);

export function useEmettreFacture(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (envoyerEmail: boolean) => (await api.post<{ facture: Facture; emailSent: boolean }>(`/factures/${id}/emettre`, { envoyerEmail })).data,
    onSuccess: ({ facture }) => {
      qc.setQueryData(['factures', id], facture);
      void qc.invalidateQueries({ queryKey: ['factures', 'list'] });
    },
  });
}

export function useEnvoyerFacture(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ emailSent: boolean }>(`/factures/${id}/envoyer`)).data,
    // « Envoyée le … » is updated on the invoice
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures', id] }),
  });
}

export function useAnnulerFacture(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (motif?: string) => (await api.post<{ facture: Facture; avoir: Facture | null }>(`/factures/${id}/annuler`, { motif })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures'] }),
  });
}

export function useDeleteFacture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/factures/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures'] }),
  });
}

/** Progress or final invoice from a signed quote. */
export function useCreerFacture(devisId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: 'situation'; avancementCumule: number } | { type: 'finale' }) =>
      (
        await api.post<Facture>(
          `/devis/${devisId}/factures/${input.type}`,
          input.type === 'situation' ? { avancementCumule: input.avancementCumule } : {},
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['factures'] }),
  });
}

/** Displayed number: the legal reference once issued, otherwise "Brouillon". */
export const factureLabel = (f: { reference: string | null; typeFacture: FactureType; numeroSituation?: number | null }) =>
  f.reference ?? `Brouillon${f.typeFacture === 'SITUATION' && f.numeroSituation ? ` (situation n° ${f.numeroSituation})` : ''}`;

export const isOverdue = (f: { statut: FactureStatut; dateEcheance: string | null }) =>
  f.statut === 'ENVOYEE' && !!f.dateEcheance && new Date(f.dateEcheance) < new Date();
