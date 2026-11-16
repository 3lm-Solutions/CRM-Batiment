import { BellRing } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { type RelanceCible, useRelancer, useRelances } from './api';

/**
 * « Relances » block of a quote waiting for the client or of an unpaid invoice (C3 of 21/10):
 * history of the reminders sent (automatic or by hand) and « Relancer maintenant ».
 */
export function RelancesCard({
  cible,
  canRelancer,
  description,
}: {
  cible: RelanceCible;
  /** The quote / invoice can be reminded now (status, client email, office role) */
  canRelancer: boolean;
  description?: string;
}) {
  const relances = useRelances(cible);
  const relancer = useRelancer(cible);
  const [confirm, setConfirm] = useState(false);
  const isDevis = 'devisId' in cible;
  const list = relances.data ?? [];

  return (
    <Card className="print:hidden">
      <CardHeader
        title="Relances"
        description={description}
        actions={
          canRelancer && (
            <Button size="sm" variant="outline" icon={<BellRing className="size-4" />} onClick={() => setConfirm(true)}>
              Relancer maintenant
            </Button>
          )
        }
      />
      <div className="p-5 text-sm">
        {relances.isPending ? (
          <p className="text-slate-500">Chargement…</p>
        ) : list.length === 0 ? (
          <p className="text-slate-500">Aucune relance envoyée.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.automatique ? `Relance automatique n°${r.niveau}` : `Relance par ${r.user ? [r.user.prenom, r.user.nom].filter(Boolean).join(' ') : 'l’équipe'}`}
                  </p>
                  <p className="truncate text-xs text-slate-500">{formatDateTime(r.createdAt)} · {r.destinataire}</p>
                </div>
                {r.emailEnvoye ? <Badge tone="green">Envoyée</Badge> : <Badge tone="red">Échec email</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Relancer le client"
        message={
          isDevis
            ? 'Un email de relance part au client avec un nouveau lien vers le devis.'
            : 'Un email de rappel de paiement part au client avec le montant et l’échéance.'
        }
        confirmLabel="Envoyer la relance"
        loading={relancer.isPending}
        onConfirm={() =>
          relancer.mutate(undefined, {
            onSuccess: (r) => {
              setConfirm(false);
              if (r.emailEnvoye) toast.success('Relance envoyée');
              else toast.warning('Relance enregistrée, mais l’email n’a pas pu partir.');
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </Card>
  );
}
