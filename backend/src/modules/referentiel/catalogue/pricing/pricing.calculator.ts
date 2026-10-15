import {
  BusinessException,
  DecimalLike,
  lineTotal,
  marginPercent,
  Money,
  roundMoney,
  roundToStep,
  sumMoney,
  toDecimal,
  ZERO,
} from '../../../../common';

/**
 * Pure pricing logic for one catalogue prestation — no database, fully unit-tested.
 *
 * Rules (confirmed from the old quote code and the catalogue data):
 *  1. A selected choice that has its own compositions REPLACES the prestation's base
 *     composition (e.g. "Chape fibrée" lists all its materials + labour).
 *     At most one selected choice may carry compositions.
 *  2. Each choice's `impactPrix` is added to the unit SALE price.
 *  3. Suggested unit price = middle of [prixVenteMin, prixVenteMax] + impacts, rounded to the
 *     company price step. The cost-based "target margin" price is returned alongside.
 *
 * v2 fixes vs the old `chiffrage` endpoint: choices were ignored entirely (same cost for every
 * option), all maths used JS floats, and the margin settings were stored but never applied.
 */

export type ComponentKind = 'MATERIAU' | 'MAIN_OEUVRE';

export interface PricingComponent {
  kind: ComponentKind;
  id: number;
  nom: string;
  unite: string;
  /** Purchase price for a material, unit labour price for a labour service */
  prixUnitaire: DecimalLike;
  quantiteParUnite: DecimalLike;
}

export interface PricingChoice {
  id: number;
  nom: string;
  impactPrix: DecimalLike;
  components: PricingComponent[];
}

export interface PricingInput {
  quantite: DecimalLike;
  prixVenteMin: DecimalLike;
  prixVenteMax: DecimalLike;
  baseComponents: PricingComponent[];
  selectedChoices: PricingChoice[];
  settings: {
    margeCiblePourcent: DecimalLike;
    seuilAlerteMargePourcent: DecimalLike;
    pasArrondiPrix: DecimalLike;
  };
}

export interface PricingLine {
  kind: ComponentKind;
  id: number;
  nom: string;
  unite: string;
  quantiteNecessaire: Money;
  prixUnitaire: Money;
  coutTotal: Money;
}

export interface PricingResult {
  quantite: Money;
  compositionSource: 'BASE' | 'CHOIX';
  /** Name of the choice whose composition was used, when compositionSource = CHOIX */
  compositionChoix: string | null;
  lignes: PricingLine[];
  coutMateriaux: Money;
  coutMainOeuvre: Money;
  coutTotal: Money;
  coutParUnite: Money;
  impactOptionsParUnite: Money;
  prixVenteSuggereUnite: Money;
  prixCibleMargeUnite: Money;
  totalVenteHT: Money;
  profit: Money;
  margePourcent: Money;
  alerteMarge: boolean;
  avertissements: string[];
}

export function computePricing(input: PricingInput): PricingResult {
  const quantite = toDecimal(input.quantite);
  if (quantite.lte(0)) {
    throw new BusinessException('QUANTITE_INVALIDE', 'La quantité doit être supérieure à 0.');
  }

  const overriding = input.selectedChoices.filter((c) => c.components.length > 0);
  if (overriding.length > 1) {
    throw new BusinessException(
      'COMPOSITIONS_MULTIPLES',
      `Plusieurs choix définissent leur propre composition (${overriding.map((c) => c.nom).join(', ')}) : un seul est autorisé.`,
    );
  }
  const source = overriding[0];
  const components = source ? source.components : input.baseComponents;

  const lignes: PricingLine[] = components.map((c) => {
    const qte = quantite.times(c.quantiteParUnite);
    return {
      kind: c.kind,
      id: c.id,
      nom: c.nom,
      unite: c.unite,
      quantiteNecessaire: qte.toDecimalPlaces(3),
      prixUnitaire: roundMoney(c.prixUnitaire),
      coutTotal: lineTotal(c.prixUnitaire, qte),
    };
  });

  const coutMateriaux = sumMoney(lignes.filter((l) => l.kind === 'MATERIAU').map((l) => l.coutTotal));
  const coutMainOeuvre = sumMoney(lignes.filter((l) => l.kind === 'MAIN_OEUVRE').map((l) => l.coutTotal));
  const coutTotal = coutMateriaux.plus(coutMainOeuvre);
  const coutParUnite = roundMoney(coutTotal.div(quantite));

  const impactOptionsParUnite = sumMoney(input.selectedChoices.map((c) => c.impactPrix));
  const milieuFourchette = toDecimal(input.prixVenteMin).plus(input.prixVenteMax).div(2);
  const prixVenteSuggereUnite = roundToStep(
    milieuFourchette.plus(impactOptionsParUnite),
    input.settings.pasArrondiPrix,
  );

  // Price that would reach the target margin on cost: cost / (1 − margin)
  const marge = toDecimal(input.settings.margeCiblePourcent).div(100);
  const prixCibleMargeUnite = marge.lt(1)
    ? roundToStep(coutParUnite.div(toDecimal(1).minus(marge)), input.settings.pasArrondiPrix)
    : ZERO;

  const totalVenteHT = lineTotal(prixVenteSuggereUnite, quantite);
  const profit = totalVenteHT.minus(coutTotal);
  const margePourcent = marginPercent(totalVenteHT, coutTotal);

  const avertissements: string[] = [];
  if (components.length === 0) {
    avertissements.push('Prestation sans composition : coût inconnu, la marge affichée n’est pas fiable.');
  }
  if (toDecimal(input.prixVenteMin).gt(input.prixVenteMax)) {
    avertissements.push('Fourchette de prix incohérente (minimum > maximum).');
  }

  return {
    quantite,
    compositionSource: source ? 'CHOIX' : 'BASE',
    compositionChoix: source?.nom ?? null,
    lignes,
    coutMateriaux,
    coutMainOeuvre,
    coutTotal,
    coutParUnite,
    impactOptionsParUnite,
    prixVenteSuggereUnite,
    prixCibleMargeUnite,
    totalVenteHT,
    profit,
    margePourcent,
    alerteMarge: components.length > 0 && margePourcent.lt(input.settings.seuilAlerteMargePourcent),
    avertissements,
  };
}
