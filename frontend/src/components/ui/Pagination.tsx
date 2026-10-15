import type { PaginationMeta } from '@/shared';
import { cn } from '@/lib/cn';

/** Pages to show: first, last, current ±1, with "…" for the gaps. */
function pageList(page: number, total: number): (number | '…')[] {
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

const BTN = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:bg-slate-900 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:border-slate-700 dark:hover:bg-slate-800';

/** "Affichage 1-20 sur 47" + numbered pages (mockup). Hidden when everything fits on one page. */
export function Pagination({ meta, onPage }: { meta?: PaginationMeta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-6 py-4 dark:border-slate-800" aria-label="Pagination">
      <p className="text-sm text-gray-500">Affichage {from}-{to} sur {meta.total}</p>
      <div className="flex items-center gap-1">
        <button type="button" className={BTN} disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>← Préc.</button>
        {pageList(meta.page, meta.totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === meta.page ? 'page' : undefined}
              onClick={() => onPage(p)}
              className={cn(p === meta.page ? 'rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white' : BTN)}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={BTN} disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Suiv. →</button>
      </div>
    </nav>
  );
}
