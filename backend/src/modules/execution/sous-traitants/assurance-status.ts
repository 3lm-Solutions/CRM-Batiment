import type { AssuranceStatut } from '../../../generated/prisma/client';

export const RENEWAL_WARNING_DAYS = 30;

/**
 * An insurance status is DERIVED from its expiry date — never typed by hand.
 * v2 fix: the old daily job skipped insurances already marked A_RENOUVELER, so an insurance
 * that then expired stayed "à renouveler" forever; renewing one never reset it to VALIDE.
 */
export function assuranceStatut(dateExpiration: Date, now: Date = new Date()): AssuranceStatut {
  if (dateExpiration <= now) return 'EXPIREE';
  if (dateExpiration.getTime() - now.getTime() <= RENEWAL_WARNING_DAYS * 86_400_000)
    return 'A_RENOUVELER';
  return 'VALIDE';
}

/** Mean of the three marks, two decimals. */
export function noteGlobale(qualite: number, delai: number, communication: number): number {
  return Math.round(((qualite + delai + communication) / 3) * 100) / 100;
}
