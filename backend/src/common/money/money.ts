import { Prisma } from '../../generated/prisma/client';

/**
 * Money helpers. ALL amount calculations go through here — never `a * b` on JS numbers.
 *
 * Rules (same as the old devis.service round2, but exact):
 *  - every intermediate line total is rounded to the cent, half-up
 *  - document totals = sum of rounded line totals
 *  - VAT is computed on the document HT total
 */
const { Decimal } = Prisma;
export type Money = Prisma.Decimal;
export type DecimalLike = Prisma.Decimal | number | string;

export const toDecimal = (value: DecimalLike): Money => new Decimal(value);

export const ZERO: Money = new Decimal(0);

export function roundMoney(value: DecimalLike): Money {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** unit price × quantity, rounded to the cent. */
export function lineTotal(unitPrice: DecimalLike, quantity: DecimalLike): Money {
  return roundMoney(toDecimal(unitPrice).times(quantity));
}

export function sumMoney(values: readonly DecimalLike[]): Money {
  return roundMoney(values.reduce<Money>((acc, v) => acc.plus(v), ZERO));
}

/** `rate` percent of `amount` (e.g. 30% acompte, 20% TVA), rounded to the cent. */
export function percentOf(amount: DecimalLike, rate: DecimalLike): Money {
  return roundMoney(toDecimal(amount).times(rate).div(100));
}

export interface Totals {
  totalHT: Money;
  totalTVA: Money;
  totalTTC: Money;
}

export function computeTotals(totalHT: DecimalLike, tauxTVA: DecimalLike): Totals {
  const ht = roundMoney(totalHT);
  const tva = percentOf(ht, tauxTVA);
  return { totalHT: ht, totalTVA: tva, totalTTC: ht.plus(tva) };
}

/**
 * Margin as a percentage of the SALE price ("taux de marque"), same formula as the old
 * project: (sale − cost) / sale × 100. Returns 0 when there is no sale amount.
 */
export function marginPercent(saleHT: DecimalLike, cost: DecimalLike): Money {
  const sale = toDecimal(saleHT);
  if (sale.lte(0)) return ZERO;
  return sale.minus(cost).div(sale).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Rounds to the nearest multiple of `step` (0.01, 0.5, 1, 5…), half-up. */
export function roundToStep(value: DecimalLike, step: DecimalLike): Money {
  const s = toDecimal(step);
  if (s.lte(0)) return roundMoney(value);
  return roundMoney(toDecimal(value).div(s).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(s));
}
