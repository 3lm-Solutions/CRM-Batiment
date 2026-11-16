import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, DataTable, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, fullName } from '@/lib/format';
import { useUserOptions } from '../users/api';
import { useDemoAction, useDemoRequest, useDemoRequests, useUpdateDemo, type DemoAction, type DemoRequest, type DemoStatut } from './api';

const TABS: { value: string; label: string; statuts?: DemoStatut[] }[] = [
  { value: 'todo', label: 'À traiter', statuts: ['PENDING', 'CONTACTED', 'SCHEDULED'] },
  { value: 'done', label: 'Terminées', statuts: ['DONE'] },
  { value: 'canceled', label: 'Annulées', statuts: ['CANCELED'] },
  { value: 'all', label: 'Toutes' },
];

const NEXT: Partial<Record<DemoStatut, { action: DemoAction; label: string; variant?: 'primary' | 'outline' | 'success' }[]>> = {
  PENDING: [{ action: 'contacter', label: 'Marquer contacté' }, { action: 'planifier', label: 'Planifier la démo', variant: 'outline' }],
  CONTACTED: [{ action: 'planifier', label: 'Planifier la démo' }],
  SCHEDULED: [{ action: 'terminer', label: 'Démo faite', variant: 'success' }, { action: 'planifier', label: 'Replanifier', variant: 'outline' }],
};

function DemoModal({ demo, onClose }: { demo: DemoRequest | null; onClose: () => void }) {
  const update = useUpdateDemo();
  const action = useDemoAction();
  const users = useUserOptions(['ADMIN', 'TECHNICO'], !!demo);
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dateDemo, setDateDemo] = useState('');
  const [planning, setPlanning] = useState(false);
  useEffect(() => {
    setNotes(demo?.notes ?? '');
    setAssignee(demo?.assignedTo ? String(demo.assignedTo.id) : '');
    setDateDemo('');
    setPlanning(false);
  }, [demo]);
  if (!demo) return null;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const run = (a: DemoAction) => {
    if (a === 'planifier' && !planning) return setPlanning(true);
    action.mutate(
      { id: demo.id, action: a, dateDemo: a === 'planifier' ? new Date(dateDemo).toISOString() : undefined },
      { onSuccess: () => { toast.success('Demande mise à jour'); onClose(); }, onError },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${fullName(demo)}${demo.entreprise ? ` · ${demo.entreprise}` : ''}`}
      description={`Reçue le ${formatDateTime(demo.createdAt)}`}
      footer={
        <>
          {demo.statut !== 'DONE' && demo.statut !== 'CANCELED' && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => run('annuler')}>Annuler la demande</Button>}
          <Button
            variant="outline"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: demo.id, notes: notes.trim() || null, assignedToId: assignee ? Number(assignee) : null },
                { onSuccess: () => toast.success('Enregistré'), onError },
              )
            }
          >
            Enregistrer
          </Button>
          {(NEXT[demo.statut] ?? []).map((n) => (
            <Button key={n.action} variant={n.variant ?? 'primary'} disabled={n.action === 'planifier' && planning && !dateDemo} loading={action.isPending && action.variables?.action === n.action} onClick={() => run(n.action)}>
              {n.label}
            </Button>
          ))}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="demo" value={demo.statut} />
          {demo.dateDemo && <span>Démo le {formatDateTime(demo.dateDemo)}</span>}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="flex items-center gap-1">
              <a href={`mailto:${demo.email}`} className="text-brand-700 hover:underline dark:text-blue-300">{demo.email}</a>
              <button type="button" aria-label="Copier l’email" className="rounded p-1 text-slate-400 hover:text-slate-700" onClick={() => void navigator.clipboard.writeText(demo.email).then(() => toast.success('Email copié'))}>
                <Copy className="size-3.5" />
              </button>
            </dd>
          </div>
          <div><dt className="text-xs text-slate-500">Téléphone</dt><dd>{demo.telephone ? <a href={`tel:${demo.telephone}`} className="hover:underline">{demo.telephone}</a> : '—'}</dd></div>
        </dl>
        {demo.message && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">{demo.message}</p>}
        {planning && <Input label="Date et heure de la démo" type="datetime-local" required value={dateDemo} onChange={(e) => setDateDemo(e.target.value)} />}
        <Select label="Suivi par" placeholder="Personne" options={(users.data ?? []).map((u) => ({ value: u.id, label: fullName(u) }))} value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <Textarea label="Notes internes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

export function DemoRequestsPage() {
  const [tab, setTab] = useState('todo');
  const [query, setQuery] = useState<{ page: number; search: string; statuts?: DemoStatut[] }>({ page: 1, search: '', statuts: TABS[0].statuts });
  const demos = useDemoRequests(query);
  const [selected, setSelected] = useState<DemoRequest | null>(null);
  // /demandes-demo/:id (link of the "new demo request" notification) opens that request
  const navigate = useNavigate();
  const linkedId = Number(useParams().id) || null;
  const linked = useDemoRequest(linkedId);
  const shown = selected ?? (linkedId && linked.data ? linked.data : null);
  const close = () => {
    setSelected(null);
    if (linkedId) navigate('/demandes-demo', { replace: true });
  };
  const publicUrl = `${window.location.origin}/demo`;

  return (
    <>
      <PageHeader
        title="Demandes de démo"
        description={<>Envoyées depuis le formulaire public <a href="/demo" target="_blank" rel="noreferrer" className="text-brand-700 underline dark:text-blue-300">{publicUrl}</a></>}
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQuery((q) => ({ ...q, statuts: TABS.find((t) => t.value === v)?.statuts, page: 1 }));
        }}
        tabs={TABS}
      />
      <Card>
        <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Nom, email, entreprise…" />
        </div>
        {demos.isError ? (
          <div className="p-4"><ErrorState error={demos.error} onRetry={() => void demos.refetch()} /></div>
        ) : (
          <DataTable
            loading={demos.isPending}
            rows={demos.data?.data}
            rowKey={(d) => d.id}
            onRowClick={setSelected}
            empty={{ title: 'Aucune demande' }}
            columns={[
              {
                key: 'nom',
                header: 'Contact',
                cell: (d) => (
                  <div>
                    <p className="font-medium">{fullName(d)}</p>
                    <p className="text-xs text-slate-500">{d.entreprise ?? d.email}</p>
                  </div>
                ),
              },
              { key: 'tel', header: 'Téléphone', cell: (d) => d.telephone ?? '—' },
              { key: 'suivi', header: 'Suivi par', cell: (d) => (d.assignedTo ? fullName(d.assignedTo) : <span className="text-slate-400">—</span>) },
              { key: 'demo', header: 'Démo', cell: (d) => formatDateTime(d.dateDemo) },
              { key: 'date', header: 'Reçue le', cell: (d) => formatDate(d.createdAt) },
              { key: 'statut', header: 'Statut', cell: (d) => <StatusBadge kind="demo" value={d.statut} /> },
            ]}
          />
        )}
        <Pagination meta={demos.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <DemoModal demo={shown} onClose={close} />
    </>
  );
}
