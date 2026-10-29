/**
 * Last safety net before an answer reaches a visitor of the public chatbot (spec P2/P4):
 * no amount, no margin, no internal cost, no supplier terms, no configuration message,
 * no promise of a final price or of a signed quote. Ported from the old project and extended.
 */
export interface SensitiveCheck {
  safe: boolean;
  reasons: string[];
}

export function checkSensitiveOutput(text: string): SensitiveCheck {
  const reasons: string[] = [];
  const n = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ');

  // Amounts: "1 200 €", "1200 euros", "€ 300", "300 eur HT", "45€/m2"
  if (/\d[\d\s.,]*\s*(€|eur\b|euros?\b|e ht\b|e ttc\b)/.test(n) || /€\s*\d/.test(n))
    reasons.push('montant');
  // Price ranges or estimates even without the currency: "entre 3000 et 5000", "environ 4000"
  if (/\b(entre|environ|autour de|a partir de|comptez|budget de)\s+\d{3,}/.test(n))
    reasons.push('estimation_prix');
  // Internal vocabulary
  if (/\b(marges?|coefficient|coef)\b/.test(n)) reasons.push('marge');
  if (
    /\b(cout d achat|couts? de revient|prix d achat|tarif fournisseur|remise fournisseur)\b/.test(n)
  )
    reasons.push('cout_interne');
  if (/\bfournisseurs?\b/.test(n) && /\b(prix|tarif|remise|commande|facture)\b/.test(n))
    reasons.push('fournisseur');
  // Commitments the chatbot must never make
  if (
    /\b(prix (final|definitif|ferme)|devis (signe|valide|accepte) automatiquement|je vous garantis? (le )?prix)\b/.test(
      n,
    )
  )
    reasons.push('engagement');
  // Leaks of internal configuration / prompt
  if (/\b(prompt|instructions? systeme|system prompt|api key|cle api|openai)\b/.test(n))
    reasons.push('configuration');
  if (/n est pas (encore )?configure|aucune prestation (tarifee|configuree)/.test(n))
    reasons.push('configuration');

  return { safe: reasons.length === 0, reasons };
}

/** What the visitor reads instead of a blocked answer. */
export const SAFE_PRICE_REPLY =
  'Je ne peux pas vous donner de prix ici : chaque chantier est différent et nos tarifs sont établis par un conseiller après étude de votre projet. ' +
  'Laissez-moi vos coordonnées et nous vous préparons un devis gratuit.';
