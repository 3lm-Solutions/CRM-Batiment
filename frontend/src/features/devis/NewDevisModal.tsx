import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useCreateDevis } from './api';
import { ClientPicker } from './ClientPicker';

/** Choose a client → empty draft → straight into the editor. */
export function NewDevisModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateDevis();
  const [clientId, setClientId] = useState<number | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau devis"
      description="Le devis est créé en brouillon ; vous ajoutez ensuite les lignes."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!clientId}
            loading={create.isPending}
            onClick={() => create.mutate({ clientId: clientId! }, { onSuccess: (d) => navigate(`/devis/${d.id}`) })}
          >
            Créer le brouillon
          </Button>
        </>
      }
    >
      <ClientPicker value={clientId} onChange={setClientId} />
      <p className="mt-3 text-xs text-slate-500">Client absent ? Créez-le d’abord depuis la page Clients.</p>
      {create.isError && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage(create.error)}</p>}
    </Modal>
  );
}
