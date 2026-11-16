import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState } from './States';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  empty?: { title: string; description?: ReactNode; action?: ReactNode };
}

/** Every list of the app uses this table: same spacing, loading skeleton, empty state. */
export function DataTable<T>({ columns, rows, loading, rowKey, onRowClick, empty }: DataTableProps<T>) {
  if (!loading && rows && rows.length === 0) {
    return <EmptyState title={empty?.title ?? 'Aucun élément'} description={empty?.description} action={empty?.action} />;
  }
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200/80 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/50">
          <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('whitespace-nowrap px-6 py-3', align(c.align), c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-slate-800">
                  {columns.map((c) => (
                    <td key={c.key} className="px-6 py-4"><div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-slate-800" /></td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    'border-b border-slate-100 last:border-0 transition-colors hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800/40',
                    onRowClick && 'cursor-pointer focus:bg-slate-50 dark:focus:bg-slate-800/60',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-6 py-3.5 text-slate-700 dark:text-slate-200', align(c.align), c.className)}>{c.cell(row)}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
