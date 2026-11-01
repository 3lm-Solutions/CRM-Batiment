import {
  PrestationOccurrence,
  QuoteCalculation,
  CalculatedPrestation,
  FlatQuoteLine,
  StatutMarque,
} from '../types/quote';

/**
 * Calcule tous les sous-totaux, marges, taux de marque et statuts d'envoi.
 * @param prestations Liste des occurrences de prestations en cours
 * @param tauxMarge Taux de marge saisi en % (ex: 28%)
 * @param tauxTVA Taux de TVA en % (défaut 10%)
 */
export function calculateQuote(
  prestations: PrestationOccurrence[],
  tauxMarge: number,
  tauxTVA: number = 10
): QuoteCalculation {
  const margeMultiplier = 1 + tauxMarge / 100;

  let totalCoutHT = 0;
  let totalVenteHT = 0;
  let quantitesManquantesCount = 0;

  const prestationsCalculees: CalculatedPrestation[] = prestations.map((occ) => {
    const hasQuantiteManquante = occ.quantiteOuvrage === null || occ.quantiteOuvrage <= 0;
    if (hasQuantiteManquante) {
      quantitesManquantesCount++;
    }

    // Rassembler les composants de base + ceux des options activées
    const composantsActifs = [...occ.composants];
    if (occ.options && occ.options.length > 0) {
      for (const opt of occ.options) {
        if (opt.active && opt.composants) {
          composantsActifs.push(...opt.composants);
        }
      }
    }

    // Coût unitaire d'achat par unité d'ouvrage
    let coutUnitaireHT = 0;
    if (composantsActifs.length === 0) {
      coutUnitaireHT = occ.coutUnitaireManuel ?? 0;
    } else {
      for (const comp of composantsActifs) {
        coutUnitaireHT += comp.quantiteParUnite * comp.prixUnitaireAchat;
      }
    }

    // Prix de vente unitaire d'ouvrage HT avec marge appliquée
    const prixVenteUnitaireHT = coutUnitaireHT * margeMultiplier;

    // Si la quantité d'ouvrage est manquante, sous-totaux à 0 (grisés)
    const quantite = hasQuantiteManquante ? 0 : (occ.quantiteOuvrage || 0);
    const sousTotalCoutHT = quantite * coutUnitaireHT;
    const sousTotalVenteHT = quantite * prixVenteUnitaireHT;

    // Analyse de la fourchette catalogue : bornes d'UNE unité × quantité d'ouvrage
    let isHorsFourchette = false;
    let ecartFourchette = 0;
    let typeEcart: 'SOUS_EVALUATION' | 'SUR_EVALUATION' | 'CONFORME' = 'CONFORME';
    const borneMinOuvrage = occ.prixVenteMin * quantite;
    const borneMaxOuvrage = occ.prixVenteMax * quantite;

    if (!hasQuantiteManquante && sousTotalVenteHT > 0) {
      if (sousTotalVenteHT < borneMinOuvrage) {
        isHorsFourchette = true;
        ecartFourchette = borneMinOuvrage - sousTotalVenteHT;
        typeEcart = 'SOUS_EVALUATION';
      } else if (sousTotalVenteHT > borneMaxOuvrage) {
        isHorsFourchette = true;
        ecartFourchette = sousTotalVenteHT - borneMaxOuvrage;
        typeEcart = 'SUR_EVALUATION';
      }
    }

    totalCoutHT += sousTotalCoutHT;
    totalVenteHT += sousTotalVenteHT;

    return {
      occurrence: occ,
      prixVenteUnitaireHT,
      coutUnitaireHT,
      sousTotalVenteHT,
      sousTotalCoutHT,
      isHorsFourchette,
      ecartFourchette,
      typeEcart,
      hasQuantiteManquante,
    };
  });

  const margeBrute = totalVenteHT - totalCoutHT;

  // Calcul du taux de marque (Marge brute / Chiffre d'affaires HT)
  // Distinction majeure avec le taux de marge (Marge / Coût d'achat)
  const tauxMarqueCalcule = totalVenteHT > 0 ? (margeBrute / totalVenteHT) * 100 : 0;

  // Détermination du statut de marge :
  // Conforme CDC : vert si [15%, 40%], rouge si en dehors avec message précis
  let statutMarque: StatutMarque = 'VALIDE';
  if (totalVenteHT > 0) {
    if (tauxMarqueCalcule < 15) {
      statutMarque = 'MARGE_INSUFFISANTE';
    } else if (tauxMarqueCalcule > 40) {
      statutMarque = 'MARGE_EXCESSIVE';
    }
  }

  const montantTVA = totalVenteHT * (tauxTVA / 100);
  const totalTTC = totalVenteHT + montantTVA;

  // Évaluation de la fonction d'autorisation d'envoi : peut_envoyer_devis()
  const motifsRefusEnvoi: string[] = [];

  if (prestations.length === 0) {
    motifsRefusEnvoi.push('Aucune prestation détectée ou ajoutée au devis');
  }

  if (quantitesManquantesCount > 0) {
    motifsRefusEnvoi.push(
      `${quantitesManquantesCount} quantité${quantitesManquantesCount > 1 ? 's' : ''} d'ouvrage non renseignée${quantitesManquantesCount > 1 ? 's' : ''}`
    );
  }

  const coutsManquantsCount = prestations.filter(
    (occ) => occ.composants.length === 0 && (occ.coutUnitaireManuel === null || occ.coutUnitaireManuel === undefined)
  ).length;
  if (coutsManquantsCount > 0) {
    motifsRefusEnvoi.push(
      `${coutsManquantsCount} coût${coutsManquantsCount > 1 ? 's' : ''} unitaire${coutsManquantsCount > 1 ? 's' : ''} à saisir (prestation sans composition)`
    );
  }

  if (totalVenteHT > 0 && statutMarque !== 'VALIDE') {
    if (statutMarque === 'MARGE_INSUFFISANTE') {
      motifsRefusEnvoi.push(
        `Taux de marque à ${tauxMarqueCalcule.toFixed(1)}% (en dessous du seuil minimum de 15% — MARGE_INSUFFISANTE)`
      );
    } else if (statutMarque === 'MARGE_EXCESSIVE') {
      motifsRefusEnvoi.push(
        `Taux de marque à ${tauxMarqueCalcule.toFixed(1)}% (au-dessus du seuil maximum de 40% — MARGE_EXCESSIVE)`
      );
    }
  }

  const peutEnvoyerDevis = motifsRefusEnvoi.length === 0 && prestations.length > 0;

  return {
    totalCoutHT,
    totalVenteHT,
    margeBrute,
    tauxMargeSaisi: tauxMarge,
    tauxMarqueCalcule,
    statutMarque,
    tauxTVA,
    montantTVA,
    totalTTC,
    quantitesManquantesCount,
    prestationCount: prestations.length,
    peutEnvoyerDevis,
    motifsRefusEnvoi,
    prestationsCalculees,
  };
}

/**
 * Aplatit les composants (matériaux / main-d'œuvre) pour l'aperçu client et le PDF.
 * Une ligne = un composant, jamais l'ouvrage entier.
 */
export function flattenQuoteToLines(
  calculation: QuoteCalculation,
  tauxTVA: number = 10
): FlatQuoteLine[] {
  const lines: FlatQuoteLine[] = [];
  let index = 1;
  const margeMultiplier = 1 + calculation.tauxMargeSaisi / 100;

  for (const calc of calculation.prestationsCalculees) {
    const occ = calc.occurrence;
    const qteOuvrage = occ.quantiteOuvrage || 0;
    if (qteOuvrage <= 0) continue;

    const composantsActifs = [...occ.composants];
    for (const opt of occ.options || []) {
      if (opt.active && opt.composants) {
        composantsActifs.push(...opt.composants);
      }
    }

    if (composantsActifs.length === 0 && occ.coutUnitaireManuel != null) {
      const prixUnitaireHT = occ.coutUnitaireManuel * margeMultiplier;
      const montantHT = qteOuvrage * prixUnitaireHT;
      const tva = montantHT * (tauxTVA / 100);
      lines.push({
        id: `line_${index++}`,
        description: occ.titre,
        categorie: occ.titre,
        quantite: qteOuvrage,
        unite: occ.unite,
        prixUnitaireHT,
        tauxTVA,
        montantTVA: tva,
        totalHT: montantHT,
        totalTTC: montantHT + tva,
      });
      continue;
    }

    for (const comp of composantsActifs) {
      const quantite = comp.quantiteParUnite * qteOuvrage;
      const prixUnitaireHT = comp.prixUnitaireAchat * margeMultiplier;
      const montantHT = quantite * prixUnitaireHT;
      const tva = montantHT * (tauxTVA / 100);

      lines.push({
        id: `line_${index++}`,
        description: comp.nom,
        categorie: occ.titre,
        quantite,
        unite: comp.unite,
        prixUnitaireHT,
        tauxTVA,
        montantTVA: tva,
        totalHT: montantHT,
        totalTTC: montantHT + tva,
      });
    }
  }

  return lines;
}

/**
 * Formate un montant en euros avec séparateur d'espace insécable.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formate un pourcentage.
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)} %`;
}
