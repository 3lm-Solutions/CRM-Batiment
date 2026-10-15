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
