import { Archive, ArchiveRestore, FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatEuros, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { EspaceClientCard } from '../espace-client/EspaceClientCard';
import { useCreateDevis } from '../devis/api';
import { LEAD_SOURCES, useClient, useClientAction } from './api';
import { ClientFormModal } from './ClientFormModal';

export function ClientDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const client = useClient(id);
  const action = useClientAction();
  const newDevis = useCreateDevis();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (client.isPending) return <Loading />;
  if (client.isError) return <ErrorState error={client.error} onRetry={() => void client.refetch()} />;
  const c = client.data;

  const run = (act: 'archive' | 'unarchive' | 'delete') =>
    action.mutate(
      { id, action: act },
      {
        onSuccess: () => {
          toast.success(act === 'delete' ? 'Client supprimé' : act === 'archive' ? 'Client archivé' : 'Client réactivé');
          if (act === 'delete') navigate('/clients');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <>
      <PageHeader
        title={fullName(c)}
        description={c.archivedAt ? `Archivé le ${formatDate(c.archivedAt)}` : `Client depuis le ${formatDate(c.createdAt)}`}
        actions={
          canWrite && (
            <>
              {!c.archivedAt && (
                <Button
                  icon={<FilePlus2 className="size-4" />}
                  loading={newDevis.isPending}
                  onClick={() => newDevis.mutate({ clientId: id }, { onSuccess: (d) => navigate(`/devis/${d.id}`), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  Nouveau devis
                </Button>
              )}
              <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Modifier</Button>
              <Button variant="outline" icon={c.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />} onClick={() => run(c.archivedAt ? 'unarchive' : 'archive')}>
                {c.archivedAt ? 'Réactiver' : 'Archiver'}
              </Button>
              {hasRole('ADMIN') && <Button variant="ghost" aria-label="Supprimer" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => setDeleting(true)} />}
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
        <Card>
          <CardHeader title="Coordonnées" />
          <dl className="space-y-3 p-5 text-sm">
            {[
              ['Email', c.email],
              ['Téléphone', c.telephone],
              ['Adresse', c.adresseClient],
              ['Adresse du chantier', c.adresseChantier],
              ['Origine', LEAD_SOURCES[c.source]],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium">{value || '—'}</dd>
              </div>
            ))}
            <div>
              <dt className="text-slate-500">Types de projet</dt>
              <dd className="mt-1 flex flex-wrap gap-1">{c.typeProjets.length ? c.typeProjets.map((t) => <Badge key={t.id}>{t.nom}</Badge>) : '—'}</dd>
            </div>
            {c.besoin && <div><dt className="text-slate-500">Besoin</dt><dd className="whitespace-pre-line">{c.besoin}</dd></div>}
            {c.notes && <div><dt className="text-slate-500">Notes internes</dt><dd className="whitespace-pre-line">{c.notes}</dd></div>}
          </dl>
        </Card>
        {canWrite && !c.archivedAt && <EspaceClientCard clientId={c.id} hasEmail={!!c.email} />}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Devis" description={`${c._count.devis} au total`} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {c.devis.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucun devis.</li>}
              {c.devis.map((d) => (
                <li key={d.id}>
                  <Link to={`/devis/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="font-medium">{d.reference}</span>
                    <span className="flex items-center gap-3"><span className="tabular-nums">{formatEuros(d.totalTTC)}</span><StatusBadge kind="devis" value={d.statut} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Demandes de devis" description={`${c._count.demandesDevis} au total`} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {c.demandesDevis.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune demande.</li>}
              {c.demandesDevis.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{d.reference}</span>
                  <span className="flex items-center gap-3"><span className="text-slate-500">{formatDate(d.createdAt)}</span><StatusBadge kind="demande" value={d.statut} /></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Chantiers" description={`${c._count.chantiers} au total · ${c._count.savTickets} ticket(s) SAV`} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {c.chantiers.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucun chantier.</li>}
              {c.chantiers.map((ch) => (
                <li key={ch.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span><Link to={`/chantiers/${ch.id}`} className="font-medium hover:underline">{ch.reference}</Link> <span className="text-slate-500">· {ch.adresse}</span></span>
                  <StatusBadge kind="chantier" value={ch.statut} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ClientFormModal open={editing} onClose={() => setEditing(false)} client={c} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => run('delete')}
        loading={action.isPending}
        danger
        title="Supprimer ce client ?"
        message="Possible uniquement pour un client sans aucun historique (saisi par erreur). Sinon, archivez-le : ses devis et factures sont conservés."
      />
    </>
  );
}
