/**
 * Prospect details collected by the chatbot. Pure functions (unit-tested): whatever the AI
 * extracts is re-validated here — the model is never trusted to produce a valid email or phone.
 */
export interface ProspectFields {
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  typeProjet?: string | null;
  description?: string | null;
  delai?: string | null;
}

export type ProspectField = keyof ProspectFields;

/** Order in which the guided mode asks for missing details. */
export const ASK_ORDER: ProspectField[] = ['description', 'nom', 'telephone', 'email', 'adresse'];

export const FIELD_LABELS: Record<ProspectField, string> = {
  nom: 'votre nom',
  prenom: 'votre prénom',
  email: 'votre email',
  telephone: 'votre numéro de téléphone',
  adresse: 'l’adresse du chantier',
  typeProjet: 'le type de travaux',
  description: 'votre projet',
  delai: 'le délai souhaité',
};

const EMAIL = /^[^\s@<>()"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return EMAIL.test(v) ? v : null;
}

/** French numbers (06…, +33 6…, 0033…) → "06 12 34 56 78"; other international numbers kept as +digits. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('0033')) digits = '+33' + digits.slice(4);
  if (digits.startsWith('+33')) digits = '0' + digits.slice(3);
  if (/^0[1-9]\d{8}$/.test(digits)) return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  // Foreign local numbers (e.g. Tunisia 8 digits, Nigeria 11): 8 to 15 digits, kept as typed
  if (/^\d{8,15}$/.test(digits)) return value.trim().replace(/\s+/g, ' ');
  return null;
}

/** Digits only, for duplicate detection ("06 12…" = "0612…" = "+33 6 12…"). */
export const phoneKey = (phone: string | null | undefined) => {
  const n = normalizePhone(phone ?? '');
  return n ? n.replace(/\D/g, '').slice(-9) : null;
};

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  // \p{Cc}: control characters (U+0000–U+001F, U+007F–U+009F)
  const v = value
    .replace(/[\p{Cc}<>]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return v ? v.slice(0, max) : null;
}

function cleanName(value: unknown): string | null {
  const v = cleanText(value, 80);
  // A name has letters, no digits, no "@", and isn't a sentence
  if (!v || /\d|@/.test(v) || v.split(' ').length > 5 || !/\p{L}/u.test(v)) return null;
  return v;
}

/**
 * Merges newly extracted values into what is already known. A valid new value replaces the
 * old one (the visitor corrected himself); an invalid or empty one is ignored.
 */
export function mergeFields(
  current: ProspectFields,
  extracted: Record<string, unknown>,
  typesProjet: string[],
): ProspectFields {
  const next: ProspectFields = { ...current };
  const set = <K extends ProspectField>(k: K, v: ProspectFields[K] | null) => {
    if (v) next[k] = v;
  };
  set('nom', cleanName(extracted.nom));
  set('prenom', cleanName(extracted.prenom));
  set('email', normalizeEmail(extracted.email));
  set('telephone', normalizePhone(extracted.telephone));
  set('adresse', cleanText(extracted.adresse, 300));
  set('delai', cleanText(extracted.delai, 120));
  // Only the company's own project types (case-insensitive match), never a free label
  const type = cleanText(extracted.typeProjet, 120);
  if (type)
    set('typeProjet', typesProjet.find((t) => t.toLowerCase() === type.toLowerCase()) ?? null);
  const description = cleanText(extracted.description, 2000);
  // Keep the richest description
  if (description && description.length >= (current.description?.length ?? 0))
    next.description = description;
  return next;
}

/** A prospect can be passed to the sales team with: a name, a way to call back, and the need. */
export function missingFields(f: ProspectFields): ProspectField[] {
  const missing: ProspectField[] = [];
  if (!f.description || f.description.length < 10) missing.push('description');
  if (!f.nom) missing.push('nom');
  if (!f.telephone && !f.email) missing.push('telephone');
  return missing;
}

export const isComplete = (f: ProspectFields) => missingFields(f).length === 0;

/** Guided mode (no AI): finds an email / phone written anywhere in a message. */
export function extractContacts(message: string): Pick<ProspectFields, 'email' | 'telephone'> {
  const email = message.match(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,24}/i)?.[0];
  const phone = message.match(/(?:\+33|0033|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)?.[0];
  return { email: normalizeEmail(email), telephone: normalizePhone(phone) };
}

// ── 29/10: details read from the visitor's own words, whatever the AI returns ───────────────────

/** Which detail the assistant's last message asked for (to understand a short answer). */
export function champDemande(texteAssistant: string | null | undefined): ProspectField | null {
  const t = (texteAssistant ?? '').toLowerCase();
  if (!t) return null;
  if (/\bnom\b|vous appelez|appelle[sz]?-vous|qui dois-je/.test(t)) return 'nom';
  if (/t[ée]l[ée]phone|num[ée]ro|joindre|recontacter|e-?mail|adresse (e-?mail|mail)/.test(t))
    return 'telephone';
  if (/ville|commune|adresse|o[uù] se (situe|trouve)|code postal/.test(t)) return 'adresse';
  if (/d[ée]cri|votre projet|quels? travaux|surface/.test(t)) return 'description';
  return null;
}

const STOP = new Set([
  'et',
  'je',
  "j'",
  'pour',
  'qui',
  'mon',
  'ma',
  'mes',
  'de',
  'du',
  'au',
  'à',
  'a',
  'votre',
  'pouvez',
]);
const QUESTION = /\?\s*$|^(quel|quand|comment|combien|est-ce|pouvez|faites|vous|avez)/i;

/**
 * Safety net under the AI (29/10): a prospect wrote his name, phone or project but the model did
 * not return it (smaller models often forget). Emails / phones anywhere, « je m'appelle … », and a
 * short answer to the question just asked. The AI's own non-empty values win over these.
 */
export function deduireChamps(
  contenu: string,
  demande: ProspectField | null,
  connus: ProspectFields,
): Record<string, string> {
  const out: Record<string, string> = {};
  const { email, telephone } = extractContacts(contenu);
  if (email) out.email = email;
  if (telephone) out.telephone = telephone;
  const appelle = /(?:je m.appelle|moi c.est|mon nom (?:est|c.est))\s+([\p{L}' -]{2,60})/iu.exec(
    contenu,
  )?.[1];
  if (appelle) {
    // « Jean Dupont et je voudrais… » → « Jean Dupont »
    const mots: string[] = [];
    for (const m of appelle.trim().split(/\s+/)) {
      if (STOP.has(m.toLowerCase()) || mots.length === 3) break;
      mots.push(m);
    }
    if (mots.length >= 2) {
      out.prenom = mots[0];
      out.nom = mots.slice(1).join(' ');
    } else if (mots.length === 1) out.nom = mots[0];
  }
  if (QUESTION.test(contenu.trim())) return out;
  // Text left once the contacts are taken out
  const reste = contenu
    .replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,24}/gi, ' ')
    .replace(/(?:\+33|0033|\+\d{2,3}|0)?[\s.-]*\d(?:[\s.-]*\d){7,14}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:.\-\s]+|[,;:.\-\s]+$/g, '');
  if (
    demande === 'nom' &&
    !connus.nom &&
    !out.nom &&
    reste &&
    reste.split(' ').length <= 4 &&
    !/\d/.test(reste)
  ) {
    const mots = reste.replace(/^(nom\s*:\s*)/i, '').split(' ');
    if (mots.length >= 2) {
      out.prenom = mots[0];
      out.nom = mots.slice(1).join(' ');
    } else out.nom = mots[0];
  } else if (demande === 'adresse' && !connus.adresse && reste && reste.length <= 120) {
    out.adresse = reste;
  } else if (
    (demande === 'description' || !connus.description) &&
    reste.length >= 20 &&
    !email &&
    !telephone
  ) {
    out.description = reste;
  }
  return out;
}

/** Keeps the AI's values that say something (an empty string means « not found »). */
export function champsRenseignes(champs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(champs).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
  );
}
