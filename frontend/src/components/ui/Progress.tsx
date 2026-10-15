import { cn } from '@/lib/cn';

/** Horizontal progress bar with its percentage (job sites, tasks). */
export function Progress({ value, className, showLabel = true }: { value: number; className?: string; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avancement"
      >
        <div className={cn('h-full rounded-full transition-all', v === 100 ? 'bg-emerald-500' : 'bg-brand-700')} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="w-10 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">{v} %</span>}
    </div>
  );
}
