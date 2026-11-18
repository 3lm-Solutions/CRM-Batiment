import { BusinessException } from '../../../common';

/** « fa-12/b » and « FA 12 B » are the same invoice: uppercase, without spaces - . / */
export function normaliserNumero(numero: string): string {
  return numero.toUpperCase().replace(/[\s\-./]+/g, '');
}

/** Duplicate key of the supplier: its id when chosen from the list, else its normalised name. */
export function fournisseurCle(fournisseurId: number | null | undefined, nom: string): string {
  return fournisseurId
    ? `f:${fournisseurId}`
    : `n:${nom.trim().replace(/\s+/g, ' ').toUpperCase()}`;
}

/** Tolerance for the rounding of an invoice (cents) */
const TOLERANCE = 0.05;

/**
 * HT + TVA must give TTC (± 5 cents): a bigger gap means the OCR misread a figure,
 * the phone asks for a correction (422 MONTANTS_INCOHERENTS).
 */
export function assertMontants(ht: number, tva: number, ttc: number): void {
  const ecart = Math.abs(Math.round((ht + tva - ttc) * 100)) / 100;
  if (ecart > TOLERANCE) {
    throw new BusinessException(
      'MONTANTS_INCOHERENTS',
      `HT + TVA (${(ht + tva).toFixed(2)} €) ne donne pas le TTC (${ttc.toFixed(2)} €). Vérifiez les montants lus.`,
      422,
      { ecart },
    );
  }
}
