import { Role } from '../../generated/prisma/client';
import type { AuthUser } from './auth-user.interface';

/**
 * Purchase costs, labour costs and sale prices of the catalogue / stock.
 * A chef de chantier works with quantities only: he never sees an amount
 * (same rule as the quotes: decision D of 20/10).
 */
const COST_KEYS = new Set([
  'prixAchatFixe',
  'prixUnitaire',
  'coutJournalier',
  'prixVenteMin',
  'prixVenteMax',
  'impactPrix',
  'valeurStock',
]);

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Amounts of supplier orders and sous-traitant contracts / payments (B2 of 20/10): the chef
 * receives deliveries and rates sous-traitants, he never sees what they cost.
 * `paiements` goes as a whole: a payment list without amounts means nothing.
 */
const AMOUNT_KEYS = new Set([
  ...COST_KEYS,
  'totalHT',
  'totalTTC',
  'montantHT',
  'montantTTC',
  'montantTVA',
  'paiements',
]);

function strip<T>(data: T, keys: Set<string>): T {
  if (Array.isArray(data)) return data.map((item) => strip(item, keys)) as T;
  if (!isPlain(data)) return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!keys.has(key)) out[key] = strip(value, keys);
  }
  return out as T;
}

/** Deep copy without the cost keys (plain objects and arrays only; Decimal, Date… are kept as is). */
export function stripCosts<T>(data: T): T {
  return strip(data, COST_KEYS);
}

/** Deep copy without any amount (orders, contracts, payments). */
export function stripAmounts<T>(data: T): T {
  return strip(data, AMOUNT_KEYS);
}

export const seesCosts = (user: Pick<AuthUser, 'role'>) => user.role !== Role.CHEF_CHANTIER;

/** Returns the data untouched for the office, without any catalogue / stock price for a chef de chantier. */
export async function costsFor<T>(user: Pick<AuthUser, 'role'>, data: T | Promise<T>): Promise<T> {
  const value = await data;
  return seesCosts(user) ? value : stripCosts(value);
}

/** Same for supplier orders and sous-traitants: no amount at all for a chef de chantier. */
export async function amountsFor<T>(
  user: Pick<AuthUser, 'role'>,
  data: T | Promise<T>,
): Promise<T> {
  const value = await data;
  return seesCosts(user) ? value : stripAmounts(value);
}
