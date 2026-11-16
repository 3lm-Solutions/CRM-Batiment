import { ArrowLeft, Eye, Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Loading, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { SAV_CATEGORIES, useAddSavNote, useSavAction, useSavTicket, type SavAction, type SavStatut } from './api';
import { SavFormModal } from './SavFormModal';
import { SavPhotosCard } from './SavPhotosCard';

const ACTIONS: Record<SavStatut, { action: SavAction; label: string; variant?: 'primary' | 'outline' | 'success' }[]> = {
  OUVERT: [{ action: 'prendre-en-charge', label: 'Prendre en charge' }, { action: 'resoudre', label: 'Résoudre', variant: 'success' }, { action: 'cloturer', label: 'Clôturer', variant: 'outline' }],
  EN_COURS: [{ action: 'resoudre', label: 'Résoudre', variant: 'success' }, { action: 'attente-client', label: 'En attente du client', variant: 'outline' }, { action: 'cloturer', label: 'Clôturer', variant: 'outline' }],
  EN_ATTENTE_CLIENT: [{ action: 'prendre-en-charge', label: 'Reprendre' }, { action: 'resoudre', label: 'Résoudre', variant: 'success' }, { action: 'cloturer', label: 'Clôturer', variant: 'outline' }],
  RESOLU: [{ action: 'cloturer', label: 'Clôturer' }, { action: 'rouvrir', label: 'Rouvrir', variant: 'outline' }],
  CLOTURE: [],
};

export function SavDetailPage() {
  const id = Number(useParams().id);
  // 29/10: the client page and the invoices are office-only
  const isBureau = useAuth().hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const ticket = useSavTicket(id);
  const action = useSavAction(id);
  const addNote = useAddSavNote(id);
  const [note, setNote] = useState('');
  const [pourClient, setPourClient] = useState(false);
  const [resolutionPourClient, setResolutionPourClient] = useState(true);
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState('');

  if (ticket.isPending) return <Loading />;
  if (ticket.isError) return <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />;
  const t = ticket.data;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const run = (a: SavAction, n?: string) =>
    action.mutate({ action: a, note: n, visibleClient: a === 'resoudre' && resolutionPourClient }, { onSuccess: () => { toast.success('Ticket mis à jour'); setResolving(false); setResolution(''); }, onError });

  return (
    <>
      <Link to="/sav" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> SAV
      </Link>
      <PageHeader
        title={`${t.reference} · ${t.titre}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="sav" value={t.statut} />
            <StatusBadge kind="priorite" value={t.priorite} />
            <span>{SAV_CATEGORIES[t.categorie]}</span>
          </span>
        }
        actions={
          <>
            {ACTIONS[t.statut].map((a) => (
              <Button key={a.action} variant={a.variant ?? 'primary'} loading={action.isPending && action.variables?.action === a.action} onClick={() => (a.action === 'resoudre' ? setResolving(true) : run(a.action))}>
                {a.label}
              </Button>
            ))}
            {t.statut !== 'CLOTURE' && <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Modifier</Button>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Description" description={`Ouvert le ${formatDateTime(t.createdAt)} par ${t.createur ? fullName(t.createur) : 'le client (espace en ligne)'}`} />
            <p className="whitespace-pre-line p-5 text-sm">{t.description}</p>
          </Card>
          <SavPhotosCard ticketId={t.id} photos={t.photos ?? []} readOnly={t.statut === 'CLOTURE'} />
          <Card>
            <CardHeader
              title="Suivi"
              description={`${t.notes.length} note(s) · notes internes, réponses au client (visibles dans son espace et envoyées par email) et messages du client. Chaque changement de statut lui est envoyé par email.`}
            />
            <ol className="space-y-4 p-5">
              {t.notes.length === 0 && <li className="text-sm text-slate-500">Aucune note.</li>}
              {t.notes.map((n) => (
                <li key={n.id} className={n.visibleClient ? 'rounded-xl border border-brand-100 bg-brand-100/40 p-3 text-sm dark:border-slate-700 dark:bg-slate-800' : 'rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60'}>
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {n.user ? fullName(n.user) : 'Client'} · {formatDateTime(n.createdAt)}
                    {n.user && (n.visibleClient ? <Badge tone="blue">Réponse au client</Badge> : <Badge>Note interne</Badge>)}
                  </p>
                  <p className="whitespace-pre-line">{n.contenu}</p>
                </li>
              ))}
            </ol>
            {t.statut !== 'CLOTURE' && (
              <div className="space-y-2 border-t border-slate-100 p-4 dark:border-slate-800">
                <div className="flex items-end gap-2">
                  <Textarea
                    aria-label="Nouvelle note"
                    containerClassName="flex-1"
                    rows={2}
                    placeholder={pourClient ? 'Votre réponse au client…' : 'Appel, intervention, échange avec le client…'}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    icon={<Send className="size-4" />}
                    disabled={!note.trim()}
                    loading={addNote.isPending}
                    onClick={() =>
                      addNote.mutate(
                        { contenu: note.trim(), visibleClient: pourClient },
                        { onSuccess: () => { setNote(''); if (pourClient) toast.success('Réponse envoyée au client'); }, onError },
                      )
                    }
                  >
                    {pourClient ? 'Répondre' : 'Ajouter'}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-brand-700" checked={pourClient} onChange={(e) => setPourClient(e.target.checked)} />
                  <Eye className="size-4 text-slate-500" /> Réponse au client (visible dans son espace, envoyée par email)
                </label>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-6">
        <Card>
          <CardHeader title="Informations" />
          <dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-xs text-slate-500">Client</dt><dd>{isBureau ? <Link to={`/clients/${t.client.id}`} className="font-medium hover:underline">{fullName(t.client)}</Link> : <span className="font-medium">{fullName(t.client)}</span>}{t.client.telephone && ` · ${t.client.telephone}`}</dd></div>
            <div><dt className="text-xs text-slate-500">Assigné à</dt><dd>{t.assignedTo ? fullName(t.assignedTo) : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Échéance</dt><dd>{formatDate(t.dateEcheance)}</dd></div>
            {t.chantier && <div><dt className="text-xs text-slate-500">Chantier</dt><dd><Link to={`/chantiers/${t.chantier.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{t.chantier.reference}</Link></dd></div>}
            {t.devis && <div><dt className="text-xs text-slate-500">Devis</dt><dd><Link to={`/devis/${t.devis.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{t.devis.reference}</Link></dd></div>}
            {isBureau && t.facture && <div><dt className="text-xs text-slate-500">Facture</dt><dd><Link to={`/factures/${t.facture.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{t.facture.reference ?? 'Brouillon'}</Link></dd></div>}
            {t.dateResolution && <div><dt className="text-xs text-slate-500">Résolu le</dt><dd>{formatDateTime(t.dateResolution)}</dd></div>}
          </dl>
        </Card>
        {t.historique && t.historique.length > 0 && (
          <Card>
            <CardHeader title="Historique des statuts" description="Le client voit les mêmes étapes dans son espace" />
            <ol className="space-y-2 p-5 text-sm">
              {t.historique.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="sav" value={h.statut} />
                  <span className="text-xs text-slate-500">{formatDateTime(h.createdAt)} · {h.user ? fullName(h.user) : 'client'}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
        </div>
      </div>
      <SavFormModal open={editing} onClose={() => setEditing(false)} ticket={t} />
      <ConfirmDialog open={resolving} onClose={() => setResolving(false)} title="Résoudre le ticket" message="Décrivez la solution apportée (ajoutée au suivi)." confirmLabel="Résoudre" loading={action.isPending} onConfirm={() => run('resoudre', resolution.trim())}>
        <Textarea label="Solution" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-700" checked={resolutionPourClient} onChange={(e) => setResolutionPourClient(e.target.checked)} />
          Envoyer cette solution au client (espace client + email)
        </label>
      </ConfirmDialog>
    </>
  );
}
