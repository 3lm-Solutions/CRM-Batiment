import { useState } from 'react';
import { Filter, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  type?: 'select' | 'multiselect';
}

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string | string[]>;
  onFilterChange: (key: string, value: string | string[]) => void;
  onClearAll: () => void;
  className?: string;
}

export default function FilterBar({ 
  filters, 
  activeFilters, 
  onFilterChange, 
  onClearAll,
  className = '' 
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className={`space-y-3 sm:space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Filter className="h-4 w-4" />
          <span className="text-sm sm:text-base">Filtres</span>
          {hasActiveFilters && (
            <span className="bg-teal-500 text-white text-xs px-2 py-0.5 rounded-full">
              {Object.keys(activeFilters).length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Effacer tout</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          {filters.map((filter) => (
            <div key={filter.key} className="space-y-1">
              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                {filter.label}
              </label>
              <select
                value={activeFilters[filter.key] as string || ''}
                onChange={(e) => onFilterChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Tous</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {hasActiveFilters && !isOpen && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(activeFilters).map(([key, value]) => {
            const filter = filters.find(f => f.key === key);
            const displayValue = Array.isArray(value) ? value.join(', ') : value;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs sm:text-sm bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded-full"
              >
                <span className="font-medium">{filter?.label}:</span> {displayValue}
                <button
                  onClick={() => onFilterChange(key, '')}
                  className="hover:text-teal-600 dark:hover:text-teal-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
