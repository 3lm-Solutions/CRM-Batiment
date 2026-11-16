import { formatDateTime, fullName } from '@/lib/format';
import { openFichier } from '@/lib/files';
import { AuthImage } from '@/components/files/AuthImage';
import { StatusBadge } from '@/components/ui';
import { photoPath, type Rapport } from './api';
import type { ReactNode } from 'react';

/** One report: author, text, photos, review state. Used by staff and by the portal. */
export function RapportItem({ rapport, actions, showChantier }: { rapport: Rapport; actions?: ReactNode; showChantier?: boolean }) {
  return (
    <article className="space-y-3 px-5 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">{fullName(rapport.auteur)}</span>
          <span className="text-slate-500"> · {formatDateTime(rapport.createdAt)}</span>
          {showChantier && rapport.chantier && <span className="text-slate-500"> · {rapport.chantier.reference}</span>}
          {rapport.tache && <span className="text-slate-500"> · {rapport.tache.libelle}</span>}
          {rapport.avancement !== null && <span className="text-slate-500"> · avancement déclaré {rapport.avancement} %</span>}
        </div>
        <StatusBadge kind="rapport" value={rapport.statut} />
      </header>
      <p className="whitespace-pre-line text-sm">{rapport.contenu}</p>
      {rapport.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rapport.photos.map((p) =>
            p.mime.startsWith('image/') ? (
              <AuthImage key={p.id} path={photoPath(p.id)} alt={p.nom} className="size-24 rounded-lg" onClick={() => void openFichier(p.id)} />
            ) : (
              <button key={p.id} type="button" onClick={() => void openFichier(p.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                {p.nom}
              </button>
            ),
          )}
        </div>
      )}
      {rapport.commentaireValidation && (
        <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="font-semibold">Retour du bureau :</span> {rapport.commentaireValidation}
        </p>
      )}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
