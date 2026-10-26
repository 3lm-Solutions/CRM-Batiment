/**
 * Pure rules of the email → prospect import (22/10), unit-tested.
 */

/** Keeps the new text of an email: drops the quoted previous messages and the signature. */
export function corpsUtile(texte: string, max = 4000): string {
  const lignes: string[] = [];
  for (const ligne of texte.replace(/\r\n/g, '\n').split('\n')) {
    // « Le lun. 20 oct. 2026 à 10:00, X a écrit : » / « On …, X wrote: » / « -----Original Message----- »
    if (/^(le|on)\s.{5,200}(a écrit|wrote)\s*:\s*$/i.test(ligne.trim())) break;
    if (/^-{2,}\s*(original message|message d'origine|message transféré)/i.test(ligne.trim())) break;
    if (/^(de|from)\s*:\s.+@/i.test(ligne.trim()) && lignes.length > 2) break;
    if (ligne.trim() === '--' || ligne.trim() === '-- ') break; // signature delimiter
    if (ligne.startsWith('>')) continue;
    lignes.push(ligne);
  }
  return lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/** Words of a building-work request (guided mode, without AI). */
const MOTS_DEMANDE = /(?<!\p{L})(devis|travaux|r[ée]nov\p{L}*|chantier|salle de (bain|douche)|cuisine|toiture|couverture|isolation|peinture|carrelage|fa[iï]ence|plomberie|[ée]lectricit[ée]|ma[çc]onnerie|extension|terrasse|fen[eê]tres?|menuiserie|parquet|cloison|placo|fuite|infiltration|intervention|estimation|tarif|prix|projet)(?!\p{L})/iu;

export const ressembleDemande = (sujet: string, corps: string) => MOTS_DEMANDE.test(`${sujet}\n${corps}`);

/** Our own addresses (the CRM's sender, the mailbox itself): never a prospect, avoids loops. */
export function estAdresseInterne(adresse: string | null, internes: (string | null | undefined)[]): boolean {
  if (!adresse) return false;
  const a = adresse.toLowerCase();
  return internes.some((i) => i && i.toLowerCase() === a);
}

/** Lower case, without accents: « Démande DE Devis » → « demande de devis » */
const plat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** IMAP_SUBJECTS « devis, Demande » → ['devis', 'demande'] (empty = no filter) */
export const motsObjet = (liste: string | undefined) => [...new Set((liste ?? '').split(',').map((m) => plat(m.trim())).filter(Boolean))];

/** The subject contains one of the words (case and accents ignored); no word = every email. */
export const objetCorrespond = (sujet: string, mots: string[]) => !mots.length || mots.some((m) => plat(sujet).includes(m));

/** « Re: Fwd: Devis cuisine » → « Devis cuisine » */
export const sujetPropre = (sujet: string) => sujet.replace(/^\s*((re|fw|fwd|tr|réf)\s*:\s*)+/i, '').trim().slice(0, 200);
