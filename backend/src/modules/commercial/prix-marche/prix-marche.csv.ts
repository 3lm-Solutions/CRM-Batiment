import type { TypePrix, Unite } from '../../../generated/prisma/client';
import { TextDecoder } from 'node:util';

/**
 * Imported price list (29/10): a CSV made in Excel or LibreOffice.
 *   type;nom;unite;prix_min;prix_max;achat_vente;source
 *   PRESTATION;Pose carrelage sol;m2;45;65;VENTE;FFB 2026
 * Separator « ; », « , » or tab; decimal comma accepted; UTF-8 or Windows-1252 (Excel FR).
 */

export const MAX_LIGNES_CSV = 5000;
export const ENTETE_CSV = [
  'type',
  'nom',
  'unite',
  'prix_min',
  'prix_max',
  'achat_vente',
  'source',
] as const;

/** Text of the file: UTF-8, or Windows-1252 when it is not valid UTF-8 (Excel « CSV » in French). */
export function decoderTexte(buf: Buffer): string {
  let texte: string;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      texte = new TextDecoder('windows-1252').decode(buf);
    } catch {
      texte = buf.toString('latin1');
    }
  }
  return texte.replace(/^\uFEFF/, '');
}

/** One CSV line → cells (quotes "…" and doubled quotes "" handled). */
export function decouperLigne(ligne: string, sep: string): string[] {
  const cellules: string[] = [];
  let cur = '';
  let guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemets) {
      if (c === '"' && ligne[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cur += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      cellules.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  cellules.push(cur.trim());
  return cellules;
}

export function detecterSeparateur(entete: string): string {
  const compte = (c: string) => entete.split(c).length - 1;
  return [';', '\t', ','].reduce((best, c) => (compte(c) > compte(best) ? c : best), ';');
}

/** « Pose  Carrelage-sol » and « pose carrelage sol » match; accents ignored. */
export function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}

const UNITES: Record<string, Unite> = {
  m2: 'M2',
  'm²': 'M2',
  m: 'ML',
  ml: 'ML',
  'm lineaire': 'ML',
  m3: 'M3',
  'm³': 'M3',
  piece: 'PIECE',
  pieces: 'PIECE',
  u: 'PIECE',
  unite: 'PIECE',
  pc: 'PIECE',
  pce: 'PIECE',
  jour: 'JOUR',
  j: 'JOUR',
  jours: 'JOUR',
  heure: 'HEURE',
  h: 'HEURE',
  heures: 'HEURE',
  litre: 'LITRE',
  l: 'LITRE',
  litres: 'LITRE',
  kg: 'KG',
  forfait: 'FORFAIT',
  ft: 'FORFAIT',
  ens: 'FORFAIT',
};

export function lireUnite(v: string): Unite | null {
  const k = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.$/, '');
  const brut = v.trim().toUpperCase();
  if (['M2', 'ML', 'M3', 'PIECE', 'JOUR', 'HEURE', 'LITRE', 'KG', 'FORFAIT'].includes(brut))
    return brut as Unite;
  return UNITES[k] ?? UNITES[v.trim().toLowerCase()] ?? null;
}

/** « 1 234,50 € » → 1234.5 ; invalid → null */
export function lirePrix(v: string): number | null {
  const t = v.replace(/[€\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= 10_000_000 ? Math.round(n * 100) / 100 : null;
}

export interface LigneCsv {
  numero: number;
  type: 'PRESTATION' | 'MATERIAU';
  nom: string;
  unite: Unite;
  prixMin: number;
  prixMax: number;
  typePrix: TypePrix;
  source: string | null;
}

export interface LectureCsv {
  lignes: LigneCsv[];
  erreurs: { ligne: number; raison: string }[];
}

/** Reads and checks every line; a wrong line is reported, never imported half-way. */
export function lireCsv(texte: string): LectureCsv {
  const brut = texte.split(/\r\n|\n|\r/);
  const premiere = brut.findIndex((l) => l.trim());
  if (premiere === -1) return { lignes: [], erreurs: [{ ligne: 1, raison: 'Fichier vide.' }] };
  const sep = detecterSeparateur(brut[premiere]);
  const entete = decouperLigne(brut[premiere], sep).map((c) => normaliserNom(c).replace(/ /g, '_'));
  const col = (nom: string) => entete.indexOf(nom);
  const manquantes = ['type', 'nom', 'unite', 'prix_min', 'prix_max'].filter((c) => col(c) === -1);
  if (manquantes.length) {
    return {
      lignes: [],
      erreurs: [
        {
          ligne: premiere + 1,
          raison: `Colonnes manquantes : ${manquantes.join(', ')}. Utilisez le modèle téléchargeable.`,
        },
      ],
    };
  }
  const lignes: LigneCsv[] = [];
  const erreurs: LectureCsv['erreurs'] = [];
  for (let i = premiere + 1; i < brut.length; i++) {
    if (!brut[i].trim()) continue;
    const numero = i + 1;
    if (lignes.length + erreurs.length >= MAX_LIGNES_CSV) {
      erreurs.push({
        ligne: numero,
        raison: `Plus de ${MAX_LIGNES_CSV} lignes : la suite est ignorée.`,
      });
      break;
    }
    const c = decouperLigne(brut[i], sep);
    const get = (nom: string) => (col(nom) === -1 ? '' : (c[col(nom)] ?? ''));
    const typeBrut = normaliserNom(get('type'));
    const type = typeBrut.startsWith('prest')
      ? 'PRESTATION'
      : typeBrut.startsWith('mat')
        ? 'MATERIAU'
        : null;
    const nom = get('nom').trim();
    const unite = lireUnite(get('unite'));
    const prixMin = lirePrix(get('prix_min'));
    const prixMax = lirePrix(get('prix_max'));
    const av = normaliserNom(get('achat_vente'));
    const typePrix: TypePrix | null =
      !av || av.startsWith('vente') ? 'VENTE' : av.startsWith('achat') ? 'ACHAT' : null;
    // Empty price cells: a line of the template left blank on purpose → skipped silently
    if (!get('prix_min').trim() && !get('prix_max').trim()) continue;
    const raison = !type
      ? 'Type : PRESTATION ou MATERIAU.'
      : !nom
        ? 'Nom manquant.'
        : !unite
          ? `Unité inconnue « ${get('unite')} » (m2, ml, m3, piece, jour, heure, litre, kg, forfait).`
          : prixMin === null || prixMax === null
            ? 'Prix min et max : des nombres (ex. 45 ou 45,50).'
            : prixMin > prixMax
              ? 'Le prix min est plus grand que le prix max.'
              : !typePrix
                ? 'Achat_vente : ACHAT ou VENTE.'
                : type === 'PRESTATION' && typePrix === 'ACHAT'
                  ? 'Une prestation a seulement un prix de VENTE.'
                  : null;
    if (raison) {
      erreurs.push({ ligne: numero, raison });
      continue;
    }
    lignes.push({
      numero,
      type: type!,
      nom,
      unite: unite!,
      prixMin: prixMin!,
      prixMax: prixMax!,
      typePrix: typePrix!,
      source: get('source').trim().slice(0, 200) || null,
    });
  }
  return { lignes, erreurs };
}

/** Cell for the template / export: quoted when needed. */
export function celluleCsv(v: string | number | null): string {
  if (v === null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
