import { Check, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuthImage } from '@/components/files/AuthImage';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, fullName } from '@/lib/format';
import { openFichier } from '@/lib/files';
import { grouperPhotos, PHOTO_STATUTS, photoPath, type PhotoAvancement } from './api';

/**
 * Photos day by day, then task by task with « avant » and « après » side by side (Étapes 3–4 of
 * 26/10). Used by the chef / office (selection to validate or hide) and by the sous-traitant
 * (his own photos, delete while pending).
 */
export function PhotosFrise({
  photos,
  selection,
  onToggle,
  onToggleGroupe,
  onSupprimer,
  montrerAuteur = false,
  vide,
}: {
  photos: PhotoAvancement[];
  selection?: Set<number>;
  onToggle?: (id: number) => void;
  onToggleGroupe?: (ids: number[]) => void;
  onSupprimer?: (p: PhotoAvancement) => void;
  montrerAuteur?: boolean;
  vide: ReactNode;
}) {
  if (!photos.length) return <div className="px-5 py-6 text-sm text-slate-500">{vide}</div>;
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {grouperPhotos(photos).map(({ jour, groupes }) => (
        <section key={jour} className="space-y-4 px-5 py-4" aria-label={`Photos du ${formatDate(jour)}`}>
          <h3 className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">
            {new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {groupes.map((g) => {
            const ids = [...g.avant, ...g.apres].map((p) => p.id);
            const tousChoisis = !!selection && ids.every((id) => selection.has(id));
            return (
              <div key={g.cle} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {g.tache}
                    {g.sousTache && <span className="text-slate-500"> › {g.sousTache}</span>}
                  </p>
                  {onToggleGroupe && (
                    <button type="button" className="text-xs font-medium text-brand-700 hover:underline dark:text-blue-300" onClick={() => onToggleGroupe(ids)}>
                      {tousChoisis ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['avant', 'apres'] as const).map((m) => (
                    <div key={m}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{m === 'avant' ? 'Avant' : 'Après'}</p>
                      {g[m].length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700">Aucune photo</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {g[m].map((p) => (
                            <Vignette
                              key={p.id}
                              p={p}
                              choisie={selection?.has(p.id)}
                              onToggle={onToggle}
                              onSupprimer={onSupprimer}
                              montrerAuteur={montrerAuteur}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Vignette({
  p,
  choisie,
  onToggle,
  onSupprimer,
  montrerAuteur,
}: {
  p: PhotoAvancement;
  choisie?: boolean;
  onToggle?: (id: number) => void;
  onSupprimer?: (p: PhotoAvancement) => void;
  montrerAuteur: boolean;
}) {
  const statut = PHOTO_STATUTS[p.statut];
  return (
    <li className="w-28 space-y-1">
      <div className={cn('relative rounded-lg', choisie && 'ring-2 ring-brand-700 ring-offset-2 dark:ring-blue-400 dark:ring-offset-slate-900', p.statut === 'MASQUEE' && 'opacity-50')}>
        <AuthImage path={photoPath(p.fichierId)} alt={`${p.tache.libelle} — ${p.moment === 'AVANT' ? 'avant' : 'après'}`} className="size-28 rounded-lg" onClick={() => void openFichier(p.fichierId)} />
        {onToggle && (
          <button
            type="button"
            role="checkbox"
            aria-checked={!!choisie}
            aria-label={`Sélectionner la photo ${p.id}`}
            onClick={() => onToggle(p.id)}
            className={cn(
              'absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-md border-2 shadow',
              choisie ? 'border-brand-700 bg-brand-700 text-white' : 'border-white bg-white/80 text-transparent',
            )}
          >
            <Check className="size-4" />
          </button>
        )}
        {onSupprimer && p.statut !== 'VALIDEE' && (
          <button
            type="button"
            onClick={() => onSupprimer(p)}
            className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-red-600 shadow hover:bg-white"
            aria-label="Supprimer la photo"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <Badge tone={statut.tone}>{statut.label}</Badge>
      {montrerAuteur && <p className="truncate text-[11px] text-slate-500">{fullName(p.auteur)}</p>}
      {p.commentaire && <p className="line-clamp-2 text-[11px] italic text-slate-500">{p.commentaire}</p>}
      {p.statut === 'MASQUEE' && p.motifMasquage && <p className="text-[11px] text-red-600">{p.motifMasquage}</p>}
    </li>
  );
}
