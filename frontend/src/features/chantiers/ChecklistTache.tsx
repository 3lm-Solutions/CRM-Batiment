import { ListChecks, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, fullName } from '@/lib/format';
import { useAddChecklistItem, useDeleteChecklistItem, useUpdateChecklistItem, type Tache } from './api';

/**
 * Sub-tasks to tick inside a task (21/10). Ticking one updates the task progress (and the job site's):
 * progress = share of ticked items.
 */
export function ChecklistTache({ chantierId, tache, canEdit }: { chantierId: number; tache: Tache; canEdit: boolean }) {
  const items = tache.checklist ?? [];
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState('');
  const add = useAddChecklistItem(chantierId, tache.id);
  const update = useUpdateChecklistItem(chantierId, tache.id);
  const remove = useDeleteChecklistItem(chantierId, tache.id);
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const faits = items.filter((i) => i.fait).length;

  if (!items.length && !canEdit) return null;
  const submit = () => {
    const libelle = texte.trim();
    if (!libelle) return;
    add.mutate(libelle, { onSuccess: () => setTexte(''), onError });
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline dark:text-blue-300"
        aria-expanded={open}
      >
        <ListChecks className="size-3.5" />
        {items.length ? `Checklist ${faits} / ${items.length}` : 'Ajouter une checklist'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
          {items.map((i) => (
            <div key={i.id} className="group flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand-700"
                checked={i.fait}
                disabled={!canEdit || update.isPending}
                onChange={(e) => update.mutate({ id: i.id, fait: e.target.checked }, { onError })}
                aria-label={i.libelle}
              />
              <span
                className={cn('min-w-0 flex-1', i.fait && 'text-slate-400 line-through')}
                title={i.fait && i.faitLe ? `Fait le ${formatDateTime(i.faitLe)}${i.faitPar ? ` par ${fullName(i.faitPar)}` : ''}` : undefined}
              >
                {i.libelle}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="rounded p-0.5 text-slate-400 opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  aria-label={`Retirer ${i.libelle}`}
                  onClick={() => remove.mutate(i.id, { onError })}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <form
              className="flex items-center gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Nouveau point (ex. poser le primaire)"
                value={texte}
                maxLength={200}
                onChange={(e) => setTexte(e.target.value)}
                aria-label="Nouveau point de la checklist"
              />
              <button type="submit" disabled={!texte.trim() || add.isPending} className="rounded-md p-1.5 text-brand-700 hover:bg-brand-100 disabled:opacity-40 dark:text-blue-300" aria-label="Ajouter le point">
                <Plus className="size-4" />
              </button>
            </form>
          )}
          {items.length > 0 && <p className="text-[11px] text-slate-500">L’avancement de la tâche suit la checklist.</p>}
        </div>
      )}
    </div>
  );
}
