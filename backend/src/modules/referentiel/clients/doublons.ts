/**
 * 16/11 (mobile lot 1) — same client already in the base?
 * Phone numbers are compared on their last 9 digits (06 12 34 56 78 = +33 6 12 34 56 78),
 * emails without case.
 */
export function cleTelephone(telephone: string | null | undefined): string | null {
  const chiffres = (telephone ?? '').replace(/\D/g, '');
  return chiffres.length >= 8 ? chiffres.slice(-9) : null;
}

export function cleEmail(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase();
  return e.includes('@') ? e : null;
}

export type Correspondance = 'TELEPHONE' | 'EMAIL';
