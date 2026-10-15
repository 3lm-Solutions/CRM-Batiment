import { ArrowRightCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, DataTable, ErrorState, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCES, type LeadSource } from '../clients/api';
import { ClientPicker } from '../devis/ClientPicker';
import { useCreateDemande, useDemandeAction, useDemandes, type Demande, type DemandeAction, type DemandesQuery, type DemandeStatut } from './api';

const TABS: { value: string; label: string; statuts?: DemandeStatut[] }[] = [
  { value: 'open', label: 'À traiter', statuts: ['NOUVEAU', 'EN_COURS', 'QUALIFIE'] },
  { value: 'converted', label: 'Converties', statuts: ['CONVERTI'] },
  { value: 'lost', label: 'Perdues', statuts: ['PERDU'] },
  { value: 'all', label: 'Toutes' },
];

/** Next step offered for each status (same transitions as the API). */
const NEXT: Partial<Record<DemandeStatut, { action: DemandeAction; label: string }[]>> = {
  NOUVEAU: [{ action: 'prendre-en-charge', label: 'Prendre en charge' }],
  EN_COURS: [{ action: 'qualifier', label: 'Qualifier' }],
  PERDU: [{ action: 'reouvrir', label: 'Rouvrir' }],
};

function NewDemandeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateDemande();
  const [clientId, setClientId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<LeadSource>('APPEL');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle demande de devis"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!clientId || !description.trim()}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { clientId: clientId!, description: description.trim(), source },
                { onSuccess: () => { toast.success('Demande enregistrée'); onClose(); } },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ClientPicker value={clientId} onChange={setClientId} />
        <Textarea label="Besoin du client" required rows={4} placeholder="Ex. : rénovation de la salle de bain, 6 m², douche à l’italienne…" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select label="Origine" options={LEAD_SOURCE_OPTIONS} value={source} onChange={(e) => setSource(e.target.value as LeadSource)} />
        {create.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(create.error)}</p>}
      </div>
    </Modal>
  );
}

export function DemandesPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canConvert = hasRole('ADMIN', 'TECHNICO');
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState<DemandesQuery>({ page: 1, search: '', statuts: TABS[0].statuts });
  const demandes = useDemandes(query);
  const action = useDemandeAction();
  const [creating, setCreating] = useState(false);

  const run = (d: Demande, act: DemandeAction) =>
    action.mutate(
      { id: d.id, action: act },
      {
        onSuccess: (r) => {
          if (act === 'convertir-en-devis') {
            toast.success('Devis brouillon créé');
            navigate(`/devis/${r.id}`);
          } else toast.success('Demande mise à jour');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <>
      <PageHeader
        title="Demandes de devis"
        description="Qualifiez les demandes puis transformez-les en devis"
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouvelle demande</Button>}
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQuery((q) => ({ ...q, page: 1, statuts: TABS.find((t) => t.value === v)?.statuts }));
        }}
        tabs={TABS}
      />
      <Card>
        <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Référence, client, besoin…" />
        </div>
        {demandes.isError ? (
          <div className="p-4"><ErrorState error={demandes.error} onRetry={() => void demandes.refetch()} /></div>
        ) : (
          <DataTable
            loading={demandes.isPending}
            rows={demandes.data?.data}
            rowKey={(d) => d.id}
            empty={{ title: 'Aucune demande', description: tab === 'open' ? 'Toutes les demandes ont été traitées.' : undefined }}
            columns={[
              { key: 'ref', header: 'Référence', cell: (d) => <span className="font-medium">{d.reference}</span> },
              { key: 'client', header: 'Client', cell: (d) => <Link to={`/clients/${d.client.id}`} className="text-brand-700 hover:underline">{fullName(d.client)}</Link> },
              { key: 'besoin', header: 'Besoin', className: 'max-w-sm', cell: (d) => <span className="line-clamp-2 text-slate-600 dark:text-slate-400">{d.description}</span> },
              { key: 'source', header: 'Origine', cell: (d) => LEAD_SOURCES[d.source] },
              { key: 'date', header: 'Reçue le', cell: (d) => formatDate(d.createdAt) },
              { key: 'statut', header: 'Statut', cell: (d) => <StatusBadge kind="demande" value={d.statut} /> },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                cell: (d) => (
                  <div className="flex justify-end gap-1">
                    {d.devis[0] ? (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/devis/${d.devis[0].id}`)}>{d.devis[0].reference}</Button>
                    ) : (
                      <>
                        {NEXT[d.statut]?.map((n) => (
                          <Button key={n.action} size="sm" variant="outline" disabled={action.isPending} onClick={() => run(d, n.action)}>{n.label}</Button>
                        ))}
                        {canConvert && d.statut !== 'PERDU' && (
                          <Button size="sm" icon={<ArrowRightCircle className="size-4" />} disabled={action.isPending} onClick={() => run(d, 'convertir-en-devis')}>Créer le devis</Button>
                        )}
                        {d.statut !== 'PERDU' && <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => run(d, 'perdre')}>Perdue</Button>}
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={demandes.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      {creating && <NewDemandeModal open onClose={() => setCreating(false)} />}
    </>
  );
}
