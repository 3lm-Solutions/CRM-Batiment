import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';
import type { ChantierStatut, TacheStatut } from '../chantiers/api';
import type { Rapport } from '../rapports/api';
import type { AssuranceStatut, ContratStatut, TypeAssurance } from '../sous-traitants/api';

const BASE = '/portail/sous-traitant';

export interface StDashboard {
  chantiersActifs: number;
  tachesOuvertes: number;
  rapportsARevoir: number;
  rapportsEnAttente: number;
  assurancesAlerte: { typeAssurance: TypeAssurance; statut: AssuranceStatut; dateExpiration: string }[];
  prochainesTaches: {
    id: number;
    libelle: string;
    statut: TacheStatut;
    avancement: number;
    dateFin: string | null;
    chantier: { id: number; reference: string; adresse: string };
  }[];
}

export interface StChantierItem {
  id: number;
  reference: string;
  adresse: string;
  statut: ChantierStatut;
  dateDebut: string | null;
  dateFin: string | null;
  client: { nom: string };
  chefChantier: { nom: string; prenom: string | null; telephone: string | null } | null;
  avancement: number;
  mesTaches: number;
}

export interface StTache {
  id: number;
  libelle: string;
  description: string | null;
  statut: TacheStatut;
  avancement: number;
  dateDebut: string | null;
  dateFin: string | null;
  commentaire: string | null;
  affecteeAMoi: boolean;
}

export interface StChantier extends Omit<StChantierItem, 'mesTaches' | 'chefChantier'> {
  description: string | null;
  chefChantier: { nom: string; prenom: string | null; telephone: string | null; email: string } | null;
  taches: StTache[];
  documents: { id: number; nom: string; type: string; url: string | null; fichierId: number | null; createdAt: string }[];
}

export interface StProfil {
  compte: { id: number; nom: string; prenom: string | null; email: string; telephone: string | null };
  dossier: {
    id: number;
    nom: string;
    specialite: string | null;
    statut: string;
    assurances: { id: number; typeAssurance: TypeAssurance; compagnieAssurance: string; dateExpiration: string; statut: AssuranceStatut }[];
    contrats: { id: number; reference: string; statut: ContratStatut; montantHT: number; dateDebut: string | null; dateFin: string | null; chantier: { id: number; reference: string } }[];
  } | null;
  entreprise: { nom: string; email: string | null; telephone: string | null };
}

export const useStDashboard = () => useQuery({ queryKey: ['portail-st', 'dashboard'], queryFn: async () => (await api.get<StDashboard>(`${BASE}/tableau-de-bord`)).data });
export const useStChantiers = () => useQuery({ queryKey: ['portail-st', 'chantiers'], queryFn: async () => (await api.get<StChantierItem[]>(`${BASE}/chantiers`)).data });
export const useStChantier = (id: number) =>
  useQuery({ queryKey: ['portail-st', 'chantiers', id], queryFn: async () => (await api.get<StChantier>(`${BASE}/chantiers/${id}`)).data });
export const useStProfil = () => useQuery({ queryKey: ['portail-st', 'profil'], queryFn: async () => (await api.get<StProfil>(`${BASE}/profil`)).data });

export const useStRapports = (q: { page: number; chantierId?: number }) =>
  useQuery({
    queryKey: ['portail-st', 'rapports', q],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PaginatedResponse<Rapport>>(`${BASE}/rapports`, { params: q })).data,
  });

export function useAvancerTache(chantierId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; statut?: TacheStatut; avancement?: number; commentaire?: string | null }) =>
      (await api.patch<StChantier>(`${BASE}/taches/${id}`, body)).data,
    onSuccess: (chantier) => {
      qc.setQueryData(['portail-st', 'chantiers', chantierId], chantier);
      void qc.invalidateQueries({ queryKey: ['portail-st', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['portail-st', 'chantiers'], exact: true });
    },
  });
}

export function useEnvoyerRapport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { chantierId: number; tacheId?: number; contenu: string; avancement?: number; photos: File[] }) => {
      const body = new FormData();
      body.append('chantierId', String(input.chantierId));
      if (input.tacheId) body.append('tacheId', String(input.tacheId));
      if (input.avancement !== undefined) body.append('avancement', String(input.avancement));
      body.append('contenu', input.contenu);
      input.photos.forEach((p) => body.append('photos', p));
      return (await api.post<Rapport>(`${BASE}/rapports`, body, { timeout: 180_000 })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portail-st'] }),
  });
}
