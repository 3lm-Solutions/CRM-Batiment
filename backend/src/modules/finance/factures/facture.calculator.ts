import {
  BusinessException,
  computeTotals,
  DecimalLike,
  lineTotal,
  Money,
  percentOf,
  sumMoney,
  toDecimal,
  ZERO,
} from '../../../common';

const max = (a: Money, b: Money): Money => (a.gt(b) ? a : b);
const min = (a: Money, b: Money): Money => (a.lt(b) ? a : b);

/**
 * Pure invoice arithmetic.
 *
 *  - ACOMPTE   = quote HT × deposit %
 *  - SITUATION = (quote HT × cumulative progress − what previous progress invoices covered)
 *                − the share of the deposit repaid for this progress (see `situationAmounts`)
 *  - FINALE    = quote HT − deposits − progress invoices already issued
 *
 * v2 fix: the old final invoice did NOT deduct the deposit — with a 35 % deposit the client
 * was billed 135 % of the quote.
 */

export function acompteHT(devisHT: DecimalLike, percent: DecimalLike): Money {
  return percentOf(devisHT, percent);
}

export interface SituationAmounts {
  /** Work billed by this progress invoice, before the deposit repayment */
  brutHT: Money;
  /** Share of the deposit repaid on this invoice (≥ 0), shown as a negative line */
  remboursementAcompteHT: Money;
  /** What the client pays (HT): brut − repayment */
  netHT: Money;
}

/**
 * Progress invoice at `avancementCumule` %, the previous one being at `avancementPrecedent` %.
 *
 * 2026-10-19 fix: progress invoices ignored the deposit. With a 35 % deposit and a progress invoice
 * at 70 %, 105 % of the quote was billed and the final invoice was refused. The deposit is now
 * repaid in proportion to progress: at 100 % it is fully repaid, so
 * deposit + progress invoices + final = exactly the quote.
 *
 * What was already repaid is read from the invoices themselves (work covered − amounts billed), so a
 * progress invoice created before this fix (no repayment) is caught up on the next one.
 */
export function situationAmounts(p: {
  devisHT: DecimalLike;
  acomptesHT: DecimalLike[];
  avancementPrecedent: DecimalLike;
  avancementCumule: DecimalLike;
  situationsDejaHT: DecimalLike[];
}): SituationAmounts {
  const travauxCumules = percentOf(p.devisHT, p.avancementCumule);
  const travauxDejaCouverts = percentOf(p.devisHT, p.avancementPrecedent);
  const brutHT = travauxCumules.minus(travauxDejaCouverts);
  if (brutHT.lte(0)) {
    throw new BusinessException('SITUATION_NULLE', 'Cet avancement est déjà facturé : rien à facturer.');
  }

  const acompte = sumMoney(p.acomptesHT);
  const dejaRembourse = max(ZERO, travauxDejaCouverts.minus(sumMoney(p.situationsDejaHT)));
  const resteARembourser = max(ZERO, acompte.minus(dejaRembourse));
  const cible = percentOf(acompte, p.avancementCumule).minus(dejaRembourse);
  const remboursementAcompteHT = min(resteARembourser, max(ZERO, cible));

  const netHT = brutHT.minus(remboursementAcompteHT);
  if (netHT.lte(0)) {
    throw new BusinessException('SITUATION_COUVERTE', 'Cet avancement est entièrement couvert par l’acompte : rien à facturer.');
  }
  return { brutHT, remboursementAcompteHT, netHT };
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
