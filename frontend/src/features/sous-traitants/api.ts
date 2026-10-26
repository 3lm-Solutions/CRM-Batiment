import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared';
import { api } from '@/lib/api';

export type SousTraitantStatut = 'ACTIF' | 'INACTIF' | 'SUSPENDU';
export type ContratStatut = 'BROUILLON' | 'ACTIF' | 'TERMINE' | 'RESILIE';
export type TypeAssurance = 'DECENNALE' | 'RC_PRO' | 'AUTRE';
export type AssuranceStatut = 'VALIDE' | 'A_RENOUVELER' | 'EXPIREE';
export type ModePaiement = 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'CARTE' | 'AUTRE';
export type PaiementStatut = 'EN_ATTENTE' | 'REGLE' | 'ANNULE';

export const TYPE_ASSURANCE: Record<TypeAssurance, string> = { DECENNALE: 'Décennale', RC_PRO: 'RC professionnelle', AUTRE: 'Autre' };
export const MODE_PAIEMENT: Record<ModePaiement, string> = { VIREMENT: 'Virement', CHEQUE: 'Chèque', ESPECES: 'Espèces', CARTE: 'Carte', AUTRE: 'Autre' };
export const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

interface SousTraitantBase {
  id: number;
  nom: string;
  contact: string | null;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  specialite: string | null;
  statut: SousTraitantStatut;
  userId: number | null;
  createdAt: string;
}

export interface SousTraitantListItem extends SousTraitantBase {
  noteMoyenne: number | null;
  assurancesAlerte: { typeAssurance: TypeAssurance; statut: AssuranceStatut; dateExpiration: string }[];
  _count: { contrats: number };
}

export interface Assurance {
  id: number;
  typeAssurance: TypeAssurance;
  numeroAttestation: string;
  compagnieAssurance: string;
  dateExpiration: string;
  documentUrl: string | null;
  fichierId: number | null;
  statut: AssuranceStatut;
}

export interface Contrat {
  id: number;
  reference: string;
  sousTraitantId: number;
  chantierId: number;
  montantHT: number;
  statut: ContratStatut;
  dateDebut: string | null;
  dateFin: string | null;
  createdAt: string;
  chantier: { id: number; reference: string };
  sousTraitant?: { id: number; nom: string };
}

export interface Paiement {
  id: number;
  contratId: number | null;
  montantHT: number;
  montantTTC: number;
  datePaiement: string;
  modePaiement: ModePaiement;
  statut: PaiementStatut;
}

export interface Disponibilite {
  id: number;
  dateDebut: string;
  dateFin: string;
  disponible: boolean;
  notes: string | null;
}

export interface Notation {
  id: number;
  chantierId: number | null;
  noteQualite: number;
  noteDelai: number;
  noteCommunication: number;
  noteGlobale: number;
  commentaire: string | null;
  createdAt: string;
  chantier: { id: number; reference: string } | null;
}

export interface SousTraitant extends SousTraitantBase {
  utilisateur: { id: number; email: string; actif: boolean } | null;
  contrats: Contrat[];
  assurances: Assurance[];
  paiements: Paiement[];
  disponibilites: Disponibilite[];
  notations: Notation[];
}

export const useSousTraitants = (q: { page: number; search?: string; statut?: SousTraitantStatut | ''; limit?: number }, enabled = true) =>
  useQuery({
    queryKey: ['sous-traitants', 'list', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<PaginatedResponse<SousTraitantListItem>>('/sous-traitants', { params: { ...q, statut: q.statut || undefined } })).data,
  });

export const useSousTraitant = (id: number) =>
  useQuery({ queryKey: ['sous-traitants', id], queryFn: async () => (await api.get<SousTraitant>(`/sous-traitants/${id}`)).data });

/** Every write refreshes the sous-traitant (detail + list): the dossier is one aggregate. */
function useStWrite<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['sous-traitants'] }) });
}

/** `userId` only on creation (existing portal account); afterwards PUT /sous-traitants/:id/compte. */
export type SousTraitantInput = Partial<Pick<SousTraitantBase, 'nom' | 'contact' | 'siret' | 'email' | 'telephone' | 'adresse' | 'specialite' | 'statut'>> & {
  userId?: number | null;
};

export const useSaveSousTraitant = () =>
  useStWrite(async ({ id, ...body }: SousTraitantInput & { id?: number }) =>
    (id ? await api.patch<SousTraitantBase>(`/sous-traitants/${id}`, body) : await api.post<SousTraitantBase>('/sous-traitants', body)).data,
  );

export const useDeleteSousTraitant = () => useStWrite(async (id: number) => api.delete(`/sous-traitants/${id}`));

export const useLierCompte = (id: number) =>
  useStWrite(async (userId: number | null) => (await api.put(`/sous-traitants/${id}/compte`, { userId })).data);

export interface AssuranceInput {
  typeAssurance: TypeAssurance;
  numeroAttestation: string;
  compagnieAssurance: string;
  dateExpiration: string;
  documentUrl?: string | null;
  fichierId?: number | null;
}
export const useSaveAssurance = (stId: number) =>
  useStWrite(async ({ id, ...body }: AssuranceInput & { id?: number }) =>
    (id ? await api.patch(`/sous-traitants/${stId}/assurances/${id}`, body) : await api.post(`/sous-traitants/${stId}/assurances`, body)).data,
  );
export const useDeleteAssurance = (stId: number) => useStWrite(async (id: number) => api.delete(`/sous-traitants/${stId}/assurances/${id}`));

export const useAddPaiement = (stId: number) =>
  useStWrite(async (body: { contratId?: number | null; montantHT: number; montantTTC: number; datePaiement: string; modePaiement: ModePaiement; statut?: PaiementStatut }) =>
    (await api.post(`/sous-traitants/${stId}/paiements`, body)).data,
  );
export interface PaiementInput {
  contratId?: number | null;
  montantHT?: number;
  montantTTC?: number;
  datePaiement?: string;
  modePaiement?: ModePaiement;
  statut?: PaiementStatut;
}
/** Every field can be corrected (report of 20/10). */
export const useUpdatePaiement = (stId: number) =>
  useStWrite(async ({ id, ...body }: PaiementInput & { id: number }) => (await api.patch(`/sous-traitants/${stId}/paiements/${id}`, body)).data);
export const useDeletePaiement = (stId: number) => useStWrite(async (id: number) => api.delete(`/sous-traitants/${stId}/paiements/${id}`));

export const useAddDisponibilite = (stId: number) =>
  useStWrite(async (body: { dateDebut: string; dateFin: string; disponible: boolean; notes?: string | null }) =>
    (await api.post(`/sous-traitants/${stId}/disponibilites`, body)).data,
  );
export const useDeleteDisponibilite = (stId: number) => useStWrite(async (id: number) => api.delete(`/sous-traitants/${stId}/disponibilites/${id}`));

export const useAddNotation = (stId: number) =>
  useStWrite(async (body: { chantierId?: number | null; noteQualite: number; noteDelai: number; noteCommunication: number; commentaire?: string | null }) =>
    (await api.post(`/sous-traitants/${stId}/notations`, body)).data,
  );
export const useDeleteNotation = (stId: number) => useStWrite(async (id: number) => api.delete(`/sous-traitants/${stId}/notations/${id}`));

export const useSaveContrat = () =>
  useStWrite(async ({ id, ...body }: { id?: number; sousTraitantId?: number; chantierId?: number; montantHT?: number; dateDebut?: string | null; dateFin?: string | null }) =>
    (id ? await api.patch<Contrat>(`/contrats-sous-traitance/${id}`, body) : await api.post<Contrat>('/contrats-sous-traitance', body)).data,
  );

export type ContratAction = 'activer' | 'terminer' | 'resilier';
export const useContratAction = () =>
  useStWrite(async ({ id, action }: { id: number; action: ContratAction }) => (await api.post<Contrat>(`/contrats-sous-traitance/${id}/${action}`)).data);
export const useDeleteContrat = () => useStWrite(async (id: number) => api.delete(`/contrats-sous-traitance/${id}`));
