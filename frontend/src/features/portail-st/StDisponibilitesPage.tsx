import { CalendarCheck2, CalendarX2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, Input, Loading, PageHeader } from '@/components/ui';
import { errorMessage, toProblem } from '@/lib/api';
import { formatDate, fromDateInput, toDateInput } from '@/lib/format';
import { useAjouterDisponibilite, useStDisponibilites, useSupprimerDisponibilite, type StDisponibilite } from './api';

/**
 * The sous-traitant enters his own availabilities (E7 of 20/10, spec « Portail sous-traitant »).
 * The company sees them on his record (Sous-traitants › Disponibilités).
 */
export function StDisponibilitesPage() {
  const list = useStDisponibilites();
  const add = useAjouterDisponibilite();
  const remove = useSupprimerDisponibilite();
  const [debut, setDebut] = useState(toDateInput(new Date()));
  const [fin, setFin] = useState('');
  const [disponible, setDisponible] = useState(true);
  const [notes, setNotes] = useState('');
  const [deleting, setDeleting] = useState<StDisponibilite | null>(null);
  const ready = !!debut && !!fin && fin >= debut;

  if (list.isPending) return <Loading />;
  if (list.isError) {
    // 403: the account is not linked to a sous-traitant record yet
    if (toProblem(list.error).status === 403) {
      return (
        <>
          <PageHeader title="Mes disponibilités" />
          <Card><EmptyState title="Dossier non rattaché" description="Votre compte n’est pas encore lié à une fiche sous-traitant. Contactez l’entreprise." /></Card>
        </>
      );
    }
    return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  }

  const submit = () =>
    add.mutate(
      { dateDebut: fromDateInput(debut)!, dateFin: fromDateInput(fin)!, disponible, notes: notes.trim() || null },
      {
        onSuccess: () => { toast.success('Période ajoutée'); setFin(''); setNotes(''); },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <>
      <PageHeader title="Mes disponibilités" description="Indiquez quand vous êtes disponible ou indisponible : l’entreprise en tient compte pour planifier les chantiers." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Nouvelle période" />
          <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (ready) submit(); }}>
            <div className="grid grid-cols-2 gap-3">
              <Input id="dispo-debut" label="Du" type="date" required value={debut} onChange={(e) => setDebut(e.target.value)} />
              <Input id="dispo-fin" label="Au" type="date" required min={debut || undefined} value={fin} onChange={(e) => setFin(e.target.value)} error={fin && debut && fin < debut ? 'Avant la date de début' : undefined} />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Je suis…</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="dispo-etat" className="accent-brand-700" checked={disponible} onChange={() => setDisponible(true)} /> Disponible</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="dispo-etat" className="accent-brand-700" checked={!disponible} onChange={() => setDisponible(false)} /> Indisponible (congés, autre chantier…)</label>
            </fieldset>
            <Input id="dispo-notes" label="Précision" placeholder="Ex. : le matin seulement" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button type="submit" className="w-full" disabled={!ready} loading={add.isPending}>Ajouter la période</Button>
          </form>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Périodes en cours et à venir" />
          {list.data.length === 0 ? (
            <EmptyState title="Aucune période" description="Ajoutez vos disponibilités ou vos absences à venir." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {d.disponible ? <CalendarCheck2 className="size-5 shrink-0 text-emerald-600" aria-hidden /> : <CalendarX2 className="size-5 shrink-0 text-red-600" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatDate(d.dateDebut)} → {formatDate(d.dateFin)} ·{' '}
                      <span className={d.disponible ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}>{d.disponible ? 'Disponible' : 'Indisponible'}</span>
                    </p>
                    {d.notes && <p className="text-slate-500">{d.notes}</p>}
                  </div>
                  <Button variant="ghost" size="sm" aria-label={`Supprimer la période du ${formatDate(d.dateDebut)}`} icon={<Trash2 className="size-4 text-red-600" />} onClick={() => setDeleting(d)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        danger
        title="Supprimer cette période ?"
        message={deleting ? `${formatDate(deleting.dateDebut)} → ${formatDate(deleting.dateFin)}` : ''}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => { toast.success('Période supprimée'); setDeleting(null); },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </>
  );
}
