import { z } from 'zod';

/**
 * Default form messages in French (zod writes "Required", "Invalid email"… otherwise).
 * Imported once in main.tsx; messages written in a schema (`.min(1, 'Obligatoire')`) still win.
 */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Champ obligatoire.' };
      if (issue.expected === 'number') return { message: 'Indiquez un nombre.' };
      if (issue.expected === 'date') return { message: 'Indiquez une date valide.' };
      return { message: 'Valeur invalide.' };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: issue.minimum === 1 ? 'Champ obligatoire.' : `${issue.minimum} caractères minimum.` };
      if (issue.type === 'number') return { message: issue.inclusive ? `Doit être au moins ${issue.minimum}.` : `Doit être supérieur à ${issue.minimum}.` };
      if (issue.type === 'array') return { message: issue.minimum === 1 ? 'Choisissez au moins un élément.' : `Choisissez au moins ${issue.minimum} éléments.` };
      return { message: 'Valeur trop petite.' };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `${issue.maximum} caractères maximum.` };
      if (issue.type === 'number') return { message: issue.inclusive ? `Ne peut pas dépasser ${issue.maximum}.` : `Doit être inférieur à ${issue.maximum}.` };
      if (issue.type === 'array') return { message: `${issue.maximum} éléments maximum.` };
      return { message: 'Valeur trop grande.' };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Adresse email invalide (ex. nom@domaine.fr).' };
      if (issue.validation === 'url') return { message: 'Adresse web invalide.' };
      return { message: 'Format invalide.' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Choisissez une valeur dans la liste.' };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Indiquez une date valide.' };
    case z.ZodIssueCode.not_multiple_of:
      return { message: 'Valeur non autorisée.' };
    default:
      return { message: ctx.defaultError };
  }
});
