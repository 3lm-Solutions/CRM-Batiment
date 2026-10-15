import { Inbox, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-300 [&>svg]:size-8 dark:bg-slate-800 dark:text-blue-300">{icon ?? <Inbox className="size-6" />}</div>
      <p className="text-lg font-semibold text-slate-700 dark:text-slate-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{errorMessage(error)}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-1 font-semibold underline">Réessayer</button>}
      </div>
    </div>
  );
}
