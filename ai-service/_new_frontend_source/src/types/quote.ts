export type PrestationCategory = 
  | 'Revêtement'
  | 'Peinture'
  | 'Plâtrerie'
  | 'Plomberie & Sanitaire'
  | 'Électricité'
  | 'Menuiserie'
  | 'Isolation & Doublage'
  | 'Rénovation générale';

export interface PrestationComposant {
  id: string;
  nom: string;
  type: 'materiau' | 'service';
  quantiteParUnite: number;
  unite: string;
  prixUnitaireAchat: number; // Coût de revient unitaire HT pour l'artisan
  isOptionnel?: boolean;
  optionId?: string;
}

export interface PrestationOption {
  id: string;
  nom: string;
  active: boolean;
  description: string;
  composants: PrestationComposant[];
}

export interface PrestationOccurrence {
  id: string;
  titre: string;
  categorie: PrestationCategory;
  unite: string; // m², ml, u, forfait
  quantiteOuvrage: number | null; // null si non renseigné (doit être validé par l'humain)
  coutUnitaireManuel?: number | null; // saisi si le catalogue n'a aucune composition
  prixVenteMin: number; // Fourchette catalogue basse
  prixVenteMax: number; // Fourchette catalogue haute
  composants: PrestationComposant[];
  options: PrestationOption[];
  surfaceDetectee?: number;
  noteTechnique?: string;
}

export type StatutMarque = 'VALIDE' | 'MARGE_INSUFFISANTE' | 'MARGE_EXCESSIVE';

export interface CalculatedPrestation {
  occurrence: PrestationOccurrence;
  prixVenteUnitaireHT: number;
  coutUnitaireHT: number;
  sousTotalVenteHT: number;
  sousTotalCoutHT: number;
  isHorsFourchette: boolean;
  ecartFourchette: number; // Différence par rapport au min ou max
  typeEcart: 'SOUS_EVALUATION' | 'SUR_EVALUATION' | 'CONFORME';
  hasQuantiteManquante: boolean;
}

export interface QuoteCalculation {
  totalCoutHT: number;
  totalVenteHT: number;
  margeBrute: number;
  tauxMargeSaisi: number; // Saisi en Zone 2 (ex: 28%)
  tauxMarqueCalcule: number; // (Marge brute / Total Vente HT) * 100
  statutMarque: StatutMarque;
  tauxTVA: number; // 10% ou 20%
  montantTVA: number;
  totalTTC: number;
  quantitesManquantesCount: number;
  prestationCount: number;
  peutEnvoyerDevis: boolean;
  motifsRefusEnvoi: string[];
  prestationsCalculees: CalculatedPrestation[];
}

export interface FlatQuoteLine {
  id: string;
  description: string;
  categorie: string;
  quantite: number;
  unite: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  montantTVA: number;
  totalHT: number;
  totalTTC: number;
}

export interface ClientInfo {
  nom: string;
  civilite: 'M.' | 'Mme' | 'Société';
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  numeroDevis: string;
  dateEmission: string;
  validiteMois: number;
  lieuChantier: string;
}

export interface PhotoAnalysisResult {
  imageUrl: string;
  fileName: string;
  fileSize: number;
  piece: string;
  surfaceEstimee: number;
  surfaceConfidence: number; // < 0.7 affiche avertissement
  materiaux: string[];
  etatDesLieux: string;
  travauxSuggere: string[];
}

export interface VoiceTranscriptionResult {
  audioBlobUrl?: string;
  durationSeconds: number;
  transcript: string;
  confidence: number; // < 0.7 = rouge, 0.7-0.85 = orange, > 0.85 = vert
  dateRecorded: string;
}

export interface SavedDraft {
  id: string;
  name: string;
  date: string;
  tauxMarge: number;
  tauxTVA: number;
  clientInfo: ClientInfo;
  prestations: PrestationOccurrence[];
  totalVenteHT: number;
  totalTTC: number;
}
