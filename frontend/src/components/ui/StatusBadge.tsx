type StatusType = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'pending' 
  | 'active' 
  | 'inactive' 
  | 'draft' 
  | 'completed' 
  | 'cancelled';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; darkBg: string; darkText: string }> = {
  success: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    darkBg: 'dark:bg-green-900/30',
    darkText: 'dark:text-green-300',
  },
  warning: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    darkBg: 'dark:bg-yellow-900/30',
    darkText: 'dark:text-yellow-300',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    darkBg: 'dark:bg-red-900/30',
    darkText: 'dark:text-red-300',
  },
  info: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    darkBg: 'dark:bg-blue-900/30',
    darkText: 'dark:text-blue-300',
  },
  pending: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    darkBg: 'dark:bg-orange-900/30',
    darkText: 'dark:text-orange-300',
  },
  active: {
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    darkBg: 'dark:bg-teal-900/30',
    darkText: 'dark:text-teal-300',
  },
  inactive: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    darkBg: 'dark:bg-gray-700',
    darkText: 'dark:text-gray-300',
  },
  draft: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    darkBg: 'dark:bg-purple-900/30',
    darkText: 'dark:text-purple-300',
  },
  completed: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    darkBg: 'dark:bg-emerald-900/30',
    darkText: 'dark:text-emerald-300',
  },
  cancelled: {
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    darkBg: 'dark:bg-rose-900/30',
    darkText: 'dark:text-rose-300',
  },
};

const sizeConfig = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const labelMap: Record<string, string> = {
  success: 'Succès',
  warning: 'Attention',
  error: 'Erreur',
  info: 'Info',
  pending: 'En attente',
  active: 'Actif',
  inactive: 'Inactif',
  draft: 'Brouillon',
  completed: 'Terminé',
  cancelled: 'Annulé',
  EN_COURS: 'En cours',
  DEMARRE: 'Démarré',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
  EN_ATTENTE: 'En attente',
  PLANIFIE: 'Planifié',
  REALISE: 'Réalisé',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
  PAYE: 'Payé',
  IMPAYE: 'Impayé',
};

export default function StatusBadge({ 
  status, 
  label, 
  size = 'md',
  className = '' 
}: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || statusConfig.info;
  const sizeClass = sizeConfig[size];
  const displayLabel = label || labelMap[status] || status;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${config.bg} ${config.text} 
        ${config.darkBg} ${config.darkText}
        ${sizeClass}
        ${className}
      `}
    >
      {displayLabel}
    </span>
  );
}
