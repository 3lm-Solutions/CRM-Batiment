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
  client: { typeClient?: 'PARTICULIER' | 'PROFESSIONNEL'; nom: string; prenom: string | null; contactNom?: string | null };
  /** null in the office preview when the client has no active link */
  expiresAt: string | null;
  /** true: the office is looking at the client's space (read only) */
  apercu?: boolean;
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
    taches: {
      id: number;
      libelle: string;
      statut: TacheStatut;
      avancement: number;
      dateDebut: string | null;
      dateFin: string | null;
      /** Étape 5 (26/10) */
      checklist?: { id: number; libelle: string; fait: boolean }[];
    }[];
    /** Étape 2 (26/10): the SAV opens at the end of the works, for the company's period */
    sav?: { possible: boolean; jusquau: string | null; motif: string | null };
    /** Étape 5 (26/10): before / after photos validated by the chef */
    photos?: EspacePhoto[];
    /** Étape 5–6 (26/10): the client's comments / alerts and the company's answers */
    retours?: EspaceRetour[];
    /** false once the job site is closed (after-sales then goes through a SAV ticket) */
    retoursPossibles?: boolean;
  }[];
  sav: {
    id: number;
    reference: string;
    titre: string;
    statut: SavStatut;
    createdAt: string;
    dateResolution: string | null;
    chantier: { reference: string } | null;
    /** the client's messages and the team's replies to him (internal notes are never sent) */
    messages: { id: number; contenu: string; createdAt: string; auteur: 'CLIENT' | 'EQUIPE'; auteurPrenom: string | null }[];
    /** status timeline */
    historique: { statut: SavStatut; createdAt: string }[];
    /** photos sent by the client or added by the team (C42 of 21/10) */
    photos?: { id: number; nom: string; auteur: 'CLIENT' | 'EQUIPE' }[];
  }[];
}

export interface EspacePhoto {
  id: number;
  tacheId: number;
  checklistItemId: number | null;
  date: string;
  moment: 'AVANT' | 'APRES';
  commentaire: string | null;
}

export type RetourType = 'COMMENTAIRE' | 'ALERTE';

export interface EspaceRetour {
  id: number;
  type: RetourType;
  message: string;
  statut: 'OUVERT' | 'TRAITE';
  reponse: string | null;
  reponduLe: string | null;
  createdAt: string;
  tacheId: number | null;
  photoId: number | null;
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
  factureOrigine: { reference: string | null } | null;
  lignes: { id: number; description: string; quantite: number; unite: string; prixUnitaireHT: number; montantHT: number }[];
}

/**
 * Where the space is read from: the client's personal link (public), or the office preview
 * of a client (E1 of 20/10 — same screens, read only, no link needed).
 */
export type EspaceSource = { token: string } | { clientId: number };

const base = (token: string) => `/public/espace-client/${encodeURIComponent(token)}`;
const sourceBase = (s: EspaceSource) => ('token' in s ? base(s.token) : `/clients/${s.clientId}/espace/apercu`);
const sourceKey = (s: EspaceSource) => ('token' in s ? ['espace', s.token] : ['espace', 'apercu', s.clientId]);

/** A ticket photo: by the client's token, or through the office preview. */
export const espacePhotoPath = (s: EspaceSource, fichierId: number) =>
  'token' in s ? `${base(s.token)}/photos/${fichierId}` : `/clients/${s.clientId}/espace/apercu/photos/${fichierId}`;

/** A validated before / after photo (26/10): by the client's token, or through the office preview. */
export const espaceAvancementPath = (s: EspaceSource, photoId: number) =>
  'token' in s ? `${base(s.token)}/avancement/${photoId}` : `/clients/${s.clientId}/espace/apercu/avancement/${photoId}`;

/** Comment on a task / photo, or alert (Étape 5 of 26/10). */
export function useEspaceRetour(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { chantierId: number; tacheId?: number; photoId?: number; type: RetourType; message: string }) =>
      (await api.post<{ id: number; message: string }>(`${base(token)}/retours`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['espace', token] }),
  });
}

/** Same limits as the API (5 photos, 10 Mo each) */
export const MAX_PHOTOS_CLIENT = 5;

export const useEspaceClient = (s: EspaceSource) =>
  useQuery({ queryKey: sourceKey(s), retry: false, queryFn: async () => (await api.get<EspaceClient>(sourceBase(s))).data });

export const useEspaceDevis = (s: EspaceSource, id: number | null) =>
  useQuery({ queryKey: [...sourceKey(s), 'devis', id], enabled: id !== null, queryFn: async () => (await api.get<EspaceDevis>(`${sourceBase(s)}/devis/${id}`)).data });

export const useEspaceFacture = (s: EspaceSource, id: number | null) =>
  useQuery({ queryKey: [...sourceKey(s), 'facture', id], enabled: id !== null, queryFn: async () => (await api.get<EspaceFacture>(`${sourceBase(s)}/factures/${id}`)).data });

export function useEspaceSav(token: string) {
  const qc = useQueryClient();
  return useMutation({
    // multipart: the photos travel with the request (C42 of 21/10)
    mutationFn: async (input: { titre: string; description: string; chantierId?: number; categorie?: SavCategorie; photos: File[] }) => {
      const body = new FormData();
      body.append('titre', input.titre);
      body.append('description', input.description);
      if (input.chantierId) body.append('chantierId', String(input.chantierId));
      if (input.categorie) body.append('categorie', input.categorie);
      input.photos.forEach((p) => body.append('photos', p));
      return (await api.post<{ reference: string; message: string }>(`${base(token)}/sav`, body, { timeout: 180_000 })).data;
    },
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
