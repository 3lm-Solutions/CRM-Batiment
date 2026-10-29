import { BusinessException } from '../../../common';
import type { ChantierStatut } from '../../../generated/prisma/client';

/**
 * Comments and alerts of the client (Étapes 5–6 of 26/10). Pure rules, unit-tested.
 * During the works (and right after, for reservations) the client writes here; once the job site
 * is closed, after-sales goes through a SAV ticket.
 */
export const CHANTIERS_RETOURS: ChantierStatut[] = ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE'];

/** Messages a client may send in 24 h (all job sites): stops a runaway form or a leaked link. */
export const MAX_RETOURS_JOUR = 20;

export function assertChantierOuvertAuxRetours(statut: ChantierStatut): void {
  if (!CHANTIERS_RETOURS.includes(statut)) {
    throw new BusinessException(
      'CHANTIER_FERME',
      statut === 'CLOTURE'
        ? 'Ce chantier est clôturé : pour un problème, ouvrez une demande de service après-vente.'
        : 'Ce chantier est annulé.',
    );
  }
}

export function assertQuotaRetours(envoyesDernieres24h: number): void {
  if (envoyesDernieres24h >= MAX_RETOURS_JOUR) {
    throw new BusinessException(
      'TROP_DE_MESSAGES',
      `Vous avez envoyé ${MAX_RETOURS_JOUR} messages aujourd’hui : réessayez demain ou appelez-nous.`,
    );
  }
}

/** « Faïence › photo avant du 26/10 » — what the message is about, for notifications and emails. */
export function objetRetour(r: {
  chantier: string;
  tache?: string | null;
  photo?: { moment: 'AVANT' | 'APRES'; date: Date } | null;
}): string {
  if (r.photo) {
    const quand = r.photo.date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    return `${r.tache ? `« ${r.tache} » — ` : ''}photo ${r.photo.moment === 'AVANT' ? 'avant' : 'après'} du ${quand}`;
  }
  return r.tache ? `la tâche « ${r.tache} »` : `le chantier ${r.chantier}`;
}
