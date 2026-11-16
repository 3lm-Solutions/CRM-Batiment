import { type DecimalLike, sumMoney } from '../../../common';

export interface ChantierMarginInput {
  id: number;
  reference: string;
  statut: string;
  client: { nom: string; prenom: string | null };
  /** Signed quotes of the job site (usually one) */
  devis: { totalHT: DecimalLike; profit: DecimalLike }[];
}

export interface ChantierMargin {
  id: number;
  reference: string;
  statut: string;
  client: { nom: string; prenom: string | null };
  totalHT: number;
  profit: number;
  /** null when the job site has no amount (0 € HT) */
  margePourcent: number | null;
  alerte: boolean;
}

/**
 * Planned margin per job site (C9 of 20/10, spec « Marge moyenne par devis/chantier »):
 * profit ÷ HT total of its SIGNED quotes. Worst margins first, so the dashboard shows what
 * needs attention. The average is weighted by amount (a 300 € job site doesn't weigh like a 30 k€ one).
 */
export function chantierMargins(rows: ChantierMarginInput[], seuil: number, limit = 8) {
  const all: ChantierMargin[] = rows.map((c) => {
    const totalHT = sumMoney(c.devis.map((d) => d.totalHT));
    const profit = sumMoney(c.devis.map((d) => d.profit));
    const marge = totalHT.isZero()
      ? null
      : profit.div(totalHT).times(100).toDecimalPlaces(1).toNumber();
    return {
      id: c.id,
      reference: c.reference,
      statut: c.statut,
      client: c.client,
      totalHT: totalHT.toNumber(),
      profit: profit.toNumber(),
      margePourcent: marge,
      alerte: marge !== null && marge < seuil,
    };
  });
  const totalHT = sumMoney(all.map((c) => c.totalHT));
  const profit = sumMoney(all.map((c) => c.profit));
  const sorted = [...all].sort(
    (a, b) => (a.margePourcent ?? Infinity) - (b.margePourcent ?? Infinity),
  );
  return {
    seuil,
    nombre: all.length,
    sousSeuil: all.filter((c) => c.alerte).length,
    margeMoyennePonderee: totalHT.isZero()
      ? null
      : profit.div(totalHT).times(100).toDecimalPlaces(1).toNumber(),
    liste: sorted.slice(0, limit),
  };
}
