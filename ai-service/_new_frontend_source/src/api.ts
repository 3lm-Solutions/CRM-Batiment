import { PrestationOccurrence } from './types/quote';

export interface ApiOccurrence {
  uid: string;
  nom: string;
  unite: string;
  prix_vente_min: number;
  prix_vente_max: number;
  quantite_ouvrage: number | null;
  cout_unitaire_manuel?: number | null;
  composants: Array<{ id: number; nom: string; type: string; unite: string; quantite_par_unite: number; cout_unitaire: number }>;
  options_choisies?: string[];
  options_disponibles?: string[];
}

export interface ApiSession {
  devis_id: number;
  taux_marge?: number;
  tva_pourcent?: number;
  occurrences: ApiOccurrence[];
}

export interface CataloguePrestation {
  id: number;
  nom: string;
  unite: string;
  categorie: string | null;
  prix_vente_min: number;
  prix_vente_max: number;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail || response.statusText;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export function sessionToPrestations(session: ApiSession): PrestationOccurrence[] {
  return (session.occurrences || []).map((occurrence) => ({
    id: occurrence.uid,
    titre: occurrence.nom,
    categorie: 'Rénovation générale',
    unite: occurrence.unite,
    quantiteOuvrage: occurrence.quantite_ouvrage,
    coutUnitaireManuel: occurrence.cout_unitaire_manuel ?? null,
    noteTechnique: (occurrence.composants || []).length
      ? 'Composition issue du catalogue'
      : 'Aucune composition catalogue — saisir le coût unitaire',
    prixVenteMin: occurrence.prix_vente_min,
    prixVenteMax: occurrence.prix_vente_max,
    composants: (occurrence.composants || []).map((component) => ({
      id: `${occurrence.uid}-${component.type}-${component.id}`,
      nom: component.nom,
      type: component.type === 'service_main_oeuvre' ? 'service' : 'materiau',
      quantiteParUnite: component.quantite_par_unite,
      unite: component.unite,
      prixUnitaireAchat: component.cout_unitaire,
    })),
    options: (occurrence.options_disponibles || []).map((name) => ({
      id: name,
      nom: name,
      active: (occurrence.options_choisies || []).includes(name),
      description: 'Option proposée par le catalogue',
      composants: [],
    })),
  }));
}
