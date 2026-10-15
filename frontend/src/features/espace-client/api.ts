import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChantierStatut, TacheStatut } from '../chantiers/api';
import type { DevisStatut } from '../devis/api';
import type { FactureStatut, FactureType } from '../factures/api';
import type { PublicDevis } from '../public/api';
import type { SavCategorie, SavStatut } from '../sav/api';

// ── office side ───────────────────────────────────────────────────────────

export interface EspaceLien {
  id: number;
  destinataire: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: { nom: string; prenom: string | null } | null;
}

export const useEspaceLiens = (clientId: number) =>
  useQuery({ queryKey: ['espace-client', clientId], queryFn: async () => (await api.get<EspaceLien[]>(`/clients/${clientId}/espace/liens`)).data });

export function useEnvoyerEspace(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ url: string; expiresAt: string; emailSent: boolean; destinataire: string }>(`/clients/${clientId}/espace/lien`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espace-client', clientId] }),
  });
}

export function useRevoquerEspace(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete<{ revoked: number }>(`/clients/${clientId}/espace/liens`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espace-client', clientId] }),
  });
}

// ── client side (public, token in the URL) ────────────────────────────────

export interface EspaceClient {
  entreprise: { nom: string; email: string | null; telephone: string | null; adresse: string | null; logo: string | null };
  client: { nom: string; prenom: string | null };
  expiresAt: string;
  devis: { id: number; reference: string; statut: DevisStatut; versionCourante: number; dateEnvoi: string | null; totalTTC: number }[];
  factures: { id: number; reference: string; typeFacture: FactureType; statut: FactureStatut; dateEmission: string | null; dateEcheance: string | null; montantTTC: number }[];
  chantiers: {
    id: number;
    reference: string;
    adresse: string;
    statut: ChantierStatut;
    dateDebut: string | null;
    dateFin: string | null;
    avancement: number;
    chefChantier: { prenom: string | null; nom: string; telephone: string | null } | null;
    taches: { id: number; libelle: string; statut: TacheStatut; avancement: number; dateDebut: string | null; dateFin: string | null }[];
  }[];
  sav: {
    id: number;
    reference: string;
    titre: string;
    statut: SavStatut;
    createdAt: string;
    chantier: { reference: string } | null;
    messages: { id: number; contenu: string; createdAt: string }[];
  }[];
}

export type EspaceDevis = PublicDevis['devis'];

export interface EspaceFacture {
  id: number;
  reference: string;
  typeFacture: FactureType;
  statut: FactureStatut;
  numeroSituation: number | null;
  avancementCumule: number | null;
  date: string;
  dateEmission: string | null;
  dateEcheance: string | null;
  datePaiement: string | null;
  tauxTVA: number;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  acomptePercent: number | null;
  referenceDevis: string | null;
  nomClient: string | null;
  prenomClient: string | null;
  emailClient: string | null;
  adresseClient: string | null;
  companyNom: string | null;
  companyEmail: string | null;
  companyTelephone: string | null;
  companyAdresse: string | null;
  companySiret: string | null;
  conditionsPaiement: string | null;
  communicationPaiement: string | null;
  notesLegales: string | null;
  factureOrigine: { reference: string | null } | null;
  lignes: { id: number; description: string; quantite: number; unite: string; prixUnitaireHT: number; montantHT: number }[];
}

const base = (token: string) => `/public/espace-client/${encodeURIComponent(token)}`;

export const useEspaceClient = (token: string) =>
  useQuery({ queryKey: ['espace', token], retry: false, queryFn: async () => (await api.get<EspaceClient>(base(token))).data });

export const useEspaceDevis = (token: string, id: number | null) =>
  useQuery({ queryKey: ['espace', token, 'devis', id], enabled: id !== null, queryFn: async () => (await api.get<EspaceDevis>(`${base(token)}/devis/${id}`)).data });

export const useEspaceFacture = (token: string, id: number | null) =>
  useQuery({ queryKey: ['espace', token, 'facture', id], enabled: id !== null, queryFn: async () => (await api.get<EspaceFacture>(`${base(token)}/factures/${id}`)).data });

export function useEspaceSav(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { titre: string; description: string; chantierId?: number; categorie?: SavCategorie }) =>
      (await api.post<{ reference: string; message: string }>(`${base(token)}/sav`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espace', token] }),
  });
}

export function useEspaceSavMessage(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contenu }: { id: number; contenu: string }) => (await api.post<{ message: string }>(`${base(token)}/sav/${id}/messages`, { contenu })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espace', token] }),
  });
}
