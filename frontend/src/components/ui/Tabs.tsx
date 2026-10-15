import { cn } from '@/lib/cn';

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition',
            value === t.value
              ? 'brand-gradient text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
