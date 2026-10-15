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
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
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
export function mergeFields(current: ProspectFields, extracted: Record<string, unknown>, typesProjet: string[]): ProspectFields {
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
  if (type) set('typeProjet', typesProjet.find((t) => t.toLowerCase() === type.toLowerCase()) ?? null);
  const description = cleanText(extracted.description, 2000);
  // Keep the richest description
  if (description && description.length >= (current.description?.length ?? 0)) next.description = description;
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
