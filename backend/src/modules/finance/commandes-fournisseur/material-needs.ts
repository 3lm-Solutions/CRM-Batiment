import { DecimalLike, lineTotal, Money, toDecimal } from '../../../common';
import { Prisma } from '../../../generated/prisma/client';

/**
 * Pure P0.4 logic: which materials a quote needs, grouped by supplier.
 *
 * Same composition rule as pricing: a selected choice that has its own composition REPLACES
 * the prestation's base composition. Choices come from LigneDevis.optionsChoisies (IDs) —
 * the old code re-parsed them from the line description text with split().
 * Materials without a supplier are RETURNED (the old code skipped them silently).
 */
export interface NeedLine {
  quantite: DecimalLike;
  prestationId: number | null;
  materiauId: number | null;
  choixIds: number[];
}

export interface CatalogueForNeeds {
  prestations: Map<number, { base: Composition[]; parChoix: Map<number, Composition[]> }>;
  materiaux: Map<number, { nom: string; unite: string; prixAchatFixe: DecimalLike; fournisseurId: number | null }>;
}

interface Composition {
  materiauId: number | null;
  quantiteParUnite: DecimalLike;
}

export interface OrderLine {
  materiauId: number;
  materiauNom: string;
  unite: string;
  quantite: Money;
  prixUnitaire: Money;
  totalHT: Money;
}

export function computeMaterialNeeds(lines: NeedLine[], catalogue: CatalogueForNeeds) {
  const totals = new Map<number, Prisma.Decimal>();
  const add = (materiauId: number, q: Prisma.Decimal) =>
    totals.set(materiauId, (totals.get(materiauId) ?? toDecimal(0)).plus(q));

  for (const line of lines) {
    const quantite = toDecimal(line.quantite);
    if (line.prestationId) {
      const prestation = catalogue.prestations.get(line.prestationId);
      if (!prestation) continue;
      const override = line.choixIds.map((id) => prestation.parChoix.get(id)).find((c) => c && c.length > 0);
      for (const comp of override ?? prestation.base) {
        if (comp.materiauId) add(comp.materiauId, quantite.times(comp.quantiteParUnite));
      }
    } else if (line.materiauId) {
      add(line.materiauId, quantite);
    }
  }

  const parFournisseur = new Map<number, OrderLine[]>();
  const sansFournisseur: { materiauId: number; nom: string }[] = [];

  for (const [materiauId, rawQty] of totals) {
    const m = catalogue.materiaux.get(materiauId);
    if (!m) continue;
    const quantite = rawQty.toDecimalPlaces(3, Prisma.Decimal.ROUND_UP); // never order less than needed
    if (!m.fournisseurId) {
      sansFournisseur.push({ materiauId, nom: m.nom });
      continue;
    }
    const lines = parFournisseur.get(m.fournisseurId) ?? [];
    lines.push({
      materiauId,
      materiauNom: m.nom,
      unite: m.unite,
      quantite,
      prixUnitaire: toDecimal(m.prixAchatFixe),
      totalHT: lineTotal(m.prixAchatFixe, quantite),
    });
    parFournisseur.set(m.fournisseurId, lines);
  }

  return { parFournisseur, sansFournisseur };
}
