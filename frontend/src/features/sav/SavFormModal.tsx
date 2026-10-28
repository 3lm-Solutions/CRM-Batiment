import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select, statusOptions, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, fromDateInput, fullName, toDateInput } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { ClientPicker } from '../devis/ClientPicker';
import { useUserOptions } from '../users/api';
import { SAV_CATEGORIES, useSavChantiers, useSaveSav, type SavCategorie, type SavPriorite, type SavTicket } from './api';

export function SavFormModal({ open, onClose, ticket, onSaved }: { open: boolean; onClose: () => void; ticket?: SavTicket; onSaved?: (t: SavTicket) => void }) {
  const save = useSaveSav();
  const staff = useUserOptions(['ADMIN', 'TECHNICO', 'ASSISTANTE', 'CHEF_CHANTIER'], open);
  const [clientId, setClientId] = useState<number | null>(null);
  // Étape 2 (26/10): a ticket goes on a finished job site, within the SAV period (the ADMIN may override)
  const chantiers = useSavChantiers(clientId, open && !ticket);
  const admin = useAuth().hasRole('ADMIN');

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

  const liste = chantiers.data?.chantiers ?? [];
  const choisi = liste.find((c) => String(c.id) === chantierId);
  const proposes = admin ? liste : liste.filter((c) => c.savPossible);
  // Without the rule: no job site, or one not finished / out of period — the ADMIN only
  const horsRegle = !ticket && !!clientId && (!choisi || !choisi.savPossible);
  const ready = titre.trim() && description.trim() && (ticket || (clientId && (!horsRegle || admin)));

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
        {!ticket && <ClientPicker value={clientId} onChange={(id) => { setClientId(id); setChantierId(''); }} />}
        {!ticket && clientId && (
          <>
            <Select
              label="Chantier concerné"
              required={!admin}
              placeholder={admin ? 'Aucun (exception administrateur)' : 'Choisir un chantier terminé…'}
              options={proposes.map((c) => ({
                value: c.id,
                label: `${c.reference} · ${c.adresse} — ${c.savPossible ? (c.savJusquau ? `SAV jusqu’au ${formatDate(c.savJusquau)}` : 'SAV sans limite') : c.statut === 'TERMINE' || c.statut === 'CLOTURE' ? 'délai SAV dépassé' : 'travaux en cours'}`,
              }))}
              value={chantierId}
              onChange={(e) => setChantierId(e.target.value)}
            />
            {!chantiers.isPending && !admin && proposes.length === 0 && (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Aucun chantier terminé dans la période de SAV ({chantiers.data?.savDureeMois ? `${chantiers.data.savDureeMois} mois` : 'sans limite'}) pour ce client : le ticket ne peut pas être ouvert. Un administrateur peut faire une exception.
              </p>
            )}
            {admin && horsRegle && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Exception administrateur : {!choisi ? 'aucun chantier terminé n’est choisi' : choisi.statut === 'TERMINE' || choisi.statut === 'CLOTURE' ? 'le délai de SAV de ce chantier est dépassé' : 'ce chantier n’est pas terminé'}. Le ticket sera ouvert quand même et l’exception notée dans le ticket.
              </p>
            )}
          </>
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
