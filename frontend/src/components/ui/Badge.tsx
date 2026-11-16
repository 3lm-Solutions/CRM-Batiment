import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  slate: 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-200',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  amber: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  violet: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

/** One place for every status label and colour. */
const STATUS: Record<string, Record<string, [string, Tone]>> = {
  devis: {
    BROUILLON: ['Brouillon', 'slate'],
    ENVOYE: ['Envoyé', 'blue'],
    RENVOYE: ['Renvoyé', 'blue'],
    ACCEPTE: ['Accepté', 'violet'],
    SIGNE: ['Signé', 'green'],
    REFUSE: ['Refusé', 'red'],
    REVISE: ['En révision', 'amber'],
    ANNULE: ['Annulé', 'slate'],
  },
  demande: {
    NOUVEAU: ['Nouvelle', 'blue'],
    EN_COURS: ['En cours', 'amber'],
    QUALIFIE: ['Qualifiée', 'violet'],
    CONVERTI: ['Convertie', 'green'],
    PERDU: ['Perdue', 'slate'],
  },
  chantier: {
    PLANIFIE: ['Planifié', 'blue'],
    EN_COURS: ['En cours', 'amber'],
    SUSPENDU: ['Suspendu', 'red'],
    TERMINE: ['Terminé', 'green'],
    CLOTURE: ['Clôturé', 'slate'],
    ANNULE: ['Annulé', 'slate'],
  },
  actif: { true: ['Actif', 'green'], false: ['Inactif', 'slate'] },
  tache: {
    A_FAIRE: ['À faire', 'slate'],
    EN_COURS: ['En cours', 'amber'],
    BLOQUEE: ['Bloquée', 'red'],
    TERMINEE: ['Terminée', 'green'],
  },
  facture: {
    BROUILLON: ['Brouillon', 'slate'],
    ENVOYEE: ['Émise', 'blue'],
    PAYEE: ['Payée', 'green'],
    ANNULEE: ['Annulée', 'red'],
  },
  factureType: {
    ACOMPTE: ['Acompte', 'violet'],
    SITUATION: ['Situation', 'blue'],
    FINALE: ['Finale', 'green'],
    AVOIR: ['Avoir', 'red'],
  },
  commande: {
    CREEE: ['Créée', 'slate'],
    ENVOYEE: ['Envoyée', 'blue'],
    EXPEDIEE: ['Expédiée', 'violet'],
    PARTIELLE: ['Reçue partiellement', 'amber'],
    RECUE: ['Reçue', 'green'],
    CLOTUREE: ['Clôturée', 'slate'],
    ANNULEE: ['Annulée', 'red'],
  },
  mouvement: {
    ENTREE: ['Entrée', 'green'],
    SORTIE: ['Sortie', 'amber'],
    AJUSTEMENT: ['Ajustement', 'blue'],
  },
  sousTraitant: {
    ACTIF: ['Actif', 'green'],
    INACTIF: ['Inactif', 'slate'],
    SUSPENDU: ['Suspendu', 'red'],
  },
  contrat: {
    BROUILLON: ['Brouillon', 'slate'],
    ACTIF: ['Actif', 'green'],
    TERMINE: ['Terminé', 'blue'],
    RESILIE: ['Résilié', 'red'],
  },
  assurance: {
    VALIDE: ['Valide', 'green'],
    A_RENOUVELER: ['À renouveler', 'amber'],
    EXPIREE: ['Expirée', 'red'],
  },
  paiement: {
    EN_ATTENTE: ['En attente', 'amber'],
    REGLE: ['Réglé', 'green'],
    ANNULE: ['Annulé', 'slate'],
  },
  sav: {
    OUVERT: ['Ouvert', 'blue'],
    EN_COURS: ['En cours', 'amber'],
    EN_ATTENTE_CLIENT: ['Attente client', 'violet'],
    RESOLU: ['Résolu', 'green'],
    CLOTURE: ['Clôturé', 'slate'],
  },
  priorite: {
    BASSE: ['Basse', 'slate'],
    NORMALE: ['Normale', 'blue'],
    HAUTE: ['Haute', 'amber'],
    URGENTE: ['Urgente', 'red'],
  },
  demo: {
    PENDING: ['À contacter', 'blue'],
    CONTACTED: ['Contacté', 'amber'],
    SCHEDULED: ['Démo planifiée', 'violet'],
    DONE: ['Terminée', 'green'],
    CANCELED: ['Annulée', 'slate'],
  },
  prospect: {
    NOUVEAU: ['En conversation', 'slate'],
    A_QUALIFIER: ['À qualifier', 'amber'],
    QUALIFIE: ['Qualifié', 'green'],
    REJETE: ['Rejeté', 'red'],
  },
  rapport: {
    SOUMIS: ['À valider', 'amber'],
    VALIDE: ['Validé', 'green'],
    REJETE: ['À reprendre', 'red'],
  },
};

export type StatusKind = keyof typeof STATUS;

/** Label of a status, for selects and filters. */
export const statusLabel = (kind: StatusKind, value: string) => STATUS[kind][value]?.[0] ?? value;

/** `{ value, label }` options for a select, in the declared order. */
export const statusOptions = (kind: StatusKind) => Object.entries(STATUS[kind]).map(([value, [label]]) => ({ value, label }));

export function StatusBadge({ kind, value }: { kind: StatusKind; value: string | boolean }) {
  const [label, tone] = STATUS[kind][String(value)] ?? [String(value), 'slate'];
  return <Badge tone={tone}>{label}</Badge>;
}
