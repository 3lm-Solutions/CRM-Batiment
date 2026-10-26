import type { LlmJsonSchema, LlmMessage } from '../assistant/llm/llm.client';
import { type CatalogueEntry, cleanQuantity } from './catalogue-match';

/** At most this many lines are proposed (the technician completes the rest by hand). */
export const MAX_LIGNES = 15;

/**
 * The model chooses prestations BY ID among the candidates it is shown and estimates quantities.
 * It never gives a price: prices come from the catalogue's pricing engine, like any quote line.
 */
const SYSTEM = `Tu es le métreur d'une entreprise du bâtiment. À partir de la description d'un chantier, tu choisis les prestations du CATALOGUE de l'entreprise qui composent le devis, et tu estimes les quantités.

RÈGLES
- Utilise UNIQUEMENT les prestations du catalogue fourni, par leur id. N'invente jamais de prestation ni d'id.
- Ne donne jamais de prix ni de montant : le logiciel les calcule à partir du catalogue.
- La quantité est dans l'unité de la prestation (M2, ML, M3, PIECE, FORFAIT, JOUR, HEURE…). Déduis-la de la description (surfaces, longueurs, nombre d'éléments). Pour une surface murale, tiens compte de la hauteur (2,50 m par défaut) et dis-le dans les hypothèses.
- Une même prestation une seule fois. ${MAX_LIGNES} lignes au maximum, dans l'ordre du chantier : dépose / démolition, préparation, réseaux (plomberie, électricité), pose, finitions.
- N'ajoute que ce qui est nécessaire au chantier décrit (pas d'options non demandées).
- "justification" : une phrase courte (ex. « 8 m² de sol »).
- "nonCouverts" : les travaux décrits pour lesquels AUCUNE prestation du catalogue ne convient (formulation courte), à chiffrer à la main.
- "hypotheses" : ce que tu as supposé et que le technicien doit vérifier (dimensions, hauteur, état des supports…).`;

export function buildMessages(description: string, candidates: CatalogueEntry[]): LlmMessage[] {
  const catalogue = candidates
    .map((c) => `${c.id} | ${c.nom} | ${c.unite} | ${c.categorie}${c.sousCategorie ? ` > ${c.sousCategorie}` : ''}`)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `CATALOGUE (id | prestation | unité | catégorie)\n${catalogue}\n\nDESCRIPTION DU CHANTIER\n<<<\n${description}\n>>>`,
    },
  ];
}

export const PROPOSITION_SCHEMA: LlmJsonSchema = {
  name: 'proposition_devis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['lignes', 'nonCouverts', 'hypotheses'],
    properties: {
      lignes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['prestationId', 'quantite', 'justification'],
          properties: {
            prestationId: { type: 'integer' },
            quantite: { type: 'number' },
            justification: { type: 'string' },
          },
        },
      },
      nonCouverts: { type: 'array', items: { type: 'string' } },
      hypotheses: { type: 'array', items: { type: 'string' } },
    },
  },
};

export interface LigneProposee {
  prestationId: number;
  quantite: number;
  justification: string;
}

export interface PropositionModele {
  lignes: LigneProposee[];
  nonCouverts: string[];
  hypotheses: string[];
}

const shortTexts = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 300))
        .slice(0, max)
    : [];

/**
 * Validates the model's answer. Unknown ids (the model "inventing" a prestation), duplicates
 * and absurd quantities are DROPPED, never trusted. Returns null if the shape is wrong.
 */
export function parseProposition(value: unknown, allowedIds: ReadonlySet<number>): PropositionModele | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.lignes)) return null;

  const seen = new Set<number>();
  const lignes: LigneProposee[] = [];
  for (const raw of v.lignes) {
    if (!raw || typeof raw !== 'object') continue;
    const l = raw as Record<string, unknown>;
    const id = Number(l.prestationId);
    const quantite = cleanQuantity(l.quantite);
    if (!Number.isInteger(id) || !allowedIds.has(id) || seen.has(id) || quantite === null) continue;
    seen.add(id);
    lignes.push({ prestationId: id, quantite, justification: typeof l.justification === 'string' ? l.justification.trim().slice(0, 300) : '' });
    if (lignes.length === MAX_LIGNES) break;
  }

  return { lignes, nonCouverts: shortTexts(v.nonCouverts, 10), hypotheses: shortTexts(v.hypotheses, 10) };
}

// ── quote from photos (C37 of 21/10) ────────────────────────────────────

/** 1 to 3 photos of the same job (several angles of one room / façade). */
export const MAX_PHOTOS_IA = 3;

export type QualitePhoto = 'BONNE' | 'MOYENNE' | 'INSUFFISANTE';

/** What the model saw, shown to the technician above the proposed lines. */
export interface AnalysePhoto {
  /** e.g. « Salle de bain », « Façade », « Toiture » */
  piece: string;
  /** Estimated floor (or façade) surface, null when it cannot be judged */
  surfaceEstimeeM2: number | null;
  /** Whether a reference object (door, tile, person…) helped estimate dimensions */
  objetReference: boolean;
  elementsVisibles: string[];
  etat: string;
  qualitePhoto: QualitePhoto;
}

const PHOTO_SYSTEM = `${SYSTEM}

PHOTOS
- Tu reçois 1 à 3 photos d'un même chantier (et parfois une courte description du technicien, prioritaire sur ce que tu crois voir).
- Identifie la pièce ou l'ouvrage (salle de bain, cuisine, façade, toiture…), les éléments visibles (revêtements, équipements, menuiseries…) et leur état.
- Estime la surface au sol (ou de la façade) en m² en t'appuyant sur des objets de taille connue (porte ≈ 0,83 × 2,04 m, carreau, prise, marche, personne…). Indique "objetReference" à true seulement si un tel objet t'a servi. Si tu ne peux pas estimer, mets null.
- Toute dimension tirée d'une photo est APPROXIMATIVE : écris-la dans "hypotheses" (ex. « Surface sol estimée ≈ 6 m² d'après la porte »).
- Propose les travaux que la photo et la description rendent nécessaires (rénovation de ce qui est visible et dégradé, ou ce que demande la description). Pas de travaux spéculatifs.
- "qualitePhoto" : INSUFFISANTE si la photo est floue, trop sombre, trop serrée ou ne montre pas de chantier ; dans ce cas propose peu ou pas de lignes.`;

export function buildPhotoMessages(images: string[], description: string, candidates: CatalogueEntry[]): LlmMessage[] {
  const catalogue = candidates
    .map((c) => `${c.id} | ${c.nom} | ${c.unite} | ${c.categorie}${c.sousCategorie ? ` > ${c.sousCategorie}` : ''}`)
    .join('\n');
  return [
    { role: 'system', content: PHOTO_SYSTEM },
    {
      role: 'user',
      content: `CATALOGUE (id | prestation | unité | catégorie)\n${catalogue}\n\nDESCRIPTION DU TECHNICIEN\n<<<\n${description || '(aucune — analyse les photos)'}\n>>>\n\n${images.length} photo(s) jointe(s).`,
      images,
    },
  ];
}

const PROPOSITION_PROPS = (PROPOSITION_SCHEMA.schema as { properties: Record<string, unknown> }).properties;

export const PHOTO_SCHEMA: LlmJsonSchema = {
  name: 'proposition_devis_photo',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['analyse', 'lignes', 'nonCouverts', 'hypotheses'],
    properties: {
      analyse: {
        type: 'object',
        additionalProperties: false,
        required: ['piece', 'surfaceEstimeeM2', 'objetReference', 'elementsVisibles', 'etat', 'qualitePhoto'],
        properties: {
          piece: { type: 'string' },
          surfaceEstimeeM2: { type: ['number', 'null'] },
          objetReference: { type: 'boolean' },
          elementsVisibles: { type: 'array', items: { type: 'string' } },
          etat: { type: 'string' },
          qualitePhoto: { type: 'string', enum: ['BONNE', 'MOYENNE', 'INSUFFISANTE'] },
        },
      },
      ...PROPOSITION_PROPS,
    },
  },
};

/** The model's description of the photos; anything malformed becomes « unknown », never trusted. */
export function parseAnalysePhoto(value: unknown): AnalysePhoto {
  const a = (value && typeof value === 'object' ? (value as { analyse?: unknown }).analyse : null) as Record<string, unknown> | null | undefined;
  const text = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const surface = Number(a?.surfaceEstimeeM2);
  const qualite = a?.qualitePhoto;
  return {
    piece: text(a?.piece) || 'Non identifiée',
    surfaceEstimeeM2: a?.surfaceEstimeeM2 !== null && Number.isFinite(surface) && surface > 0 && surface <= 5000 ? Math.round(surface * 10) / 10 : null,
    objetReference: a?.objetReference === true,
    elementsVisibles: shortTexts(a?.elementsVisibles, 12).map((t) => t.slice(0, 120)),
    etat: text(a?.etat, 300),
    qualitePhoto: qualite === 'BONNE' || qualite === 'MOYENNE' || qualite === 'INSUFFISANTE' ? qualite : 'MOYENNE',
  };
}
