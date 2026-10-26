import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/format';
import { useChantiers } from '../chantiers/api';
import { useUserOptions } from '../users/api';
import { usePlanning, type Indisponibilite, type PlanningTache } from './api';

type Vue = 'semaine' | 'mois';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const STATUT_COULEUR: Record<string, string> = {
  A_FAIRE: 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  EN_COURS: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100',
  BLOQUEE: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100',
  TERMINEE: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
};

// ── dates (local calendar days) ──
const debutJour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ajouterJours = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lundi = (d: Date) => ajouterJours(debutJour(d), -((d.getDay() + 6) % 7));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const memeJour = (a: Date, b: Date) => iso(a) === iso(b);

/** A task (or an unavailability) covers this calendar day; no end date = a one-day task. */
const couvre = (debut: string, fin: string | null, jour: Date) => {
  const d = debutJour(new Date(debut));
  const f = debutJour(new Date(fin ?? debut));
  return d <= jour && jour <= f;
};

function TacheChip({ t, compact }: { t: PlanningTache; compact?: boolean }) {
  return (
    <Link
      to={`/chantiers/${t.chantier.id}`}
      className={cn('block truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight hover:brightness-95', STATUT_COULEUR[t.statut])}
      title={`${t.chantier.reference} — ${t.libelle} (${t.avancement} %)${t.intervenants.length ? `\n${t.intervenants.map((i) => fullName(i)).join(', ')}` : ''}`}
    >
      <span className="font-semibold">{t.chantier.reference}</span>
      {!compact && <span className="block truncate">{t.libelle}</span>}
      {compact && ` · ${t.libelle}`}
    </Link>
  );
}

/**
 * Team planning (21/10): who works where, day by day. Week view = one row per person (tasks of the
 * open job sites, unavailable sous-traitants shaded); month view = a calendar of the tasks.
 */
export function PlanningPage() {
  const [vue, setVue] = useState<Vue>('semaine');
  const [ref, setRef] = useState(() => debutJour(new Date()));
  const [chantierId, setChantierId] = useState('');
  const [userId, setUserId] = useState('');
  const chantiers = useChantiers({ page: 1, limit: 100, statuts: ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE'] });
  const users = useUserOptions(['CHEF_CHANTIER', 'SOUS_TRAITANT', 'ADMIN', 'TECHNICO', 'ASSISTANTE']);

  // Period shown: Monday → Sunday, or the 6 weeks around the month
  const jours = useMemo(() => {
    const start = vue === 'semaine' ? lundi(ref) : lundi(new Date(ref.getFullYear(), ref.getMonth(), 1));
    return Array.from({ length: vue === 'semaine' ? 7 : 42 }, (_, i) => ajouterJours(start, i));
  }, [vue, ref]);
  const planning = usePlanning({
    du: iso(jours[0]),
    au: iso(jours[jours.length - 1]),
    chantierId: chantierId ? Number(chantierId) : undefined,
    userId: userId ? Number(userId) : undefined,
  });
  const taches = planning.data?.taches ?? [];
  const indispos = planning.data?.indisponibilites ?? [];

  const deplacer = (sens: number) => setRef((r) => (vue === 'semaine' ? ajouterJours(r, 7 * sens) : new Date(r.getFullYear(), r.getMonth() + sens, 1)));
  const titre =
    vue === 'semaine'
      ? `Semaine du ${jours[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${jours[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Week rows: everyone who has a task this week (or the chosen person), then « not assigned »
  const lignes = useMemo(() => {
    const map = new Map<number, { id: number; nom: string; role: string }>();
    for (const t of taches) for (const i of t.intervenants) map.set(i.id, { id: i.id, nom: fullName(i), role: i.role });
    for (const d of indispos) if (d.sousTraitant.userId && !map.has(d.sousTraitant.userId)) map.set(d.sousTraitant.userId, { id: d.sousTraitant.userId, nom: d.sousTraitant.nom, role: 'SOUS_TRAITANT' });
    return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [taches, indispos]);
  const sansIntervenant = taches.filter((t) => t.intervenants.length === 0);
  const today = debutJour(new Date());

  const indispoDe = (uid: number, jour: Date): Indisponibilite | undefined =>
    indispos.find((d) => d.sousTraitant.userId === uid && couvre(d.dateDebut, d.dateFin, jour));

  return (
    <>
      <PageHeader icon={<CalendarRange />} title="Planning" description="Tâches datées des chantiers ouverts, par intervenant, et indisponibilités des sous-traitants" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" role="tablist">
          {(['semaine', 'mois'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vue === v}
              onClick={() => setVue(v)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold capitalize', vue === v ? 'brand-gradient text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Précédent" icon={<ChevronLeft className="size-4" />} onClick={() => deplacer(-1)} />
          <Button size="sm" variant="outline" onClick={() => setRef(debutJour(new Date()))}>Aujourd’hui</Button>
          <Button size="sm" variant="ghost" aria-label="Suivant" icon={<ChevronRight className="size-4" />} onClick={() => deplacer(1)} />
        </div>
        <p className={cn('text-sm font-semibold', vue === 'mois' && 'capitalize')}>{titre}</p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select aria-label="Chantier" containerClassName="w-48" placeholder="Tous les chantiers" options={(chantiers.data?.data ?? []).map((c) => ({ value: c.id, label: c.reference }))} value={chantierId} onChange={(e) => setChantierId(e.target.value)} />
          <Select aria-label="Intervenant" containerClassName="w-48" placeholder="Tous les intervenants" options={(users.data ?? []).map((u) => ({ value: u.id, label: fullName(u) }))} value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
      </div>

      {planning.isError ? (
        <ErrorState error={planning.error} onRetry={() => void planning.refetch()} />
      ) : vue === 'semaine' ? (
        <Card className="overflow-x-auto">
          <table className={cn('w-full min-w-[900px] table-fixed border-collapse text-sm', planning.isFetching && 'opacity-60')}>
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700">
                <th className="w-40 px-3 py-2 text-left font-medium">Intervenant</th>
                {jours.map((j, i) => (
                  <th key={iso(j)} className={cn('px-2 py-2 text-left font-medium', memeJour(j, today) && 'text-brand-700 dark:text-blue-300', i >= 5 && 'bg-slate-50 dark:bg-slate-800/40')}>
                    {JOURS[i]} {j.getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lignes.length === 0 && sansIntervenant.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">{planning.isPending ? 'Chargement…' : 'Aucune tâche datée cette semaine.'}</td></tr>
              )}
              {lignes.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-3 py-2">
                    <p className="truncate font-medium">{l.nom}</p>
                    <p className="text-[11px] text-slate-500">{l.role === 'SOUS_TRAITANT' ? 'Sous-traitant' : l.role === 'CHEF_CHANTIER' ? 'Chef de chantier' : 'Équipe'}</p>
                  </td>
                  {jours.map((j, i) => {
                    const indispo = indispoDe(l.id, j);
                    const duJour = taches.filter((t) => t.intervenants.some((x) => x.id === l.id) && couvre(t.dateDebut, t.dateFin, j));
                    return (
                      <td key={iso(j)} className={cn('space-y-1 px-1.5 py-1.5', i >= 5 && 'bg-slate-50 dark:bg-slate-800/40', indispo && 'bg-red-50/70 dark:bg-red-950/30')}>
                        {indispo && <p className="text-[10px] font-semibold uppercase text-red-700" title={indispo.notes ?? undefined}>Indisponible</p>}
                        {duJour.map((t) => <TacheChip key={t.id} t={t} />)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sansIntervenant.length > 0 && (
                <tr className="align-top">
                  <td className="px-3 py-2"><p className="font-medium text-amber-700">Non affectées</p></td>
                  {jours.map((j, i) => (
                    <td key={iso(j)} className={cn('space-y-1 px-1.5 py-1.5', i >= 5 && 'bg-slate-50 dark:bg-slate-800/40')}>
                      {sansIntervenant.filter((t) => couvre(t.dateDebut, t.dateFin, j)).map((t) => <TacheChip key={t.id} t={t} />)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <div className={cn('grid min-w-[760px] grid-cols-7', planning.isFetching && 'opacity-60')}>
            {JOURS.map((j) => <div key={j} className="border-b border-slate-200 px-2 py-2 text-xs font-medium text-slate-500 dark:border-slate-700">{j}</div>)}
            {jours.map((j) => {
              const duJour = taches.filter((t) => couvre(t.dateDebut, t.dateFin, j));
              const absents = indispos.filter((d) => couvre(d.dateDebut, d.dateFin, j));
              const horsMois = j.getMonth() !== ref.getMonth();
              return (
                <div key={iso(j)} className={cn('min-h-28 space-y-1 border-b border-r border-slate-100 p-1.5 dark:border-slate-800', horsMois && 'bg-slate-50/70 opacity-60 dark:bg-slate-900/40')}>
                  <p className={cn('text-xs font-semibold', memeJour(j, today) && 'inline-block rounded-full bg-brand-700 px-1.5 text-white')}>{j.getDate()}</p>
                  {duJour.slice(0, 3).map((t) => <TacheChip key={t.id} t={t} compact />)}
                  {duJour.length > 3 && <p className="text-[11px] text-slate-500">+ {duJour.length - 3} autre(s)</p>}
                  {absents.length > 0 && <p className="truncate text-[10px] text-red-700" title={absents.map((a) => a.sousTraitant.nom).join(', ')}>Indispo : {absents.map((a) => a.sousTraitant.nom).join(', ')}</p>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <p className="mt-3 text-xs text-slate-500">Seules les tâches avec une date de début apparaissent. Couleurs : à faire · en cours · bloquée · terminée. Cliquez une tâche pour ouvrir son chantier.</p>
    </>
  );
}
