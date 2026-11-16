// Validation legere des saisies du chatbot public.
// Objectif : attraper les formats manifestement invalides AVANT l'envoi,
// avec un message immediat. La validation approfondie reste cote backend.

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// Un email "tenté" mais malformé (ex: "jean@gmail" sans TLD, "jean@@mail.com")
export function validateChatInput(raw: string): ValidationResult {
  const value = raw.trim();

  // 1. Longueur : vide ou espaces -> bloque ; trop long -> bloque
  if (value.length === 0) {
    return { valid: false, message: 'Veuillez écrire un message avant d\'envoyer. 😊' };
  }
  if (value.length > 1000) {
    return {
      valid: false,
      message: 'Votre message est très long. Pouvez-vous le raccourcir (1000 caractères max) ?',
    };
  }

  // 2. Email tenté mais malformé : contient un @ mais pas un email valide
  const looksLikeEmailAttempt = /\S+@\S*/.test(value);
  const containsValidEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(value);
  if (looksLikeEmailAttempt && !containsValidEmail) {
    return {
      valid: false,
      message: 'Cet email semble incomplet (ex: nom@domaine.com). Pouvez-vous vérifier ?',
    };
  }

  // 3. Téléphone tenté mais trop court : suite de chiffres seule entre 4 et 7 chiffres
  const digitsOnly = value.replace(/[\s.\-()]/g, '');
  if (/^\+?\d{4,7}$/.test(digitsOnly)) {
    return {
      valid: false,
      message: 'Ce numéro semble incomplet (8 chiffres minimum). Pouvez-vous vérifier ?',
    };
  }

  return { valid: true };
}