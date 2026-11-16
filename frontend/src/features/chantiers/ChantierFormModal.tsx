import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fromDateInput, fullName, toDateInput } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { ClientPicker } from '../devis/ClientPicker';
import { useUserOptions } from '../users/api';
import { useSaveChantier, type ChantierDetail } from './api';

/** Create a job site by hand (most come from a signed quote) or edit its header. */
export function ChantierFormModal({
  open,
  onClose,
  chantier,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  chantier?: ChantierDetail;
  onSaved?: (c: ChantierDetail) => void;
}) {
  const { hasRole } = useAuth();
  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const save = useSaveChantier();
  const chefs = useUserOptions(['CHEF_CHANTIER'], open && isBureau);

  const [clientId, setClientId] = useState<number | null>(null);
  const [adresse, setAdresse] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [chefId, setChefId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientId(chantier?.client.id ?? null);
    setAdresse(chantier?.adresse ?? '');
    setDescription(chantier?.description ?? '');
    setNotes(chantier?.notes ?? '');
    setChefId(chantier?.chefChantier ? String(chantier.chefChantier.id) : '');
    setDateDebut(toDateInput(chantier?.dateDebut));
    setDateFin(toDateInput(chantier?.dateFin));
  }, [open, chantier]);

  const invalidDates = Boolean(dateDebut && dateFin && dateFin < dateDebut);
  const canSubmit = adresse.trim() && (chantier || clientId) && !invalidDates;

  const submit = () =>
    save.mutate(
      {
        id: chantier?.id,
        ...(!chantier && { clientId: clientId! }),
        adresse: adresse.trim(),
        description: description.trim() || null,
        ...(chantier && { notes: notes.trim() || null }),
        ...(isBureau && { chefChantierId: chefId ? Number(chefId) : null }),
        dateDebut: fromDateInput(dateDebut),
        dateFin: fromDateInput(dateFin),
      },
      {
        onSuccess: (saved) => {
          toast.success(chantier ? 'Chantier modifié' : 'Chantier créé');
          onSaved?.(saved);
          onClose();
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={chantier ? `Modifier ${chantier.reference}` : 'Nouveau chantier'}
      description={chantier ? undefined : 'Les chantiers issus d’un devis signé sont créés automatiquement.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!canSubmit} loading={save.isPending}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!chantier && <ClientPicker value={clientId} onChange={setClientId} />}
        <Input label="Adresse du chantier" required value={adresse} onChange={(e) => setAdresse(e.target.value)} />
        {isBureau && (
          <Select
            label="Chef de chantier"
            placeholder="Non affecté"
            options={(chefs.data ?? []).map((u) => ({ value: u.id, label: fullName(u) }))}
            value={chefId}
            onChange={(e) => setChefId(e.target.value)}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Début prévu" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          <Input
            label="Fin prévue"
            type="date"
            value={dateFin}
            min={dateDebut || undefined}
            error={invalidDates ? 'La fin doit être après le début' : undefined}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
        <Textarea label="Description des travaux" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        {chantier && <Textarea label="Notes internes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      </div>
    </Modal>
  );
}
