import { Building, CheckSquare, Square } from 'lucide-react';
import type { TypeProjet } from '@/types';
import { cn } from '@/lib/utils';

interface ProjectTypeCheckboxGroupProps {
  label: string;
  typesProjet: TypeProjet[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  helperText?: string;
  accent?: 'primary' | 'teal';
}

const accentClasses = {
  primary: {
    selected: 'border-primary-200 bg-primary-50/70 text-primary-700',
    icon: 'text-primary-600',
    hover: 'hover:border-primary-200 hover:bg-primary-50/40',
    badge: 'bg-primary-100 text-primary-700',
  },
  teal: {
    selected: 'border-teal-200 bg-teal-50/70 text-teal-700',
    icon: 'text-teal-600',
    hover: 'hover:border-teal-200 hover:bg-teal-50/40',
    badge: 'bg-teal-100 text-teal-700',
  },
} as const;

export function ProjectTypeCheckboxGroup({
  label,
  typesProjet,
  selectedIds,
  onToggle,
  helperText = 'Vous pouvez selectionner plusieurs types de projet.',
  accent = 'primary',
}: ProjectTypeCheckboxGroupProps) {
  const tone = accentClasses[accent];

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="block text-[13px] font-semibold text-gray-700">{label}</label>
        <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', tone.badge)}>
          {selectedIds.length} choisi{selectedIds.length > 1 ? 's' : ''}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-gray-500">{helperText}</p>

      {typesProjet.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
          Aucun type de projet disponible.
        </div>
      ) : (
        <div className="grid max-h-[220px] gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-2">
          {typesProjet.map((typeProjet) => {
            const selected = selectedIds.includes(typeProjet.id);
            const categoryCount = typeProjet.categories?.length ?? 0;
            const isComplex = categoryCount > 1;
            const complexityLabel = isComplex ? 'Complexe' : 'Simple';

            return (
              <button
                key={typeProjet.id}
                type="button"
                onClick={() => onToggle(typeProjet.id)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-left transition-all',
                  selected
                    ? tone.selected
                    : cn('border-gray-200 bg-white text-gray-700', tone.hover),
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn('mt-0.5', selected ? tone.icon : 'text-gray-300')}>
                    {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building size={14} className={selected ? tone.icon : 'text-gray-400'} />
                      <span className="text-sm font-semibold">{typeProjet.nom}</span>
                      <span
                        className={cn(
                          'ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          isComplex
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-sky-100 text-sky-700',
                        )}
                      >
                        {complexityLabel}
                      </span>
                    </div>
                    {typeProjet.description && (
                      <p className="mt-1 text-[11px] leading-5 text-gray-500">
                        {typeProjet.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
