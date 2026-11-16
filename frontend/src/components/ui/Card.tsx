import type { HTMLAttributes, ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none', className)}
      {...props}
    />
  );
}

/** Old app: light grey band at the top of a card. */
export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-t-2xl border-b border-slate-200/80 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {description && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Title, short description and main actions of a page (old app: big title in the page,
 * actions on the right, filters on the line below).
 */
export function PageHeader({
  title,
  description,
  actions,
  toolbar,
  icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  /** Small icon before the title, in the primary colour */
  icon?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {icon && <span className="text-brand-700 dark:text-blue-400 [&>svg]:size-6" aria-hidden>{icon}</span>}
            <span className="truncate">{title}</span>
          </h1>
          {description && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</div>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {toolbar && <div className="no-print flex flex-wrap items-center gap-3">{toolbar}</div>}
    </div>
  );
}

const ICON_TONES = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300',
  green: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300',
  red: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
} as const;
export type IconTone = keyof typeof ICON_TONES;

/** KPI tile (mockup "stat-card"): coloured icon square, big value, label, optional hint on the right. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  iconTone = 'blue',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'warning' | 'success';
  icon?: ReactNode;
  iconTone?: IconTone;
}) {
  const hintColor = tone === 'warning' ? 'text-orange-600' : tone === 'success' ? 'text-green-600' : 'text-gray-500';
  return (
    <div
      className={cn(
        'card-hover rounded-2xl border bg-white p-5 dark:bg-slate-900',
        tone === 'warning' ? 'border-orange-200 dark:border-orange-900' : 'border-slate-200/80 dark:border-slate-800',
      )}
    >
      {icon ? (
        <>
          <div className="mb-4 flex items-start justify-between gap-2">
            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5', ICON_TONES[iconTone])} aria-hidden>{icon}</span>
            {hint && <span className={cn('rounded-full bg-slate-50 px-2 py-1 text-right text-xs font-semibold dark:bg-slate-800', hintColor)}>{hint}</span>}
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
          <p className="mt-0.5 text-[13px] text-slate-500">{label}</p>
        </>
      ) : (
        <>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
          {hint && <p className={cn('mt-0.5 text-xs', hintColor)}>{hint}</p>}
        </>
      )}
    </div>
  );
}

/** Old dashboard banner: soft violet → blue gradient, "Bonjour, prénom 👋". */
export function WelcomeBanner({ prenom, label, children, actions }: { prenom: string; label: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="batiflow-gradient relative mb-8 overflow-hidden rounded-2xl p-6 lg:p-8">
      <div className="absolute right-0 top-0 size-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10" aria-hidden />
      <div className="absolute bottom-0 right-32 size-40 translate-y-1/2 rounded-full bg-white/10" aria-hidden />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-200">
            <Zap className="size-[18px] text-blue-600 dark:text-blue-300" aria-hidden /> {label}
          </p>
          <h1 className="mb-2 text-2xl font-bold text-blue-900 lg:text-3xl dark:text-white">Bonjour, {prenom} 👋</h1>
          {children && <div className="max-w-xl text-sm text-blue-800 lg:text-base dark:text-blue-100">{children}</div>}
        </div>
        {actions && <div className="no-print flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
