/**
 * SEPA payment QR code (EPC069-12, « GiroCode »), 21/10: scanned with a banking app, it pre-fills a
 * transfer — beneficiary, IBAN, amount and reference. Version 002: the BIC may be empty.
 */
export interface EpcInput {
  beneficiaire: string;
  iban: string;
  bic?: string | null;
  montant: number;
  /** Free text on the transfer (invoice reference, communication) — 140 characters max */
  libelle: string;
}

const clean = (s: string, max: number) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max);

/** null when a payment QR code cannot be made (no IBAN, amount out of range). */
export function epcPayload(p: EpcInput): string | null {
  const iban = p.iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  if (!(p.montant > 0) || p.montant > 999_999_999.99) return null;
  const lines = [
    'BCD',
    '002',
    '1', // UTF-8
    'SCT',
    clean(p.bic ?? '', 11).toUpperCase(),
    clean(p.beneficiaire, 70),
    iban,
    `EUR${p.montant.toFixed(2)}`,
    '', // purpose
    '', // structured reference (none: free text below)
    clean(p.libelle, 140),
  ];
  const payload = lines.join('\n');
  // The standard caps the payload at 331 bytes
  return new TextEncoder().encode(payload).length <= 331 ? payload : null;
}

/** « FR7630006000011234567890189 » → « FR76 3000 6000 0112 3456 7890 189 » */
export const formatIban = (iban: string) => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
