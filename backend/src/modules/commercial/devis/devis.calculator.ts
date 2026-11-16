import {
  computeTotals,
  DecimalLike,
  lineTotal,
  marginPercent,
  Money,
  sumMoney,
  toDecimal,
} from '../../../common';

/**
 * Pure quote arithmetic (exact Decimal). Replaces the old float maths
 * (`dto.quantite * prixUnitaireVente` stored unrounded, then summed).
 *
 * A line stores UNIT prices: sale price, material cost, labour cost.
 */
export interface LineInput {
  quantite: DecimalLike;
  prixUnitaireVente: DecimalLike;
  prixAchat: DecimalLike;
  mainOeuvre: DecimalLike;
}

export function computeLine(line: LineInput): { totalHT: Money; coutTotal: Money } {
  return {
    totalHT: lineTotal(line.prixUnitaireVente, line.quantite),
    coutTotal: lineTotal(toDecimal(line.prixAchat).plus(line.mainOeuvre), line.quantite),
  };
}

export interface DevisTotals {
  totalHT: Money;
  totalTVA: Money;
  totalTTC: Money;
  coutTotal: Money;
  profit: Money;
  margePourcent: Money;
}

/** Totals from the already-rounded line totals. */
export function computeDevisTotals(
  lines: { totalHT: DecimalLike; coutTotal: DecimalLike }[],
  tauxTVA: DecimalLike,
): DevisTotals {
  const totals = computeTotals(sumMoney(lines.map((l) => l.totalHT)), tauxTVA);
  const coutTotal = sumMoney(lines.map((l) => l.coutTotal));
  return {
    ...totals,
    coutTotal,
    profit: totals.totalHT.minus(coutTotal),
    margePourcent: marginPercent(totals.totalHT, coutTotal),
  };
}

/** Margin alert (spec: "alerte marge < 15 %") — never on an empty quote. */
export function isMarginAlert(
  totals: Pick<DevisTotals, 'totalHT' | 'margePourcent'>,
  seuil: DecimalLike,
): boolean {
  return totals.totalHT.gt(0) && totals.margePourcent.lt(seuil);
}
