import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select, statusOptions, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fromDateInput, fullName, toDateInput } from '@/lib/format';
import { useChantiers } from '../chantiers/api';
import { ClientPicker } from '../devis/ClientPicker';
import { useUserOptions } from '../users/api';
import { SAV_CATEGORIES, useSaveSav, type SavCategorie, type SavPriorite, type SavTicket } from './api';

export function SavFormModal({ open, onClose, ticket, onSaved }: { open: boolean; onClose: () => void; ticket?: SavTicket; onSaved?: (t: SavTicket) => void }) {
  const save = useSaveSav();
  const staff = useUserOptions(['ADMIN', 'TECHNICO', 'ASSISTANTE', 'CHEF_CHANTIER'], open);
  const [clientId, setClientId] = useState<number | null>(null);
  const chantiers = useChantiers({ page: 1, limit: 100, clientId: clientId ?? undefined }, open && !ticket && !!clientId);

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<SavPriorite>('NORMALE');
  const [categorie, setCategorie] = useState<SavCategorie>('AUTRE');
  const [assignedToId, setAssignedToId] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [echeance, setEcheance] = useState('');

  useEffect(() => {
    if (!open) return;
    setClientId(ticket?.client.id ?? null);
    setTitre(ticket?.titre ?? '');
    setDescription(ticket?.description ?? '');
    setPriorite(ticket?.priorite ?? 'NORMALE');
    setCategorie(ticket?.categorie ?? 'AUTRE');
    setAssignedToId(ticket?.assignedTo ? String(ticket.assignedTo.id) : '');
    setChantierId('');
    setEcheance(toDateInput(ticket?.dateEcheance));
  }, [open, ticket]);

  const ready = titre.trim() && description.trim() && (ticket || clientId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={ticket ? `Modifier ${ticket.reference}` : 'Nouveau ticket SAV'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!ready}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: ticket?.id,
                  ...(!ticket && { clientId: clientId!, chantierId: chantierId ? Number(chantierId) : undefined }),
                  titre: titre.trim(),
                  description: description.trim(),
                  priorite,
                  categorie,
                  assignedToId: assignedToId ? Number(assignedToId) : ticket ? null : undefined,
                  dateEcheance: fromDateInput(echeance) ?? (ticket ? null : undefined),
                },
                {
                  onSuccess: (t) => {
                    toast.success(ticket ? 'Ticket modifié' : `Ticket ${t.reference} créé`);
                    onSaved?.(t);
                    onClose();
                  },
                },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!ticket && <ClientPicker value={clientId} onChange={setClientId} />}
        {!ticket && clientId && (
          <Select
            label="Chantier concerné"
            placeholder="Aucun"
            options={(chantiers.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.reference} · ${c.adresse}` }))}
            value={chantierId}
            onChange={(e) => setChantierId(e.target.value)}
          />
        )}
        <Input label="Titre" required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Joint de douche qui fuit" />
        <Textarea label="Description" required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Priorité" options={statusOptions('priorite')} value={priorite} onChange={(e) => setPriorite(e.target.value as SavPriorite)} />
          <Select label="Catégorie" options={Object.entries(SAV_CATEGORIES).map(([value, label]) => ({ value, label }))} value={categorie} onChange={(e) => setCategorie(e.target.value as SavCategorie)} />
          <Select label="Assigné à" placeholder="Personne" options={(staff.data ?? []).map((u) => ({ value: u.id, label: fullName(u) }))} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} />
          <Input label="Échéance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </div>
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      </div>
    </Modal>
  );
}
