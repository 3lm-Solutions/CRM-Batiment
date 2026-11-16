import type { LeadSource } from '@/types';

export interface ClientImportPayload {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  adresseClient?: string;
  adresseChantier?: string;
  source?: LeadSource;
  besoin?: string;
  notes?: string;
  typeProjetIds?: number[];
}

export interface SpreadsheetClientRow {
  rowNumber: number;
  payload: ClientImportPayload;
}

export interface SpreadsheetInvalidRow {
  rowNumber: number;
  reason: string;
}

export interface SpreadsheetParseResult {
  rows: SpreadsheetClientRow[];
  skippedRows: number;
  invalidRows: SpreadsheetInvalidRow[];
}

// TypeProjet minimal shape needed for name→id resolution
export interface TypeProjetLookup {
  id: number;
  nom: string;
}

type MappedField = keyof Omit<ClientImportPayload, 'typeProjetIds'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Column header aliases (old format: one column per field) ────────────────

const FIELD_ALIASES: Record<string, MappedField> = {
  nom: 'nom',
  lastname: 'nom',
  surname: 'nom',
  familyname: 'nom',
  nomdefamille: 'nom',
  prenom: 'prenom',
  prenon: 'prenom',
  firstname: 'prenom',
  givenname: 'prenom',
  email: 'email',
  emeail: 'email',
  mail: 'email',
  courriel: 'email',
  telephone: 'telephone',
  tel: 'telephone',
  numerodetelephone: 'telephone',
  numerotel: 'telephone',
  phone: 'telephone',
  mobile: 'telephone',
  adresse: 'adresseClient',
  adresseclient: 'adresseClient',
  adressefacturation: 'adresseClient',
  chantier: 'adresseChantier',
  adressechantier: 'adresseChantier',
  adresseprojet: 'adresseChantier',
  source: 'source',
  provenance: 'source',
  canal: 'source',
  besoin: 'besoin',
  demandeduclient: 'besoin',
  objectif: 'besoin',
  notes: 'notes',
  note: 'notes',
  commentaire: 'notes',
  commentaires: 'notes',
  observation: 'notes',
  observations: 'notes',
};

const LEAD_SOURCE_ALIASES: Record<string, LeadSource> = {
  chatbot: 'CHATBOT',
  technicocommercial: 'TECHNICO_COMMERCIAL',
  technico: 'TECHNICO_COMMERCIAL',
  appel: 'APPEL',
  appeltel: 'APPEL',
  appeltelephonique: 'APPEL',
  recommandation: 'RECOMMANDATION',
  recommendation: 'RECOMMANDATION',
  siteweb: 'SITE_WEB',
  web: 'SITE_WEB',
  website: 'SITE_WEB',
  autre: 'AUTRE',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
  return text;
}

function resolveField(header: string): MappedField | undefined {
  return FIELD_ALIASES[normalizeToken(header)];
}

function normalizeLeadSource(value: string): LeadSource | undefined {
  const normalized = normalizeToken(value);
  if (!normalized) return undefined;
  if (normalized in LEAD_SOURCE_ALIASES) {
    return LEAD_SOURCE_ALIASES[normalized];
  }
  const upper = value.toUpperCase().trim() as LeadSource;
  if (['CHATBOT', 'TECHNICO_COMMERCIAL', 'APPEL', 'RECOMMANDATION', 'SITE_WEB', 'AUTRE'].includes(upper)) {
    return upper;
  }
  return undefined;
}

/**
 * Detect whether the spreadsheet uses the combined format:
 * columns named "Client", "Contact", "Type projet", "Besoin", "Source", "Date"
 */
function isCombinedFormat(headers: string[]): boolean {
  const normalized = headers.map(normalizeToken);
  return normalized.includes('client') && normalized.includes('contact');
}

/**
 * Parse "prenom;nom" → { prenom, nom }
 * Also handles "nom, prenom" or plain "nom" (single value = nom)
 */
function parseClientCell(value: string): { prenom?: string; nom: string } | null {
  const text = value.trim();
  if (!text) return null;

  // Separator: semicolon (prenom;nom) or comma (nom, prenom)
  if (text.includes(';')) {
    const [first, second] = text.split(';').map((p) => p.trim());
    if (!second) return { nom: first };
    return { prenom: first, nom: second };
  }

  if (text.includes(',')) {
    const [first, second] = text.split(',').map((p) => p.trim());
    if (!second) return { nom: first };
    // "Dupont, Jean" → nom=Dupont, prenom=Jean
    return { nom: first, prenom: second };
  }

  // Single word or full name with space — treat whole thing as nom
  const parts = text.split(/\s+/);
  if (parts.length >= 2) {
    return { prenom: parts[0], nom: parts.slice(1).join(' ') };
  }

  return { nom: text };
}

/**
 * Parse "email;telephone" → { email, telephone }
 * Also handles a single value that looks like email or phone
 */
function parseContactCell(value: string): { email?: string; telephone?: string } {
  const text = value.trim();
  if (!text) return {};

  if (text.includes(';')) {
    const parts = text.split(';').map((p) => p.trim()).filter(Boolean);
    const result: { email?: string; telephone?: string } = {};
    for (const part of parts) {
      if (EMAIL_PATTERN.test(part)) {
        result.email = part;
      } else {
        result.telephone = part;
      }
    }
    return result;
  }

  // Single value
  if (EMAIL_PATTERN.test(text)) return { email: text };
  if (/^[+\d\s()./-]{5,}$/.test(text)) return { telephone: text };
  return {};
}

/**
 * Resolve a type project name (fuzzy) to its ID from the known list.
 * Returns undefined if not found.
 */
function resolveTypeProjetId(
  name: string,
  typesProjet: TypeProjetLookup[],
): number | undefined {
  const needle = normalizeToken(name);
  if (!needle) return undefined;

  // Exact normalized match first
  const exact = typesProjet.find((t) => normalizeToken(t.nom) === needle);
  if (exact) return exact.id;

  // Partial: needle starts with or is contained in known name
  const partial = typesProjet.find(
    (t) => normalizeToken(t.nom).includes(needle) || needle.includes(normalizeToken(t.nom)),
  );
  return partial?.id;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export async function parseClientsSpreadsheet(
  file: File,
  typesProjet: TypeProjetLookup[] = [],
): Promise<SpreadsheetParseResult> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Le fichier est vide.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    return { rows: [], skippedRows: 0, invalidRows: [] };
  }

  const headers = Object.keys(rawRows[0]);
  const combined = isCombinedFormat(headers);

  const rows: SpreadsheetClientRow[] = [];
  const invalidRows: SpreadsheetInvalidRow[] = [];
  let skippedRows = 0;

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;

    // ── Combined format: Client | Contact | Type projet | Besoin | Source | Date
    if (combined) {
      const clientVal = toOptionalString(rawRow['Client'] ?? rawRow['client']);
      const contactVal = toOptionalString(rawRow['Contact'] ?? rawRow['contact']);
      const typeProjetVal = toOptionalString(rawRow['Type projet'] ?? rawRow['type projet'] ?? rawRow['typeprojet'] ?? rawRow['Type Projet']);
      const besoinVal = toOptionalString(rawRow['Besoin'] ?? rawRow['besoin']);
      const sourceVal = toOptionalString(rawRow['Source'] ?? rawRow['source']);
      // Date column is informational — we don't store it separately

      // Skip completely empty rows
      if (!clientVal && !contactVal && !typeProjetVal) {
        skippedRows += 1;
        return;
      }

      if (!clientVal) {
        invalidRows.push({ rowNumber, reason: 'Colonne "Client" manquante ou vide.' });
        return;
      }

      const parsed = parseClientCell(clientVal);
      if (!parsed) {
        invalidRows.push({ rowNumber, reason: `Impossible de lire le nom depuis "${clientVal}".` });
        return;
      }

      const contact = parseContactCell(contactVal ?? '');

      if (contact.email && !EMAIL_PATTERN.test(contact.email)) {
        invalidRows.push({ rowNumber, reason: `Email invalide : "${contact.email}".` });
        return;
      }

      // Resolve type de projet → ID
      const typeProjetIds: number[] = [];
      if (typeProjetVal) {
        // Support multiple types separated by comma or pipe
        const typeNames = typeProjetVal.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
        for (const typeName of typeNames) {
          const id = resolveTypeProjetId(typeName, typesProjet);
          if (id !== undefined) {
            typeProjetIds.push(id);
          }
        }
      }

      rows.push({
        rowNumber,
        payload: {
          nom: parsed.nom,
          prenom: parsed.prenom,
          email: contact.email,
          telephone: contact.telephone,
          source: sourceVal ? (normalizeLeadSource(sourceVal) ?? 'AUTRE') : 'AUTRE',
          besoin: besoinVal,
          typeProjetIds: typeProjetIds.length > 0 ? typeProjetIds : undefined,
        },
      });

      return;
    }

    // ── Legacy format: one column per field ───────────────────────────────────
    const draft: Partial<ClientImportPayload> = {};
    const draftTypeProjetIds: number[] = [];
    let hasMappedValue = false;

    Object.entries(rawRow).forEach(([header, rawValue]) => {
      const normalizedHeader = normalizeToken(header);

      // Handle "typeprojet" / "typedeprojet" column in legacy format
      if (['typeprojet', 'typedeprojet', 'projet', 'typeprojectid'].includes(normalizedHeader)) {
        const value = toOptionalString(rawValue);
        if (!value) return;
        hasMappedValue = true;
        const id = resolveTypeProjetId(value, typesProjet);
        if (id !== undefined) draftTypeProjetIds.push(id);
        return;
      }

      const field = resolveField(header);
      if (!field) return;

      const value = toOptionalString(rawValue);
      if (!value) return;
      hasMappedValue = true;

      if (field === 'source') {
        const source = normalizeLeadSource(value);
        if (source) draft.source = source;
        return;
      }

      draft[field] = value as never;
    });

    if (!hasMappedValue) {
      skippedRows += 1;
      return;
    }

    if (!draft.nom) {
      invalidRows.push({ rowNumber, reason: 'Nom manquant.' });
      return;
    }

    if (draft.email && !EMAIL_PATTERN.test(draft.email)) {
      invalidRows.push({ rowNumber, reason: 'Email invalide.' });
      return;
    }

    rows.push({
      rowNumber,
      payload: {
        nom: draft.nom,
        prenom: draft.prenom,
        email: draft.email,
        telephone: draft.telephone,
        adresseClient: draft.adresseClient,
        adresseChantier: draft.adresseChantier,
        source: draft.source,
        besoin: draft.besoin,
        notes: draft.notes,
        typeProjetIds: draftTypeProjetIds.length > 0 ? draftTypeProjetIds : undefined,
      },
    });
  });

  return { rows, skippedRows, invalidRows };
}

export function getImportErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data
  ) {
    const apiMessage = error.response.data.message;
    if (Array.isArray(apiMessage)) return apiMessage.join(', ');
    if (typeof apiMessage === 'string') return apiMessage;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
