// ============================
// Types partagés — CRM Bâtiment
// ============================

export type Role = 'ADMIN' | 'TECHNICO' | 'ASSISTANTE' | 'CHEF_CHANTIER' | 'SOUS_TRAITANT';

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  telephone?: string;
  signatureBase64?: string;
  signatureUpdatedAt?: string;
  actif: boolean;
  companyId: number;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  mustChangePassword?: boolean;
  tempToken?: string;
}

export interface TypeProjet {
  id: number;
  nom: string;
  description?: string;
  actif: boolean;
  categories?: TypeProjetCategorieAssignment[];
  _count?: { clients: number; categories: number };
  createdAt: string;
}

export interface TypeProjetCategorieAssignment {
  typeProjetId?: number;
  categorieId: number;
  ordre?: number;
  categorie?: Pick<CategoriePrestation, 'id' | 'nom' | 'description'>;
}

export interface RagDocument {
  id: number;
  titre: string;
  categorie: string;
  contenu: string;
  actif: boolean;
  priorite: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadSource = 'CHATBOT' | 'TECHNICO_COMMERCIAL' | 'APPEL' | 'RECOMMANDATION' | 'SITE_WEB' | 'AUTRE';

export interface Client {
  id: number;
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  adresseClient?: string;
  adresseChantier?: string;
  typeProjetId?: number;
  typeProjetIds?: number[];
  typeProjet?: TypeProjet;
  typeProjets?: TypeProjet[];
  source?: LeadSource;
  besoin?: string;
  notes?: string;
  demandesDevis?: DemandeDevis[];
  actif: boolean;
  createdAt: string;
}

export interface CategoriePrestation {
  id: number;
  nom: string;
  description?: string;
  _count?: { prestations: number; sousCategories: number };
  sousCategories?: SousCategorie[];
}

export interface SousCategorie {
  id: number;
  categorieId: number;
  nom: string;
  description?: string;
  actif: boolean;
  prestations?: Prestation[];
}

export interface ChoixOption {
  id: number;
  optionId: number;
  nom: string;
  description?: string;
  impactPrix: number;
  actif: boolean;
  ordre: number;
  compositions?: PrestationComposition[];
}

export interface OptionPrestation {
  id: number;
  prestationId: number;
  nom: string;
  description?: string;
  obligatoire: boolean;
  ordre: number;
  choix: ChoixOption[];
}

export interface Prestation {
  id: number;
  categorieId: number;
  sousCategorieId?: number;
  nom: string;
  description?: string;
  unite: string;
  prixVenteMin: number;
  prixVenteMax: number;
  actif: boolean;
  categorie?: CategoriePrestation;
  sousCategorie?: SousCategorie;
  compositions?: PrestationComposition[];
  options?: OptionPrestation[];
  infosRequises?: InfoRequise[];
}

export interface InfoRequise {
  id: number;
  prestationId: number;
  nom: string;
  typeInfo: 'MESURE' | 'PHOTO' | 'OBSERVATION' | 'CHOIX';
  unite?: string;
  obligatoire: boolean;
  aide?: string;
  ordre: number;
}

export interface QuestionDiagnostic {
  id: number;
  categorieId?: number;
  sousCategorieId?: number;
  question: string;
  typeReponse: 'TEXTE' | 'CHOIX_UNIQUE' | 'CHOIX_MULTIPLE' | 'NOMBRE' | 'BOOLEEN' | 'PHOTO';
  choixPossibles?: string[];
  obligatoire: boolean;
  aide?: string;
  ordre: number;
}

export interface PrestationComposition {
  id: number;
  prestationId: number;
  materiauId?: number;
  serviceMainOeuvreId?: number;
  quantiteParUnite: number;
  materiau?: { id: number; nom: string; unite: string; prixAchatFixe: number };
  serviceMainOeuvre?: { id: number; nom: string; unite: string; prixUnitaire: number };
}

export interface CatalogueCategorieWithCompositions {
  id: number;
  nom: string;
  description?: string;
  sousCategories: (SousCategorie & { prestations: Prestation[]; questionsDiagnostic?: QuestionDiagnostic[] })[];
  prestations: Prestation[];
  questionsDiagnostic?: QuestionDiagnostic[];
}

export interface Materiau {
  id: number;
  nom: string;
  couleur?: string;
  finition?: string;
  unite: string;
  prixAchatFixe: number;
  stockActuel?: number;
  stockMinimum?: number;
  fournisseurId?: number;
  fournisseur?: Fournisseur;
  actif: boolean;
  createdAt: string;
}

export interface ServiceMainOeuvre {
  id: number;
  nom: string;
  unite: string;
  prixUnitaire: number;
  productiviteJour?: number;
  coutJournalier?: number;
  actif: boolean;
  createdAt: string;
}

export interface Fournisseur {
  id: number;
  nom: string;
  contact?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  typesMateriaux?: string;
  delaiLivraison?: number;
  conditions?: string;
  actif: boolean;
  materiaux?: Materiau[];
  _count?: { materiaux: number; commandesFournisseur: number };
  createdAt: string;
}

export type DemandeDevisStatut =
  | 'NOUVEAU'
  | 'EN_COURS'
  | 'CONVERTI'
  | 'PERDU';

export interface DemandeDevis {
  id: number;
  clientId: number;
  source: string;
  description: string;
  statut: DemandeDevisStatut;
  besoinStructure?: unknown;
  notes?: string;
  createdAt: string;
  client?: Client;
}

export type DevisStatut =
  | 'BROUILLON'
  | 'ENVOYE'
  | 'ACCEPTE'
  | 'SIGNE'
  | 'REFUSE'
  | 'ANNULE'
  | 'REVISE'
  | 'RENVOYE';

export type ModeValidation = 'EMAIL' | 'SIGNATURE' | 'VERBAL' | 'AUTRE';

export interface DevisCreateur {
  id: number;
  nom: string;
  prenom: string;
  email?: string;
}

export interface DevisVersion {
  id: number;
  numeroVersion: number;
  justification?: string;
  totalHT: number;
  totalTTC: number;
  createdAt: string;
}

export interface Facture {
  id: number;
  devisId: number;
  reference: string;
  date: string;
  dateEcheance?: string;
  referenceDevis?: string;
  tauxTVA?: number;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  typeFacture?: 'ACOMPTE' | 'FINALE';
  acomptePercent?: number;
  acompteMontant?: number;
  nomClient?: string;
  prenomClient?: string;
  emailClient?: string;
  telephoneClient?: string;
  adresseClient?: string;
  companyNom?: string;
  companyEmail?: string;
  companyTelephone?: string;
  companyAdresse?: string;
  companySiret?: string;
  conditionsPaiement?: string;
  communicationPaiement?: string;
  notesLegales?: string;
  referencePaiement?: string;
  emailEnvoiClient?: string;
  dateEnvoiClient?: string;
  datePaiement?: string;
  statut: 'BROUILLON' | 'ENVOYEE' | 'PAYEE' | 'ANNULEE';
  pdfUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FactureLigne {
  id: number;
  factureId: number;
  description: string;
  datePrestation?: string;
  quantite: number;
  unite: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  ordre: number;
}

export interface FactureDetail extends Facture {
  lignes: FactureLigne[];
  editable: boolean;
  linkedDevis: {
    id: number;
    reference: string;
    statut: DevisStatut;
  };
  devis?: {
    id: number;
    reference: string;
    statut: DevisStatut;
    client?: Pick<
      Client,
      'id' | 'nom' | 'prenom' | 'email' | 'telephone' | 'adresseClient' | 'adresseChantier'
    >;
    company?: {
      id: number;
      nom: string;
      email?: string;
      telephone?: string;
      adresse?: string;
      siret?: string;
    };
  };
}

export interface FactureSourceDevis {
  id: number;
  reference: string;
  statut: DevisStatut;
  createdAt: string;
  totalTTC: number;
  client?: Pick<Client, 'id' | 'nom' | 'prenom' | 'email'>;
  existingFacture?: Pick<Facture, 'id' | 'reference' | 'statut' | 'montantTTC'>;
}

export interface BonCommande {
  id: number;
  devisId: number;
  reference: string;
  date: string;
  statut: 'BROUILLON' | 'VALIDE' | 'ENVOYE' | 'ANNULE';
}

export interface LigneCommandeFournisseur {
  id: number;
  materiauNom: string;
  quantite: number;
  unite: string;
  prixUnitaire: number;
  totalHT: number;
}

export interface CommandeFournisseur {
  id: number;
  devisId: number;
  fournisseurId: number;
  reference: string;
  date: string;
  statutLivraison: 'CREEE' | 'ENVOYEE' | 'EXPEDIEE' | 'PARTIELLE' | 'RECUE' | 'CLOTUREE';
  dateEnvoi?: string;
  dateLivraisonPrevue?: string;
  notes?: string;
  pdfUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  fournisseur?: {
    id: number;
    nom: string;
    email?: string;
  };
  lignes?: LigneCommandeFournisseur[];
}

export interface ReceptionCommandeFournisseur {
  id: number;
  dateReception: string;
  quantiteRecue: number;
  quantiteAttendue: number;
  partielle: boolean;
  notes?: string;
  createdAt: string;
}

export interface FournisseurCommandeTrackingEtape {
  state: string;
  label: string;
  detail: string;
}

export interface FournisseurCommandeMetrics {
  lignesCount: number;
  totalMontantHT: number;
  totalQuantiteCommandee: number;
  totalQuantiteRecue: number;
  receptionPercent: number;
}

export interface FournisseurCommandeDetail extends CommandeFournisseur {
  fournisseur: Fournisseur;
  devis: {
    id: number;
    reference: string;
    statut: DevisStatut;
    bonCommandeStatut?: 'BROUILLON' | 'VALIDE' | 'ENVOYE' | 'ANNULE' | null;
    bonCommandeReference?: string | null;
    client?: {
      id: number;
      nom: string;
      prenom?: string;
      email?: string;
      telephone?: string;
    };
    chantier?: {
      id: number;
      reference: string;
      adresse: string;
      statut: string;
    };
  };
  receptions: ReceptionCommandeFournisseur[];
  tracking: {
    disponibilite: FournisseurCommandeTrackingEtape;
    livraison: FournisseurCommandeTrackingEtape;
    reception: FournisseurCommandeTrackingEtape;
  };
  metrics: FournisseurCommandeMetrics;
}

export interface PortailFournisseurDashboard {
  fournisseur: Fournisseur;
  summary: {
    totalCommandes: number;
    aConfirmer: number;
    enCoursLivraison: number;
    receptionsPartielles: number;
    receptionsCompletes: number;
    montantTotalHT: number;
  };
  recentOrders: FournisseurCommandeDetail[];
}

export interface InternalNotification {
  id: number;
  action: string;
  createdAt: string;
  entite: string;
  entiteId: number;
  title: string;
  message: string;
  category: string;
  level: 'info' | 'success' | 'warning' | 'danger';
  metadata: Record<string, unknown>;
  actor?: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    role: Role;
  } | null;
}

export interface InternalNotificationsResponse {
  items: InternalNotification[];
  summary: {
    total: number;
    unreadPotential?: number;
    alerts?: number;
    facturesImpayees?: number;
    montantFacturesImpayees?: number;
    chantiersEnRetard?: number;
    commandesEnAttente?: number;
    stockBas?: number;
    signatures?: number;
    modificationsPrix?: number;
    savOuverts?: number;
    savEnCours?: number;
    savUrgents?: number;
    savNotifications?: number;
    demoPending?: number;
    demoScheduledSoon?: number;
    demoNotifications?: number;
    supplierUpdates: number;
    receptionsPartielles: number;
    receptionsCompletes: number;
  };
}

export type ChantierStatut =
  | 'VISITE_TECHNIQUE'
  | 'DEVIS_EN_PREPARATION'
  | 'DEVIS_ENVOYE'
  | 'NEGOCIATION_EN_COURS'
  | 'DEVIS_VALIDE'
  | 'COMMANDES_GENEREES'
  | 'MATERIAUX_EN_LIVRAISON'
  | 'MATERIAUX_RECEPTIONNES'
  | 'PLANIFIE'
  | 'DEMARRE'
  | 'EN_COURS'
  | 'TERMINE'
  | 'CLOTURE';

export type ChantierAutoStatut = 'EN_ATTENTE' | 'EN_COURS' | 'EN_RETARD' | 'CLOTURE';

export interface DocumentChantier {
  id: number;
  chantierId: number;
  nom: string;
  type: string;
  url: string;
  createdAt: string;
}

export type StockStatus = 'DISPONIBLE' | 'BAS' | 'RUPTURE';

export interface StockMaterial extends Materiau {
  stockActuel: number;
  stockMinimum: number;
  statutStock: StockStatus;
  valeurStock: number;
}

export interface StockMovement {
  id: number;
  materiauId: number;
  type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
  quantite: number;
  stockAvant: number;
  stockApres: number;
  motif?: string;
  reference?: string;
  createdAt: string;
  materiau: Pick<Materiau, 'id' | 'nom' | 'unite'>;
  user?: Pick<User, 'id' | 'nom' | 'prenom'> | null;
}

export interface StockResponse {
  items: StockMaterial[];
  summary: {
    totalReferences: number;
    stockBas: number;
    ruptures: number;
    valeurTotale: number;
  };
}

export interface Chantier {
  id: number;
  companyId: number;
  clientId: number;
  chefChantierId?: number | null;
  reference: string;
  adresse: string;
  description?: string;
  statut: ChantierStatut;
  dateDebut?: string | null;
  dateFin?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  chefChantier?: Pick<User, 'id' | 'nom' | 'prenom' | 'email'> | null;
  statutAuto?: ChantierAutoStatut;
  resumeTaches?: {
    total: number;
    done: number;
    pending: number;
    overdue: number;
  };
  _count?: {
    devis?: number;
    taches?: number;
    documents?: number;
  };
  documents?: DocumentChantier[];
}

export type TaskAssigneeType = 'AUCUNE' | 'SOUS_TRAITANT' | 'EQUIPE_INTERNE';
export type TacheStatut = 'A_FAIRE' | 'EN_COURS' | 'BLOQUEE' | 'TERMINEE';

export interface TaskAssigneeSousTraitant {
  id: number;
  nom: string;
  prenom?: string | null;
  email?: string;
}

export interface TaskAssigneeEquipe {
  id: number;
  nom: string;
  type: 'INTERNE' | 'SOUS_TRAITANT';
}

export interface TacheChantier {
  id: number;
  chantierId: number;
  libelle: string;
  description?: string | null;
  statut: TacheStatut;
  dateDebut?: string | null;
  dateFin?: string | null;
  avancement: number;
  commentaire?: string | null;
  ordre: number;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  affectation?: {
    id: number;
    type: Exclude<TaskAssigneeType, 'AUCUNE'>;
    user?: TaskAssigneeSousTraitant;
    equipe?: TaskAssigneeEquipe;
  } | null;
}

export interface TacheAssignmentOptions {
  sousTraitants: TaskAssigneeSousTraitant[];
  equipesInternes: TaskAssigneeEquipe[];
}

export interface ChantierTasksResponse {
  chantierId: number;
  chantierReference: string;
  client?: Pick<Client, 'id' | 'nom' | 'prenom'>;
  chantierStatutAuto: ChantierAutoStatut;
  resumeTaches: {
    total: number;
    done: number;
    pending: number;
    overdue: number;
  };
  tasks: TacheChantier[];
}

export interface Devis {
  id: number;
  clientId: number;
  chantierId?: number;
  demandeDevisId?: number;
  reference: string;
  versionCourante?: number;
  statut: DevisStatut;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  tauxTVA: number;
  coutTotal?: number;
  profit?: number;
  margePourcent?: number;
  dateEnvoi?: string;
  notes?: string;
  dateValidation?: string;
  modeValidation?: ModeValidation;
  signatureClientBase64?: string;
  signatureClientDate?: string;
  signatureConseillerBase64?: string;
  signatureConseillerDate?: string;
  createdAt: string;
  updatedAt?: string;
  client?: Client;
  createur?: DevisCreateur;
  lignes?: LigneDevis[];
  versions?: DevisVersion[];
  factures?: Facture[];
  bonCommande?: BonCommande;
  commandesFournisseur?: CommandeFournisseur[];
  signatureRequests?: DevisClientSignatureRequest[];
  company?: {
    id: number;
    nom: string;
    adresse?: string;
    email?: string;
    telephone?: string;
    siret?: string;
  };
}

export type DevisClientSignatureRequestStatut =
  | 'EN_ATTENTE'
  | 'OTP_ENVOYE'
  | 'OTP_VERIFIE'
  | 'SIGNE_CLIENT'
  | 'BLOQUE'
  | 'EXPIRE'
  | 'ANNULE';

export interface DevisClientSignatureRequest {
  id: number;
  devisId: number;
  token: string;
  telephoneClient: string;
  statut: DevisClientSignatureRequestStatut;
  expiresAt: string;
  otpAttempts: number;
  otpSentAt?: string;
  otpVerifiedAt?: string;
  blockedAt?: string;
  clientSignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LigneDevis {
  id: number;
  devisId: number;
  prestationId?: number;
  materiauId?: number;
  serviceMainOeuvreId?: number;
  description?: string;
  quantite: number;
  unite: string;
  dimension?: string;
  couleur?: string;
  finition?: string;
  prixUnitaireVente: number;
  prixAchat?: number;
  mainOeuvre?: number;
  totalHT: number;
  coutTotal?: number;
  ordre: number;
  prestation?: { id: number; nom: string };
  materiau?: { id: number; nom: string };
  serviceMainOeuvre?: { id: number; nom: string };
}


export type DemoRequestStatut = 'PENDING' | 'CONTACTED' | 'SCHEDULED' | 'DONE' | 'CANCELED';

export interface DemoRequest {
  id: number;
  companyId?: number | null;
  assignedToId?: number | null;
  nom: string;
  prenom?: string | null;
  email: string;
  telephone?: string | null;
  entreprise?: string | null;
  message?: string | null;
  statut: DemoRequestStatut;
  source: string;
  dateContact?: string | null;
  dateDemo?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: number;
    nom: string;
    email?: string | null;
    telephone?: string | null;
  } | null;
  assignedTo?: Pick<User, 'id' | 'nom' | 'prenom' | 'email' | 'role'> | null;
}

export interface DemoRequestsSummary {
  total: number;
  pending: number;
  contacted: number;
  scheduled: number;
  done: number;
  canceled: number;
  scheduledSoon: number;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
