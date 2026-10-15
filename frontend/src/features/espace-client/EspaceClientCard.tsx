import { ClipboardCopy, Globe, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useEnvoyerEspace, useEspaceLiens, useRevoquerEspace } from './api';

/** Office: give the client access to his online space (emailed link, no account). */
export function EspaceClientCard({ clientId, hasEmail }: { clientId: number; hasEmail: boolean }) {
  const liens = useEspaceLiens(clientId);
  const envoyer = useEnvoyerEspace(clientId);
  const revoquer = useRevoquerEspace(clientId);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const actif = liens.data?.find((l) => !l.revokedAt && new Date(l.expiresAt) > new Date());

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Globe className="size-4 text-brand-700" /> Espace client</span>}
        description="Devis, factures, avancement des chantiers et SAV, via un lien personnel."
      />
      <div className="space-y-3 p-5 text-sm">
        {actif ? (
          <p>
            <Badge tone="green">Actif</Badge> envoyé à {actif.destinataire} le {formatDate(actif.createdAt)}, valable jusqu’au {formatDate(actif.expiresAt)}.
            {actif.lastUsedAt && <span className="block text-xs text-slate-500">Dernière visite : {formatDateTime(actif.lastUsedAt)}</span>}
          </p>
        ) : (
          <p className="text-slate-500">Aucun lien actif.</p>
        )}
        {!hasEmail && <p className="text-xs text-amber-700">Ajoutez un email au client pour lui envoyer le lien.</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<Send className="size-4" />}
            disabled={!hasEmail}
            loading={envoyer.isPending}
            onClick={() =>
              envoyer.mutate(undefined, {
                onSuccess: (r) => {
                  setLastUrl(r.url);
                  if (r.emailSent) toast.success(`Lien envoyé à ${r.destinataire}`);
                  else toast.warning('Lien créé, mais l’email n’est pas parti : copiez-le pour le transmettre.');
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            {actif ? 'Renvoyer un nouveau lien' : 'Envoyer le lien'}
          </Button>
          {actif && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirm(true)}>Désactiver</Button>}
        </div>
        {lastUrl && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">
            <code className="flex-1 truncate">{lastUrl}</code>
            <button type="button" aria-label="Copier le lien" className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => void navigator.clipboard.writeText(lastUrl).then(() => toast.success('Lien copié'))}>
              <ClipboardCopy className="size-4" />
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        danger
        title="Désactiver l’espace client"
        message="Le lien envoyé ne fonctionnera plus. Vous pourrez en renvoyer un nouveau."
        confirmLabel="Désactiver"
        loading={revoquer.isPending}
        onConfirm={() => revoquer.mutate(undefined, { onSuccess: () => { toast.success('Lien désactivé'); setConfirm(false); setLastUrl(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </Card>
  );
}
