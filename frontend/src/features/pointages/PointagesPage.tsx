import { Check, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, ConfirmDialog, DataTable, ErrorState, Input, PageHeader, Pagination, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useChantiers } from '../chantiers/api';
import { useSousTraitants } from '../sous-traitants/api';
import { formatHeures, POINTAGE_STATUT, usePointages, useRefuserPointage, useResumePointages, useValiderPointages, type Pointage, type PointagesQuery, type PointageStatut } from './api';

/**
 * Hours entered by the sous-traitants (21/10), to validate or refuse. The chef sees his job sites;
 * the office sees everything. Follow-up only: payments stay entered on the sous-traitant record.
 */
export function PointagesPage() {
  const [query, setQuery] = useState<PointagesQuery>({ page: 1, statut: 'SOUMIS' });
  const list = usePointages(query);
  const chantiers = useChantiers({ page: 1, limit: 100 });
  const { hasRole } = useAuth();
  // The sous-traitants list is not open to the technico: no filter for him
  const sts = useSousTraitants({ page: 1, limit: 100 }, hasRole('ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER'));
  const valider = useValiderPointages();
  const refuser = useRefuserPointage();
  const [selection, setSelection] = useState<number[]>([]);
  const [refusing, setRefusing] = useState<Pointage | null>(null);
  const [motif, setMotif] = useState('');
  const set = (patch: Partial<PointagesQuery>) => { setQuery((q) => ({ ...q, ...patch, page: 1 })); setSelection([]); };

  const enAttente = (list.data?.data ?? []).filter((p) => p.statut === 'SOUMIS');
  const toutCoche = enAttente.length > 0 && enAttente.every((p) => selection.includes(p.id));
  const toggle = (id: number) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const t = list.data?.totaux;

  return (
    <>
      <PageHeader
        icon={<Clock />}
        title="Pointages"
        description="Heures saisies par les sous-traitants dans leur portail, à valider"
        actions={
          <Button
            icon={<Check className="size-4" />}
            disabled={!selection.length}
            loading={valider.isPending}
            onClick={() =>
              valider.mutate(selection, {
                onSuccess: (r) => { toast.success(`${r.valides} pointage(s) validé(s)`); setSelection([]); },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Valider la sélection{selection.length ? ` (${selection.length})` : ''}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          aria-label="Statut"
          containerClassName="w-40"
          placeholder="Tous"
          options={(Object.keys(POINTAGE_STATUT) as PointageStatut[]).map((s) => ({ value: s, label: POINTAGE_STATUT[s].label }))}
          value={query.statut}
          onChange={(e) => set({ statut: e.target.value as PointageStatut | '' })}
        />
        {sts.data && <Select
          aria-label="Sous-traitant"
          containerClassName="w-56"
          placeholder="Tous les sous-traitants"
          options={(sts.data?.data ?? []).map((s) => ({ value: s.id, label: s.nom }))}
          value={query.sousTraitantId ?? ''}
          onChange={(e) => set({ sousTraitantId: e.target.value ? Number(e.target.value) : undefined })}
        />}
        <Select
          aria-label="Chantier"
          containerClassName="w-56"
          placeholder="Tous les chantiers"
          options={(chantiers.data?.data ?? []).map((c) => ({ value: c.id, label: c.reference }))}
          value={query.chantierId ?? ''}
          onChange={(e) => set({ chantierId: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input aria-label="Du" type="date" containerClassName="w-40" value={query.du ?? ''} onChange={(e) => set({ du: e.target.value || undefined })} />
        <Input aria-label="Au" type="date" containerClassName="w-40" value={query.au ?? ''} onChange={(e) => set({ au: e.target.value || undefined })} />
      </div>
      {t && (
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Sur ce filtre : <span className="font-semibold text-emerald-700">{formatHeures(t.valide)} validées</span> · <span className="font-semibold text-amber-700">{formatHeures(t.soumis)} à valider</span>
          {t.refuse > 0 && <> · {formatHeures(t.refuse)} refusées</>}
        </p>
      )}
      <Card className="overflow-hidden">
        {list.isError ? (
          <div className="p-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
        ) : (
          <DataTable
            loading={list.isPending}
            rows={list.data?.data}
            rowKey={(p) => p.id}
            empty={{ title: query.statut === 'SOUMIS' ? 'Rien à valider' : 'Aucun pointage' }}
            columns={[
              {
                key: 'sel',
                header: (
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-700"
                    aria-label="Tout sélectionner"
                    disabled={!enAttente.length}
                    checked={toutCoche}
                    onChange={() => setSelection(toutCoche ? [] : enAttente.map((p) => p.id))}
                  />
                ),
                cell: (p) =>
                  p.statut === 'SOUMIS' ? (
                    <input type="checkbox" className="size-4 accent-brand-700" aria-label={`Sélectionner ${formatDate(p.date)}`} checked={selection.includes(p.id)} onChange={() => toggle(p.id)} />
                  ) : null,
              },
              { key: 'date', header: 'Jour', cell: (p) => formatDate(p.date) },
              { key: 'st', header: 'Sous-traitant', cell: (p) => <span className="font-medium">{p.sousTraitant?.nom}</span> },
              {
                key: 'chantier',
                header: 'Chantier / tâche',
                cell: (p) => (
                  <span>
                    {p.chantier.reference}
                    {p.tache && <span className="block text-xs text-slate-500">{p.tache.libelle}</span>}
                    {p.commentaire && <span className="block text-xs italic text-slate-500">{p.commentaire}</span>}
                  </span>
                ),
              },
              { key: 'heures', header: 'Heures', align: 'right', cell: (p) => <span className="font-semibold tabular-nums">{formatHeures(p.heures)}</span> },
              {
                key: 'statut',
                header: 'Statut',
                cell: (p) => (
                  <span>
                    <Badge tone={POINTAGE_STATUT[p.statut].tone}>{POINTAGE_STATUT[p.statut].label}</Badge>
                    {p.statut !== 'SOUMIS' && p.validePar && <span className="block text-xs text-slate-500">par {fullName(p.validePar)}</span>}
                    {p.statut === 'REFUSE' && p.motifRefus && <span className="block text-xs text-red-700">{p.motifRefus}</span>}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (p) =>
                  p.statut === 'SOUMIS' && (
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="outline" icon={<Check className="size-4" />} loading={valider.isPending && valider.variables?.length === 1 && valider.variables[0] === p.id}
                        onClick={() => valider.mutate([p.id], { onSuccess: () => toast.success('Pointage validé'), onError: (e) => toast.error(errorMessage(e)) })}>
                        Valider
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" icon={<X className="size-4" />} onClick={() => { setRefusing(p); setMotif(''); }}>
                        Refuser
                      </Button>
                    </span>
                  ),
              },
            ]}
          />
        )}
        <Pagination meta={list.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <ConfirmDialog
        open={!!refusing}
        onClose={() => setRefusing(null)}
        danger
        title="Refuser le pointage"
        message={refusing ? `${refusing.sousTraitant?.nom} · ${formatDate(refusing.date)} · ${formatHeures(refusing.heures)} sur ${refusing.chantier.reference}. Le sous-traitant est prévenu avec le motif.` : ''}
        confirmLabel="Refuser"
        loading={refuser.isPending}
        onConfirm={() => {
          if (!refusing) return;
          if (!motif.trim()) return toast.error('Indiquez le motif du refus.');
          refuser.mutate({ id: refusing.id, motif: motif.trim() }, { onSuccess: () => { toast.success('Pointage refusé'); setRefusing(null); }, onError: (e) => toast.error(errorMessage(e)) });
        }}
      >
        <Textarea label="Motif" required rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} />
      </ConfirmDialog>
    </>
  );
}

/** On the sous-traitant record: hours per job site. */
export function HeuresSection({ sousTraitantId }: { sousTraitantId: number }) {
  const resume = useResumePointages(sousTraitantId);
  if (resume.isPending) return <p className="p-5 text-sm text-slate-500">Chargement…</p>;
  if (resume.isError) return <div className="p-4"><ErrorState error={resume.error} onRetry={() => void resume.refetch()} /></div>;
  const rows = resume.data;
  return (
    <Card>
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">Aucune heure pointée. Le sous-traitant les saisit dans son portail (Mes heures).</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
            <tr><th className="px-4 py-2">Chantier</th><th className="px-4 py-2 text-right">Validées</th><th className="px-4 py-2 text-right">À valider</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.chantier.id}>
                <td className="px-4 py-2">{r.chantier.reference}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatHeures(r.valide)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-700">{r.soumis ? formatHeures(r.soumis) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold dark:bg-slate-800/60">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatHeures(rows.reduce((s, r) => s + r.valide, 0))}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatHeures(rows.reduce((s, r) => s + r.soumis, 0))}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </Card>
  );
}
