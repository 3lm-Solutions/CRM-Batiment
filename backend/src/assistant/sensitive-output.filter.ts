// ============================================================
// FILTRE DE SORTIE — dernier filet de securite avant l'envoi.
// Detecte les informations sensibles qui ne doivent JAMAIS
// atteindre un client du chatbot public : montants, marges,
// couts internes, fournisseurs, messages de configuration.
// ============================================================

export interface SensitiveCheckResult {
  safe: boolean;
  reasons: string[];
}

export function checkSensitiveOutput(text: string): SensitiveCheckResult {
  const reasons: string[] = [];
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Montants chiffres (euros, dinars, DT...) : jamais de prix au client
  if (
    // Le symbole € n'est pas un "caractere de mot" : pas de \b apres lui !
    /\d[\d\s.,]*\s*€/.test(normalized) ||
    /\d[\d\s.,]*\s*(eur|euros?|dt|tnd|dinars?)\b/i.test(normalized) ||
    /€\s*\d/.test(normalized)
  ) {
    reasons.push('montant_chiffre');
  }

  // 2. Vocabulaire interne : marges, couts d'achat, remises fournisseur
  if (/\b(marge|marges|coefficient|coef)\b/.test(normalized)) {
    reasons.push('marge_interne');
  }
  if (/\b(cout d achat|prix d achat|tarif fournisseur|remise fournisseur)\b/.test(normalized)) {
    reasons.push('cout_achat_interne');
  }

  // 3. Noms/donnees fournisseurs
  if (/\b(fournisseur|fournisseurs)\b/.test(normalized) && /\b(prix|tarif|remise|commande)\b/.test(normalized)) {
    reasons.push('donnees_fournisseur');
  }

  // 4. Messages de configuration interne (les fuites qu'on a deja vues !)
  if (
    /aucune (prestation|categorie|sous-categorie)\b.*\b(tarifee|configuree|disponible)/.test(normalized) ||
    /n est pas encore configure/.test(normalized)
  ) {
    reasons.push('message_configuration_interne');
  }

  return { safe: reasons.length === 0, reasons };
}