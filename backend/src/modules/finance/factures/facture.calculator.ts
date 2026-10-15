import {
  BusinessException,
  computeTotals,
  DecimalLike,
  lineTotal,
  Money,
  percentOf,
  sumMoney,
  toDecimal,
} from '../../../common';

/**
 * Pure invoice arithmetic.
 *
 *  - ACOMPTE   = quote HT × deposit %
 *  - SITUATION = quote HT × cumulative progress % − progress invoices already issued
 *  - FINALE    = quote HT − deposits − progress invoices already issued
 *
 * v2 fix: the old final invoice did NOT deduct the deposit — with a 35 % deposit the client
 * was billed 135 % of the quote.
 */

export function acompteHT(devisHT: DecimalLike, percent: DecimalLike): Money {
  return percentOf(devisHT, percent);
}

export function situationHT(devisHT: DecimalLike, avancementCumule: DecimalLike, situationsDejaHT: DecimalLike[]): Money {
  const amount = percentOf(devisHT, avancementCumule).minus(sumMoney(situationsDejaHT));
  if (amount.lte(0)) {
    throw new BusinessException('SITUATION_NULLE', 'Cet avancement est déjà facturé : rien à facturer.');
  }
  return amount;
}

export function finaleHT(devisHT: DecimalLike, deductionsHT: DecimalLike[]): Money {
  const amount = toDecimal(devisHT).minus(sumMoney(deductionsHT));
  if (amount.lt(0)) {
    throw new BusinessException('FACTURE_NEGATIVE', 'Les acomptes et situations dépassent le montant du devis.');
  }
  return amount;
}

export interface InvoiceLine {
  description: string;
  quantite: Money;
  unite: string;
  prixUnitaireHT: Money;
  tauxTVA: Money;
  montantHT: Money;
  montantTVA: Money;
  montantTTC: Money;
}

export function buildLine(p: {
  description: string;
  quantite: DecimalLike;
  unite?: string;
  prixUnitaireHT: DecimalLike;
  tauxTVA: DecimalLike;
}): InvoiceLine {
  const montantHT = lineTotal(p.prixUnitaireHT, p.quantite);
  const montantTVA = percentOf(montantHT, p.tauxTVA);
  return {
    description: p.description,
    quantite: toDecimal(p.quantite),
    unite: p.unite ?? 'UNITE',
    prixUnitaireHT: toDecimal(p.prixUnitaireHT),
    tauxTVA: toDecimal(p.tauxTVA),
    montantHT,
    montantTVA,
    montantTTC: montantHT.plus(montantTVA),
  };
}

/** Invoice totals: VAT on the HT total (same rule as quotes, so a full invoice matches its quote). */
export function invoiceTotals(lines: { montantHT: DecimalLike }[], tauxTVA: DecimalLike) {
  const t = computeTotals(sumMoney(lines.map((l) => l.montantHT)), tauxTVA);
  return { montantHT: t.totalHT, montantTVA: t.totalTVA, montantTTC: t.totalTTC };
}

/** Credit note line = the original line with a negative quantity. */
export function negate(line: InvoiceLine): InvoiceLine {
  return buildLine({ ...line, quantite: line.quantite.negated() });
}
