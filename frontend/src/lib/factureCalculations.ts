export interface EditableFactureLine {
  localId: string;
  id?: number;
  description: string;
  datePrestation?: string;
  quantite: number;
  unite: string;
  prixUnitaireHT: number;
  tauxTVA: number;
}

export interface ComputedFactureLine extends EditableFactureLine {
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
}

export interface ComputedFactureTotals {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  acomptePercent?: number;
  acompteMontant?: number;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function computeFactureLine(line: EditableFactureLine): ComputedFactureLine {
  const quantite = Math.max(0, safeNumber(line.quantite));
  const prixUnitaireHT = Math.max(0, safeNumber(line.prixUnitaireHT));
  const tauxTVA = Math.max(0, safeNumber(line.tauxTVA));

  const montantHT = round2(quantite * prixUnitaireHT);
  const montantTVA = round2((montantHT * tauxTVA) / 100);
  const montantTTC = round2(montantHT + montantTVA);

  return {
    ...line,
    quantite,
    prixUnitaireHT,
    tauxTVA,
    montantHT,
    montantTVA,
    montantTTC,
  };
}

export function computeFactureTotals(
  lines: EditableFactureLine[],
  typeFacture: 'ACOMPTE' | 'FINALE',
  acomptePercent?: number,
  acompteMontant?: number,
): ComputedFactureTotals {
  const computedLines = lines.map(computeFactureLine);
  const baseHT = round2(computedLines.reduce((sum, line) => sum + line.montantHT, 0));
  const baseTVA = round2(computedLines.reduce((sum, line) => sum + line.montantTVA, 0));
  const baseTTC = round2(computedLines.reduce((sum, line) => sum + line.montantTTC, 0));

  if (typeFacture === 'FINALE') {
    return {
      totalHT: baseHT,
      totalTVA: baseTVA,
      totalTTC: baseTTC,
    };
  }

  const percent = safeNumber(acomptePercent, 0);
  const amount = safeNumber(acompteMontant, 0);

  let ratio = 1;
  let resolvedPercent = 100;

  if (percent > 0) {
    resolvedPercent = Math.min(100, percent);
    ratio = resolvedPercent / 100;
  } else if (amount > 0 && baseTTC > 0) {
    ratio = Math.min(1, amount / baseTTC);
    resolvedPercent = round2(ratio * 100);
  }

  return {
    totalHT: round2(baseHT * ratio),
    totalTVA: round2(baseTVA * ratio),
    totalTTC: round2(baseTTC * ratio),
    acomptePercent: resolvedPercent,
    acompteMontant: round2(baseTTC * ratio),
  };
}
