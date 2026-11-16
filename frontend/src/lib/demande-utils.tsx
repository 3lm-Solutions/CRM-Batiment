import type { ReactNode } from 'react';
import { Clock, Loader2, CheckCircle2, X } from 'lucide-react';
import type { DemandeDevis, DemandeDevisStatut } from '@/types';

export const DEMANDE_STATUT_CONFIG: Record<
  DemandeDevisStatut,
  { label: string; bg: string; text: string; dot: string; icon: ReactNode; helper: string }
> = {
  NOUVEAU: {
    label: 'Nouveau',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    icon: <Clock size={14} />,
    helper: 'Demande créée et en attente de prise en charge.',
  },
  EN_COURS: {
    label: 'En cours',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    icon: <Loader2 size={14} />,
    helper: 'Le technico est en train d’étudier le besoin.',
  },
  CONVERTI: {
    label: 'Convertie',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    icon: <CheckCircle2 size={14} />,
    helper: 'La demande a été transformée en opportunité traitée.',
  },
  PERDU: {
    label: 'Perdue',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    icon: <X size={14} />,
    helper: 'La demande n’ira pas plus loin.',
  },
};

export function normalizeDemandeStatut(statut: string): DemandeDevisStatut {
  if (statut === 'QUALIFIE') return 'EN_COURS';
  const valid: DemandeDevisStatut[] = ['NOUVEAU', 'EN_COURS', 'CONVERTI', 'PERDU'];
  return valid.includes(statut as DemandeDevisStatut) ? (statut as DemandeDevisStatut) : 'NOUVEAU';
}

export function getClientLabel(demande: DemandeDevis) {
  if (!demande.client) return `#${demande.clientId}`;
  return `${demande.client.prenom ?? ''} ${demande.client.nom}`.trim() || `#${demande.clientId}`;
}