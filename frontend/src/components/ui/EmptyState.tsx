import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 sm:py-16 px-4 ${className}`}>
      {Icon && (
        <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full mb-4 sm:mb-6">
          <Icon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center max-w-md mb-6 sm:mb-8">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-medium px-6 py-2.5 sm:px-8 sm:py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
