import { DevisStatut } from '../../../generated/prisma/client';
import { BusinessException } from '../../../common';

/**
 * THE quote state machine — single source of truth (the old project had two contradicting
 * copies, and the verbal-signature shortcut ENVOYE → SIGNE was allowed by neither).
 *
 *   BROUILLON ─envoyer→ ENVOYE ─client accepte→ ACCEPTE ─signatures→ SIGNE
 *                          │  └─signature verbale (conseiller)────────────→ SIGNE
 *                          └─client refuse→ REFUSE ─réviser→ REVISE ─envoyer→ RENVOYE ─(comme ENVOYE)
 *   ENVOYE / RENVOYE can also be revised directly (client asks for a change by phone).
 *   Any non-final state → ANNULE.  SIGNE and ANNULE are final.
 *
 *   05/11 — paper signature: ENVOYE / RENVOYE / ACCEPTE ─photo du devis signé→ SIGNE_PAPIER
 *   SIGNE_PAPIER ─ADMIN valide→ SIGNE  |  ─ADMIN refuse la photo→ back to ENVOYE / RENVOYE / ACCEPTE
 *   (« remis au client » uses the same BROUILLON → ENVOYE / REVISE → RENVOYE transitions, without email)
 */
export const DEVIS_TRANSITIONS: Record<DevisStatut, readonly DevisStatut[]> = {
  BROUILLON: ['ENVOYE', 'ANNULE'],
  ENVOYE: ['ACCEPTE', 'REFUSE', 'REVISE', 'SIGNE', 'SIGNE_PAPIER', 'ANNULE'],
  RENVOYE: ['ACCEPTE', 'REFUSE', 'REVISE', 'SIGNE', 'SIGNE_PAPIER', 'ANNULE'],
  ACCEPTE: ['SIGNE', 'SIGNE_PAPIER', 'ANNULE'],
  REFUSE: ['REVISE', 'ANNULE'],
  REVISE: ['RENVOYE', 'ANNULE'],
  SIGNE_PAPIER: ['SIGNE', 'ENVOYE', 'RENVOYE', 'ACCEPTE', 'ANNULE'],
  SIGNE: [],
  ANNULE: [],
};

/** 05/11: a photo of the signed paper quote can be uploaded from these states. */
export const SIGNATURE_PAPIER_STATUTS: readonly DevisStatut[] = ['ENVOYE', 'RENVOYE', 'ACCEPTE'];

/** Lines and header can only be edited in these states. */
export const EDITABLE_STATUTS: readonly DevisStatut[] = ['BROUILLON', 'REVISE'];

/** States where the client is waiting for / looking at the quote. */
export const AWAITING_CLIENT_STATUTS: readonly DevisStatut[] = ['ENVOYE', 'RENVOYE'];

export function canTransition(from: DevisStatut, to: DevisStatut): boolean {
  return DEVIS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DevisStatut, to: DevisStatut): void {
  if (!canTransition(from, to)) {
    const allowed = DEVIS_TRANSITIONS[from];
    throw new BusinessException(
      'TRANSITION_DEVIS_INTERDITE',
      `Transition ${from} → ${to} impossible. ` +
        (allowed.length
          ? `Depuis ${from} : ${allowed.join(', ')}.`
          : `${from} est un statut final.`),
    );
  }
}

/** Which states can reach `to` — used for conditional (race-safe) updates. */
export function sourcesOf(to: DevisStatut): DevisStatut[] {
  return (Object.keys(DEVIS_TRANSITIONS) as DevisStatut[]).filter((from) =>
    canTransition(from, to),
  );
}

export function assertEditable(statut: DevisStatut): void {
  if (!EDITABLE_STATUTS.includes(statut)) {
    throw new BusinessException(
      'DEVIS_NON_MODIFIABLE',
      `Un devis ${statut} ne peut plus être modifié. Révisez-le pour créer une nouvelle version.`,
    );
  }
}
