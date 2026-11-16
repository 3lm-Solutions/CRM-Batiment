import { CheckCircle2, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AuthImage } from '@/components/files/AuthImage';
import { Badge, Button, Card, CardHeader, ErrorState, Loading, Select } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { openFichier } from '@/lib/files';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { useActionRetour, useRetoursClient, type RetourClient, type RetourStatut, type RetourType } from './api';

/**
 * « Retours client » of a job site (Étape 6 of 26/10): comments and alerts sent from the client
 * space, open alerts first. The chef / ADMIN / ASSISTANTE answers — the answer is shown in the
 * client space and emailed to him — and marks it handled; the TECHNICO reads.
 */
export function RetoursClientCard({ chantierId, canRepondre }: { chantierId: number; canRepondre: boolean }) {
  const [statut, setStatut] = useState<RetourStatut | ''>('');
  const [type, setType] = useState<RetourType | ''>('');
  const retours = useRetoursClient(chantierId, { statut: statut || undefined, type: type || undefined });
  const t = retours.data?.totaux;

  return (
    <Card>
      <CardHeader
        title="Retours client"
        description={t ? `${t.alertesOuvertes} alerte(s) et ${t.commentairesOuverts} commentaire(s) en attente — envoyés depuis l’espace client` : 'Commentaires et alertes envoyés depuis l’espace client'}
      />
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 dark:border-slate-800">
        <Select aria-label="Statut" placeholder="Tous les statuts" options={[{ value: 'OUVERT', label: 'À traiter' }, { value: 'TRAITE', label: 'Traités' }]} value={statut} onChange={(e) => setStatut(e.target.value as RetourStatut | '')} />
        <Select aria-label="Type" placeholder="Alertes et commentaires" options={[{ value: 'ALERTE', label: 'Alertes' }, { value: 'COMMENTAIRE', label: 'Commentaires' }]} value={type} onChange={(e) => setType(e.target.value as RetourType | '')} />
      </div>
      {retours.isPending ? (
        <Loading />
      ) : retours.isError ? (
        <div className="p-4"><ErrorState error={retours.error} onRetry={() => void retours.refetch()} /></div>
      ) : retours.data.data.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Aucun message du client{statut || type ? ' pour ces filtres' : ''}. Il peut commenter les tâches et les photos validées depuis son espace client.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {retours.data.data.map((r) => <RetourItem key={r.id} r={r} chantierId={chantierId} canRepondre={canRepondre} />)}
        </ul>
      )}
    </Card>
  );
}

function RetourItem({ r, chantierId, canRepondre }: { r: RetourClient; chantierId: number; canRepondre: boolean }) {
  const action = useActionRetour(chantierId);
  const [reponse, setReponse] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const alerte = r.type === 'ALERTE';
  const run = (input: Parameters<typeof action.mutate>[0], ok: string) =>
    action.mutate(input, { onSuccess: () => { toast.success(ok); setReponse(''); setOuvert(false); }, onError: (e) => toast.error(errorMessage(e)) });

  return (
    <li className={cn('space-y-2 px-5 py-4', alerte && r.statut === 'OUVERT' && 'border-l-4 border-red-500 bg-red-50/60 dark:bg-red-950/20')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {alerte ? <Badge tone="red">Alerte</Badge> : <Badge tone="blue">Commentaire</Badge>}
        {r.statut === 'OUVERT' ? <Badge tone="amber">À traiter</Badge> : <Badge tone="green">Traité</Badge>}
        <span>{formatDateTime(r.createdAt)}</span>
        <span>· {r.tache ? `tâche « ${r.tache.libelle} »` : 'tout le chantier'}</span>
        {r.photo && <span>· photo {r.photo.moment === 'AVANT' ? 'avant' : 'après'} du {formatDate(r.photo.date)}</span>}
      </div>
      <div className="flex gap-3">
        {r.photo && (
          <AuthImage path={`/fichiers/${r.photo.fichierId}/contenu`} alt="Photo commentée" className="size-16 shrink-0 rounded-lg" onClick={() => void openFichier(r.photo!.fichierId)} />
        )}
        <p className="whitespace-pre-line text-sm">{r.message}</p>
      </div>
      {r.reponse && (
        <div className="border-l-2 border-brand-700 pl-3 text-sm">
          <p className="text-xs font-semibold text-brand-700 dark:text-blue-300">Réponse{r.reponduPar ? ` de ${fullName(r.reponduPar)}` : ''}{r.reponduLe ? ` · ${formatDateTime(r.reponduLe)}` : ''}</p>
          <p className="whitespace-pre-line">{r.reponse}</p>
        </div>
      )}
      {r.statut === 'TRAITE' && r.traitePar && <p className="text-xs text-slate-500">Traité par {fullName(r.traitePar)}{r.traiteLe ? ` le ${formatDate(r.traiteLe)}` : ''}</p>}
      {canRepondre && (
        <div className="space-y-2">
          {ouvert ? (
            <>
              <textarea
                aria-label="Réponse au client"
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Votre réponse (visible dans l’espace client et envoyée par email)…"
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<Send className="size-4" />} disabled={!reponse.trim()} loading={action.isPending} onClick={() => run({ id: r.id, action: 'repondre', reponse: reponse.trim(), traite: true }, 'Réponse envoyée, marqué traité')}>
                  Répondre et marquer traité
                </Button>
                <Button size="sm" variant="outline" disabled={!reponse.trim()} loading={action.isPending} onClick={() => run({ id: r.id, action: 'repondre', reponse: reponse.trim(), traite: false }, 'Réponse envoyée')}>
                  Répondre seulement
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOuvert(false)}>Annuler</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={<Send className="size-4" />} onClick={() => setOuvert(true)}>{r.reponse ? 'Répondre à nouveau' : 'Répondre'}</Button>
              {r.statut === 'OUVERT' ? (
                <Button size="sm" variant="ghost" icon={<CheckCircle2 className="size-4" />} loading={action.isPending} onClick={() => run({ id: r.id, action: 'traiter' }, 'Marqué traité')}>Marquer traité</Button>
              ) : (
                <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} loading={action.isPending} onClick={() => run({ id: r.id, action: 'rouvrir' }, 'Rouvert')}>Rouvrir</Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
