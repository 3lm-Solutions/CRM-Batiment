import { ChevronLeft, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { errorMessage, toProblem } from '@/lib/api';
import { formatDate, toDateInput } from '@/lib/format';
import { formatHeures, POINTAGE_STATUT, useMesPointages, usePointer, useSupprimerPointage, type Pointage } from '../pointages/api';
import { useStChantier, useStChantiers } from './api';

const moisCourant = () => new Date().toISOString().slice(0, 7);
const decaler = (mois: string, n: number) => {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const libelleMois = (mois: string) => new Date(`${mois}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/**
 * Time tracking (21/10): the sous-traitant enters his hours per day and job site; the chef or the
 * office validates them. Refused hours show the reason and can be entered again.
 */
export function StHeuresPage() {
  const [mois, setMois] = useState(moisCourant());
  const list = useMesPointages(mois);
  const chantiers = useStChantiers();
  const pointer = usePointer();
  const remove = useSupprimerPointage();

  const [date, setDate] = useState(toDateInput(new Date()));
  const [chantierId, setChantierId] = useState('');
  const [tacheId, setTacheId] = useState('');
  const [heures, setHeures] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [deleting, setDeleting] = useState<Pointage | null>(null);
  const chantier = useStChantier(Number(chantierId) || 0);
  const taches = chantierId && chantier.data ? chantier.data.taches.filter((t) => t.affecteeAMoi) : [];

  const h = Number(heures.replace(',', '.'));
  const heuresOk = Number.isFinite(h) && h >= 0.25 && h <= 24;
  const today = toDateInput(new Date());
  const ready = !!date && date <= today && !!chantierId && heuresOk;

  if (list.isPending) return <Loading />;
  if (list.isError) {
    if (toProblem(list.error).status === 403) {
      return (
        <>
          <PageHeader title="Mes heures" />
          <Card><EmptyState title="Dossier non rattaché" description="Votre compte n’est pas encore lié à une fiche sous-traitant. Contactez l’entreprise." /></Card>
        </>
      );
    }
    return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  }
  const d = list.data;

  const submit = () =>
    pointer.mutate(
      { chantierId: Number(chantierId), tacheId: tacheId ? Number(tacheId) : null, date, heures: h, commentaire: commentaire.trim() || null },
      {
        onSuccess: () => {
          toast.success('Heures envoyées pour validation');
          setHeures('');
          setCommentaire('');
          if (date.slice(0, 7) !== mois) setMois(date.slice(0, 7));
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <>
      <PageHeader icon={<Clock />} title="Mes heures" description="Pointez vos heures par jour et par chantier : le chef de chantier ou l’entreprise les valide." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Pointer une journée" />
          <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (ready) submit(); }}>
            <Input label="Jour" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            <Select
              label="Chantier"
              required
              placeholder="Choisir…"
              options={(chantiers.data ?? []).filter((c) => c.statut !== 'ANNULE' && c.statut !== 'CLOTURE').map((c) => ({ value: c.id, label: `${c.reference} — ${c.adresse}` }))}
              value={chantierId}
              onChange={(e) => { setChantierId(e.target.value); setTacheId(''); }}
            />
            <Select
              label="Tâche"
              placeholder="Non précisée"
              disabled={!taches.length}
              options={taches.map((t) => ({ value: t.id, label: t.libelle }))}
              value={tacheId}
              onChange={(e) => setTacheId(e.target.value)}
            />
            <Input
              label="Heures"
              required
              inputMode="decimal"
              placeholder="Ex. 7,5"
              value={heures}
              onChange={(e) => setHeures(e.target.value)}
              error={heures && !heuresOk ? 'Entre 0,25 et 24 h' : undefined}
              hint="Par quart d’heure : 7,5 = 7 h 30"
            />
            <Textarea label="Commentaire" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={500} />
            <Button type="submit" className="w-full" disabled={!ready} loading={pointer.isPending}>Envoyer</Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={<span className="capitalize">{libelleMois(d.mois)}</span>}
            description={`Validées : ${formatHeures(d.totaux.valide)} · en attente : ${formatHeures(d.totaux.soumis)}${d.totaux.refuse ? ` · refusées : ${formatHeures(d.totaux.refuse)}` : ''}`}
            actions={
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label="Mois précédent" icon={<ChevronLeft className="size-4" />} onClick={() => setMois(decaler(mois, -1))} />
                <Button size="sm" variant="ghost" aria-label="Mois suivant" icon={<ChevronRight className="size-4" />} disabled={mois >= moisCourant()} onClick={() => setMois(decaler(mois, 1))} />
              </div>
            }
          />
          {d.data.length === 0 ? (
            <EmptyState title="Aucune heure ce mois-ci" description="Pointez votre première journée avec le formulaire." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {d.data.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{formatDate(p.date)} · {formatHeures(p.heures)}</p>
                    <p className="text-xs text-slate-500">{p.chantier.reference}{p.tache && ` · ${p.tache.libelle}`}{p.commentaire && ` · ${p.commentaire}`}</p>
                    {p.statut === 'REFUSE' && p.motifRefus && <p className="mt-0.5 text-xs text-red-700">Refusé : {p.motifRefus}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={POINTAGE_STATUT[p.statut].tone}>{POINTAGE_STATUT[p.statut].label}</Badge>
                    {p.statut !== 'VALIDE' && (
                      <button type="button" className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Supprimer" onClick={() => setDeleting(p)}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Supprimer ce pointage"
        message={deleting ? `${formatDate(deleting.date)} · ${formatHeures(deleting.heures)} sur ${deleting.chantier.reference}` : ''}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast.success('Pointage supprimé'); setDeleting(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </>
  );
}
