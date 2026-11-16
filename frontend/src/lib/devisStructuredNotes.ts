export interface StructuredDevisNotes {
  paymentTerms: string;
  generalConditions: string;
  communication: string;
  extraNotes: string;
}

const STRUCTURED_PREFIX = '__CRM_STRUCTURED_NOTES_V1__';

export const DEFAULT_PAYMENT_TERMS = [
  "Un acompte de 10% est demande a la signature.",
  "Un acompte de 30% est demande au demarrage du chantier.",
  "Un deuxieme acompte de 40% est demande a mi-chantier.",
  "Le solde (20%) est regle a la fin des travaux.",
].join('\n');

export const DEFAULT_GENERAL_CONDITIONS = [
  'Le present devis est etabli sur base des informations visibles lors de la visite.',
  'En cas de travaux complementaires non visibles, un avenant est soumis avant execution.',
  'Le delai et la planification sont confirmes a validation du devis.',
].join('\n');

export function parseStructuredDevisNotes(notes?: string | null): StructuredDevisNotes {
  if (typeof notes === 'string' && notes.startsWith(STRUCTURED_PREFIX)) {
    const jsonPayload = notes.slice(STRUCTURED_PREFIX.length);
    try {
      const parsed = JSON.parse(jsonPayload) as Partial<StructuredDevisNotes>;
      return {
        paymentTerms: parsed.paymentTerms?.trim() || DEFAULT_PAYMENT_TERMS,
        generalConditions: parsed.generalConditions?.trim() || DEFAULT_GENERAL_CONDITIONS,
        communication: parsed.communication?.trim() || '',
        extraNotes: parsed.extraNotes?.trim() || '',
      };
    } catch {
      return {
        paymentTerms: DEFAULT_PAYMENT_TERMS,
        generalConditions: DEFAULT_GENERAL_CONDITIONS,
        communication: '',
        extraNotes: notes,
      };
    }
  }

  return {
    paymentTerms: DEFAULT_PAYMENT_TERMS,
    generalConditions: DEFAULT_GENERAL_CONDITIONS,
    communication: '',
    extraNotes: notes?.trim() || '',
  };
}

export function composeStructuredDevisNotes(input: StructuredDevisNotes): string {
  const payload: StructuredDevisNotes = {
    paymentTerms: input.paymentTerms?.trim() || DEFAULT_PAYMENT_TERMS,
    generalConditions: input.generalConditions?.trim() || DEFAULT_GENERAL_CONDITIONS,
    communication: input.communication?.trim() || '',
    extraNotes: input.extraNotes?.trim() || '',
  };

  return `${STRUCTURED_PREFIX}${JSON.stringify(payload)}`;
}
