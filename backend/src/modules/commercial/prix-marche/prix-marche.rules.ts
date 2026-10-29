/**
 * Prix de marché (29/10) — pure statistics on the company's own prices: signed quotes (sale
 * price) and supplier orders (purchase price). No AI, no invented figure: every number comes
 * from a real quote / order, or from the price list the Admin imported (CSV).
 */

/** Below this number of prices, the company's own data is not enough: the imported list is used. */
export const MIN_ECHANTILLON = 3;
/** From this number of prices, the usual range is the middle half (25 %–75 %), not min–max. */
const ECHANTILLON_QUARTILES = 5;
/** The trend needs this many prices, spread over at least this many days. */
const MIN_TENDANCE = 4;
const MIN_JOURS_TENDANCE = 60;
/** A trend above ±50 %/year is noise (a few odd quotes): not shown. */
const TENDANCE_MAX_PCT = 50;

const JOUR_MS = 86_400_000;
const AN_MS = 365.25 * JOUR_MS;

export interface Observation {
  prix: number;
  date: Date;
}

export interface StatistiquesPrix {
  nombre: number;
  min: number;
  max: number;
  mediane: number;
  /** Usual range: 25 %–75 % of the prices (min–max when there are few) */
  basse: number;
  haute: number;
  /** Price change per year, in % (null: not enough prices or too short a period) */
  tendancePctAn: number | null;
  /** Price expected today and in 6 months according to the trend (null without a trend) */
  estimeAujourdhui: number | null;
  estime6Mois: number | null;
  dernierPrix: number;
  dernierLe: Date;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Linear interpolation quantile (same as a spreadsheet's PERCENTILE). */
export function quantile(trie: number[], q: number): number {
  if (!trie.length) return NaN;
  const pos = (trie.length - 1) * q;
  const bas = Math.floor(pos);
  const haut = Math.ceil(pos);
  return trie[bas] + (trie[haut] - trie[bas]) * (pos - bas);
}

/** Least squares: price = a + b × years. null when the data cannot support a trend. */
export function regression(obs: Observation[]): { a: number; b: number; t0: number } | null {
  if (obs.length < MIN_TENDANCE) return null;
  const temps = obs.map((o) => o.date.getTime());
  const t0 = Math.min(...temps);
  if (Math.max(...temps) - t0 < MIN_JOURS_TENDANCE * JOUR_MS) return null;
  const xs = temps.map((t) => (t - t0) / AN_MS);
  const ys = obs.map((o) => o.prix);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  if (den === 0 || my <= 0) return null;
  const b = num / den;
  return { a: my - b * mx, b, t0 };
}

export function statistiques(obs: Observation[], maintenant = new Date()): StatistiquesPrix | null {
  const valides = obs.filter((o) => Number.isFinite(o.prix) && o.prix >= 0);
  if (!valides.length) return null;
  const trie = valides.map((o) => o.prix).sort((x, y) => x - y);
  const quartiles = trie.length >= ECHANTILLON_QUARTILES;
  const dernier = valides.reduce((d, o) => (o.date > d.date ? o : d));

  let tendancePctAn: number | null = null;
  let estimeAujourdhui: number | null = null;
  let estime6Mois: number | null = null;
  const r = regression(valides);
  if (r) {
    const moyenne = trie.reduce((s, p) => s + p, 0) / trie.length;
    const pct = (r.b / moyenne) * 100;
    if (Math.abs(pct) <= TENDANCE_MAX_PCT) {
      tendancePctAn = Math.round(pct * 10) / 10;
      const valeur = (t: number) => Math.max(0, r.a + r.b * ((t - r.t0) / AN_MS));
      estimeAujourdhui = arrondi(valeur(maintenant.getTime()));
      estime6Mois = arrondi(valeur(maintenant.getTime() + AN_MS / 2));
    }
  }

  return {
    nombre: trie.length,
    min: arrondi(trie[0]),
    max: arrondi(trie[trie.length - 1]),
    mediane: arrondi(quantile(trie, 0.5)),
    basse: arrondi(quartiles ? quantile(trie, 0.25) : trie[0]),
    haute: arrondi(quartiles ? quantile(trie, 0.75) : trie[trie.length - 1]),
    tendancePctAn,
    estimeAujourdhui,
    estime6Mois,
    dernierPrix: arrondi(dernier.prix),
    dernierLe: dernier.date,
  };
}

export type SourcePrix = 'DEVIS' | 'COMMANDES' | 'BAREME';

export interface Bareme {
  prixMin: number;
  prixMax: number;
  source: string | null;
}

/** What the screens show for one prestation / material and one unit. */
export interface PrixMarche {
  source: SourcePrix;
  nombre: number;
  basse: number;
  haute: number;
  mediane: number | null;
  tendancePctAn: number | null;
  estimeAujourdhui: number | null;
  estime6Mois: number | null;
  /** The imported range, also given when the company's own data is used */
  bareme: Bareme | null;
}

/**
 * The company's own prices when there are enough of them, otherwise the imported list,
 * otherwise nothing (null: « pas assez de données »).
 */
export function prixMarche(
  stats: StatistiquesPrix | null,
  source: 'DEVIS' | 'COMMANDES',
  bareme: Bareme | null,
): PrixMarche | null {
  if (stats && stats.nombre >= MIN_ECHANTILLON) {
    const { nombre, basse, haute, mediane, tendancePctAn, estimeAujourdhui, estime6Mois } = stats;
    return {
      source,
      nombre,
      basse,
      haute,
      mediane,
      tendancePctAn,
      estimeAujourdhui,
      estime6Mois,
      bareme,
    };
  }
  if (bareme) {
    return {
      source: 'BAREME',
      nombre: stats?.nombre ?? 0,
      basse: bareme.prixMin,
      haute: bareme.prixMax,
      mediane: null,
      tendancePctAn: null,
      estimeAujourdhui: null,
      estime6Mois: null,
      bareme,
    };
  }
  return null;
}

export type PositionPrix = 'BAS' | 'DANS' | 'HAUT';

/** Where a price sits in the usual range (the orange alert of the quote editor). */
export function positionPrix(
  prix: number,
  marche: Pick<PrixMarche, 'basse' | 'haute'>,
): PositionPrix {
  if (prix < marche.basse - 0.005) return 'BAS';
  if (prix > marche.haute + 0.005) return 'HAUT';
  return 'DANS';
}

/** Start of the period: N months before now. */
export function debutPeriode(mois: number, maintenant = new Date()): Date {
  const d = new Date(maintenant);
  d.setMonth(d.getMonth() - mois);
  return d;
}
