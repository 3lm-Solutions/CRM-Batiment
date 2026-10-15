/**
 * Pure helpers of the quote assistant (Step 15): find the catalogue prestations that match a
 * job description, and read surfaces / lengths written in it. No database, no AI: unit-tested,
 * and used on their own when no OpenAI key is configured (guided mode).
 */

export interface CatalogueEntry {
  id: number;
  nom: string;
  description: string | null;
  unite: string;
  categorie: string;
  sousCategorie: string | null;
}

export interface ScoredEntry extends CatalogueEntry {
  score: number;
}

/** Lower case, no accents, no punctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Words that say nothing about the work itself
const STOPWORDS = new Set(
  (
    'les des une un de du la le et en au aux pour avec sans sur sous dans par a à est sont ' +
    'je veux voudrais souhaite refaire faire mettre avoir nous vous mon ma mes son sa ses leur ' +
    'environ tout toute tous complet complete complète totale total neuf neuve nouveau nouvelle ' +
    'chantier travaux projet maison appartement piece pièce m2 ml m² metre metres mètre mètres ' +
    'carre carres carré carrés lineaire lineaires linéaire linéaires plus moins tres très bien ' +
    'aussi ainsi que qui quoi dont cette ces cet ce ' +
    // generic verbs: "remplacer la chaudière" must not match every "Remplacement …" prestation
    'pose poser installer installation remplacer remplacement changer renover renovation ' +
    'creer creation refaire reprendre mise'
  )
    .split(' ')
    .map((w) => normalize(w)),
);

/** A few everyday words written differently in the catalogue. */
const SYNONYMS: Record<string, string> = {
  peindre: 'peinture',
  repeindre: 'peinture',
  sdb: 'bain',
  wc: 'wc',
  toilette: 'wc',
  carreau: 'carrelage',
  parquet: 'parquet',
};

/** Plural removed ("douches" → "douche"), then synonyms ("carreaux" → "carrelage"). */
function singular(word: string): string {
  const w = word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
  return SYNONYMS[w] ?? w;
}

export function keywords(text: string): string[] {
  const words = normalize(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words.map(singular))];
}

/**
 * Two keywords match when one starts with the other (4+ letters: "isol" / "isolation") or
 * they share their first 5 letters ("carreau" / "carrelage", "peinture" / "peintures").
 */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short)) return true;
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return i >= 5;
}

/**
 * Scores every entry against the description: a keyword found in the prestation name counts 3,
 * in its category / sub-category 2, in its description 1. Best first; score 0 entries dropped.
 */
export function scoreCatalogue(description: string, entries: CatalogueEntry[]): ScoredEntry[] {
  const query = keywords(description);
  if (!query.length) return [];
  const has = (list: string[], k: string) => list.some((w) => sameWord(w, k));

  return entries
    .map((e) => {
      const nom = keywords(e.nom);
      const categorie = keywords(`${e.categorie} ${e.sousCategorie ?? ''}`);
      const desc = keywords(e.description ?? '');
      let score = 0;
      for (const k of query) {
        if (has(nom, k)) score += 3;
        else if (has(categorie, k)) score += 2;
        else if (has(desc, k)) score += 1;
      }
      return { ...e, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, 'fr'));
}

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;

/** "8 m²", "8m2", "8 mètres carrés" → 8 (the first one written). */
export function extractSurface(text: string): number | null {
  const m = new RegExp(`${NUMBER}\\s*(?:m²|m2|m 2|metres? carres?|mètres? carrés?)`, 'i').exec(text);
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** "12 ml", "12 mètres linéaires" → 12. */
export function extractLength(text: string): number | null {
  const m = new RegExp(`${NUMBER}\\s*(?:ml\\b|metres? lineaires?|mètres? linéaires?)`, 'i').exec(text);
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Quantity for a line in guided mode: the surface for M2, the length for ML, else 1. */
export function guessQuantity(unite: string, surface: number | null, longueur: number | null): number {
  if (unite === 'M2' && surface) return surface;
  if (unite === 'ML' && longueur) return longueur;
  return 1;
}

/** Keeps a sensible quantity: positive, at most 10 000, 2 decimals. */
export function cleanQuantity(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(Math.min(n, 10_000) * 100) / 100;
}
