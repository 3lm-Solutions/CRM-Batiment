import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select, statusOptions, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fromDateInput, fullName, toDateInput } from '@/lib/format';
import { useUserOptions } from '../users/api';
import { useSaveTache, type Tache, type TacheStatut } from './api';

export function TacheModal({ open, onClose, chantierId, tache }: { open: boolean; onClose: () => void; chantierId: number; tache?: Tache }) {
  const save = useSaveTache(chantierId);
  // Sous-traitant and chef accounts can be assigned (the API used to drop sous-traitants from this list)
  const people = useUserOptions(['CHEF_CHANTIER', 'SOUS_TRAITANT'], open);

  const [libelle, setLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [statut, setStatut] = useState<TacheStatut>('A_FAIRE');
  const [avancement, setAvancement] = useState(0);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [assignees, setAssignees] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setLibelle(tache?.libelle ?? '');
    setDescription(tache?.description ?? '');
    setStatut(tache?.statut ?? 'A_FAIRE');
    setAvancement(tache?.avancement ?? 0);
    setDateDebut(toDateInput(tache?.dateDebut));
    setDateFin(toDateInput(tache?.dateFin));
    setCommentaire(tache?.commentaire ?? '');
    setAssignees(tache?.affectations.map((a) => a.userId).filter((id): id is number => id !== null) ?? []);
  }, [open, tache]);

  const invalidDates = Boolean(dateDebut && dateFin && dateFin < dateDebut);
  const toggle = (id: number) => setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const submit = () =>
    save.mutate(
      {
        id: tache?.id,
        libelle: libelle.trim(),
        description: description.trim() || null,
        dateDebut: fromDateInput(dateDebut),
        dateFin: fromDateInput(dateFin),
        assigneeIds: assignees,
        ...(tache && { statut, avancement, commentaire: commentaire.trim() || null }),
      },
      {
        onSuccess: () => {
          toast.success(tache ? 'Tâche modifiée' : 'Tâche ajoutée');
          onClose();
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={tache ? 'Modifier la tâche' : 'Nouvelle tâche'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!libelle.trim() || invalidDates} loading={save.isPending}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Libellé" required value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. : Pose du carrelage salle de bain" />
        <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Début" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          <Input label="Fin" type="date" value={dateFin} min={dateDebut || undefined} error={invalidDates ? 'La fin doit être après le début' : undefined} onChange={(e) => setDateFin(e.target.value)} />
        </div>
        {tache && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Statut"
              options={statusOptions('tache')}
              value={statut}
              onChange={(e) => {
                const s = e.target.value as TacheStatut;
                setStatut(s);
                if (s === 'TERMINEE') setAvancement(100);
              }}
            />
            <Input
              label={`Avancement (${avancement} %)`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={avancement}
              className="accent-brand-700 px-0 shadow-none"
              onChange={(e) => setAvancement(Number(e.target.value))}
            />
          </div>
        )}
        {tache && <Textarea label="Commentaire" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />}
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Affectée à</legend>
          <p className="mb-2 text-xs text-slate-500">Un sous-traitant affecté voit ce chantier et sa tâche dans son espace.</p>
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            {(
              [
                ['SOUS_TRAITANT', 'Sous-traitants', 'Aucun compte sous-traitant actif — l’administrateur peut en créer un (Utilisateurs).'],
                ['CHEF_CHANTIER', 'Chefs de chantier', 'Aucun chef de chantier actif.'],
              ] as const
            ).map(([role, title, empty]) => {
              const group = (people.data ?? []).filter((u) => u.role === role);
              return (
                <div key={role}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
                  {people.data && group.length === 0 && <p className="text-sm text-slate-500">{empty}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="size-4 rounded accent-brand-700" checked={assignees.includes(u.id)} onChange={() => toggle(u.id)} />
                        {fullName(u)}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      </div>
    </Modal>
  );
}
