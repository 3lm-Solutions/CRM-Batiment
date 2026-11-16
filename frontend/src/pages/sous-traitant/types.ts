export type SousTraitantTaskStatus =
  | 'A_FAIRE'
  | 'EN_COURS'
  | 'BLOQUEE'
  | 'TERMINEE';

export interface SousTraitantClient {
  id: number;
  nom: string;
  prenom: string | null;
  telephone?: string | null;
}

export interface SousTraitantTaskChantier {
  id: number;
  reference: string;
  adresse: string;
  statut: string;
  client: SousTraitantClient;
}

export interface SousTraitantTask {
  id: number;
  libelle: string;
  description: string | null;
  statut: SousTraitantTaskStatus;
  avancement: number;
  commentaire: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  createdAt?: string;
  updatedAt: string;
  chantier: SousTraitantTaskChantier;
}

export interface SousTraitantChantierTask {
  id: number;
  libelle: string;
  statut: SousTraitantTaskStatus;
  avancement: number;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface SousTraitantChantierDocument {
  id: number;
  nom: string;
  type: string;
  url: string;
  createdAt: string;
}

export interface SousTraitantChantier {
  id: number;
  reference: string;
  adresse: string;
  description: string | null;
  statut: string;
  dateDebut: string | null;
  dateFin: string | null;
  updatedAt: string;
  client: SousTraitantClient;
  taches: SousTraitantChantierTask[];
  documents: SousTraitantChantierDocument[];
}

export interface SousTraitantDocument {
  id: number;
  nom: string;
  type: string;
  url: string;
  createdAt: string;
  chantier: {
    id: number;
    reference: string;
    adresse: string;
    client: SousTraitantClient;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SousTraitantDashboardData {
  summary: {
    totalTaches: number;
    aFaire: number;
    enCours: number;
    bloquees: number;
    terminees: number;
    enRetard: number;
    totalChantiers: number;
  };
  recentTasks: SousTraitantTask[];
}
