/**
 * Pure catalogue health check (ported from the old validateCatalogue, plus one new rule).
 * Errors make a quote built from the catalogue unreliable; warnings are worth a look.
 */
export interface ValidationPrestation {
  id: number;
  nom: string;
  prixVenteMin: number;
  prixVenteMax: number;
  compositions: {
    materiauId: number | null;
    serviceMainOeuvreId: number | null;
    quantiteParUnite: number;
  }[];
  options: {
    id: number;
    nom: string;
    obligatoire: boolean;
    choix: { id: number; aComposition: boolean }[];
  }[];
}

export interface CatalogueIssue {
  type: string;
  message: string;
  prestationId?: number;
  optionId?: number;
}

export function validateCatalogue(activeCategories: number, prestations: ValidationPrestation[]) {
  const errors: CatalogueIssue[] = [];
  const warnings: CatalogueIssue[] = [];
  const err = (i: CatalogueIssue) => errors.push(i);
  const warn = (i: CatalogueIssue) => warnings.push(i);

  if (activeCategories === 0)
    err({ type: 'CATEGORIES_VIDES', message: 'Aucune catégorie active.' });
  if (prestations.length === 0)
    err({ type: 'PRESTATIONS_VIDES', message: 'Aucune prestation active.' });

  for (const p of prestations) {
    const ref = `« ${p.nom} » (#${p.id})`;
    if (p.prixVenteMin < 0 || p.prixVenteMax < 0) {
      err({ type: 'PRIX_NEGATIF', prestationId: p.id, message: `${ref} a un prix négatif.` });
    }
    if (p.prixVenteMin > p.prixVenteMax) {
      err({
        type: 'FOURCHETTE_INVALIDE',
        prestationId: p.id,
        message: `${ref} : prix minimum > prix maximum.`,
      });
    }

    const choiceCompositionOptions = p.options.filter((o) => o.choix.some((c) => c.aComposition));
    if (p.compositions.length === 0 && choiceCompositionOptions.length === 0) {
      warn({
        type: 'SANS_COMPOSITION',
        prestationId: p.id,
        message: `${ref} n'a aucune composition : coût et marge inconnus.`,
      });
    }
    for (const c of p.compositions) {
      if (!c.materiauId && !c.serviceMainOeuvreId) {
        err({
          type: 'COMPOSANT_MANQUANT',
          prestationId: p.id,
          message: `${ref} : ligne sans matériau ni service.`,
        });
      }
      if (c.quantiteParUnite <= 0) {
        err({
          type: 'QUANTITE_INVALIDE',
          prestationId: p.id,
          message: `${ref} : quantité ≤ 0 dans la composition.`,
        });
      }
    }

    // New in v2: two options whose choices carry compositions would conflict when pricing
    if (choiceCompositionOptions.length > 1) {
      err({
        type: 'COMPOSITIONS_CONCURRENTES',
        prestationId: p.id,
        message: `${ref} : plusieurs options ont des choix avec composition (${choiceCompositionOptions.map((o) => o.nom).join(', ')}).`,
      });
    }

    for (const o of p.options) {
      if (o.choix.length === 0) {
        (o.obligatoire ? err : warn)({
          type: o.obligatoire ? 'OPTION_OBLIGATOIRE_SANS_CHOIX' : 'OPTION_SANS_CHOIX',
          prestationId: p.id,
          optionId: o.id,
          message: `${ref} : l'option « ${o.nom} » n'a aucun choix actif.`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    stats: {
      categoriesActives: activeCategories,
      prestationsActives: prestations.length,
      erreurs: errors.length,
      avertissements: warnings.length,
    },
    errors,
    warnings,
  };
}
