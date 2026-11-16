import { Injectable } from '@nestjs/common';
import { BusinessException } from './exceptions/business.exception.js';

// ─────────────────────────────────────────────────────────
// P0.5 — WorkflowStateService
// Service central qui contrôle toutes les transitions
// de statuts pour Devis et Chantier.
// ─────────────────────────────────────────────────────────

// ── Transitions autorisées pour les Devis ────────────────
const DEVIS_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ['ENVOYE', 'ANNULE'],
  ENVOYE: ['ACCEPTE', 'REFUSE', 'ANNULE'],
  ACCEPTE: ['SIGNE', 'ANNULE'],
  SIGNE: [],        // statut final — aucune transition possible
  REFUSE: ['REVISE', 'ANNULE'],
  REVISE: ['RENVOYE', 'ANNULE'],
  RENVOYE: ['ACCEPTE', 'REFUSE', 'ANNULE'],
  ANNULE: [],       // statut final — aucune transition possible
};

// ── Transitions autorisées pour les Chantiers ────────────
const CHANTIER_TRANSITIONS: Record<string, string[]> = {
  VISITE_TECHNIQUE: ['DEVIS_EN_PREPARATION', 'ANNULE'],
  DEVIS_EN_PREPARATION: ['DEVIS_ENVOYE', 'ANNULE'],
  DEVIS_ENVOYE: ['NEGOCIATION_EN_COURS', 'DEVIS_VALIDE', 'ANNULE'],
  NEGOCIATION_EN_COURS: ['DEVIS_VALIDE', 'ANNULE'],
  DEVIS_VALIDE: ['COMMANDES_GENEREES', 'PLANIFIE', 'ANNULE'],
  COMMANDES_GENEREES: ['MATERIAUX_EN_LIVRAISON', 'PLANIFIE', 'ANNULE'],
  MATERIAUX_EN_LIVRAISON: ['MATERIAUX_RECEPTIONNES', 'ANNULE'],
  MATERIAUX_RECEPTIONNES: ['PLANIFIE', 'ANNULE'],
  PLANIFIE: ['DEMARRE', 'ANNULE'],
  DEMARRE: ['EN_COURS', 'ANNULE'],
  EN_COURS: ['TERMINE', 'ANNULE'],
  TERMINE: ['CLOTURE'],
  CLOTURE: [],      // statut final — aucune transition possible
  ANNULE: [],       // statut final — aucune transition possible
};

@Injectable()
export class WorkflowStateService {

  // ── Valider une transition de statut Devis (retourne un booléen et lève BusinessException) ──
  validateTransition(currentStatus: string, targetStatus: string): boolean {
    const allowed = DEVIS_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(targetStatus)) {
      throw new BusinessException(
        `Transition Devis interdite : ${currentStatus} → ${targetStatus}. ` +
        `Transitions autorisées depuis ${currentStatus} : ` +
        (allowed.length ? allowed.join(', ') : 'aucune (statut final)'),
      );
    }
    return true;
  }

  // ── Valider une transition de statut Devis (legacy) ──────────────
  validateDevisTransition(current: string, next: string): void {
    const allowed = DEVIS_TRANSITIONS[current] ?? [];

    if (!allowed.includes(next)) {
      throw new BusinessException(
        `Transition Devis interdite : ${current} → ${next}. ` +
        `Transitions autorisées depuis ${current} : ` +
        (allowed.length ? allowed.join(', ') : 'aucune (statut final)'),
      );
    }
  }

  // ── Valider une transition de statut Chantier ───────────
  validateChantierTransition(current: string, next: string): void {
    const allowed = CHANTIER_TRANSITIONS[current] ?? [];

    if (!allowed.includes(next)) {
      throw new BusinessException(
        `Transition Chantier interdite : ${current} → ${next}. ` +
        `Transitions autorisées depuis ${current} : ` +
        (allowed.length ? allowed.join(', ') : 'aucune (statut final)'),
      );
    }
  }

  // ── Récupérer les transitions possibles pour un Devis ───
  getDevisTransitions(current: string): string[] {
    return DEVIS_TRANSITIONS[current] ?? [];
  }

  // ── Récupérer les transitions possibles pour un Chantier 
  getChantierTransitions(current: string): string[] {
    return CHANTIER_TRANSITIONS[current] ?? [];
  }
}