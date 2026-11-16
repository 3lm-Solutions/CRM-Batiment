import { Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, StatusBadge, Tabs, type Column } from '@/components/ui';
import { formatDate, formatEuros, formatPercent, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useDevisList, type DevisListItem, type DevisQuery, type DevisStatut } from './api';
import { NewDevisModal } from './NewDevisModal';

const TABS: { value: string; label: string; statuts?: DevisStatut[] }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'draft', label: 'Brouillons', statuts: ['BROUILLON', 'REVISE'] },
  { value: 'sent', label: 'En attente client', statuts: ['ENVOYE', 'RENVOYE'] },
  { value: 'accepted', label: 'À signer', statuts: ['ACCEPTE'] },
  { value: 'signed', label: 'Signés', statuts: ['SIGNE'] },
  { value: 'closed', label: 'Refusés / annulés', statuts: ['REFUSE', 'ANNULE'] },
];

export function DevisListPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState<DevisQuery>({ page: 1, search: '' });
  const devis = useDevisList(query);
  const [creating, setCreating] = useState(false);

  const columns: Column<DevisListItem>[] = [
    { key: 'ref', header: 'Référence', cell: (d) => <span className="font-medium">{d.reference}{d.versionCourante > 1 && <span className="ml-1 text-xs text-slate-500">v{d.versionCourante}</span>}</span> },
    { key: 'client', header: 'Client', cell: (d) => fullName(d.client) },
    { key: 'statut', header: 'Statut', cell: (d) => <StatusBadge kind="devis" value={d.statut} /> },
    { key: 'date', header: 'Créé le', cell: (d) => formatDate(d.dateCreation) },
  ];
  if (isBureau) {
    columns.push(
      { key: 'ttc', header: 'Total TTC', align: 'right', cell: (d) => <span className="tabular-nums">{formatEuros(d.totalTTC)}</span> },
      {
        key: 'marge',
        header: 'Marge',
        align: 'right',
        cell: (d) => (
          <span className={d.alerteMarge ? 'inline-flex items-center gap-1 font-semibold text-amber-700' : 'tabular-nums'}>
            {d.alerteMarge && <TriangleAlert className="size-4" aria-label="Marge sous le seuil" />}
            {formatPercent(d.margePourcent)}
          </span>
        ),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Devis"
        description={isBureau ? 'Du brouillon à la signature' : 'Devis signés de vos chantiers (lignes et quantités, sans montants)'}
        actions={isBureau && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau devis</Button>}
      />
      {/* The chef only sees signed quotes of his job sites: status tabs make no sense for him */}
      {isBureau && <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQuery((q) => ({ ...q, page: 1, statuts: TABS.find((t) => t.value === v)?.statuts }));
        }}
        tabs={TABS}
      />}
      <Card>
        <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Référence ou client…" />
        </div>
        {devis.isError ? (
          <div className="p-4"><ErrorState error={devis.error} onRetry={() => void devis.refetch()} /></div>
        ) : (
          <DataTable
            loading={devis.isPending}
            rows={devis.data?.data}
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate(`/devis/${d.id}`)}
            empty={{ title: 'Aucun devis', description: isBureau ? undefined : 'Un devis apparaît ici une fois signé, quand son chantier vous est affecté.', action: isBureau && tab === 'all' ? <Button onClick={() => setCreating(true)}>Créer un devis</Button> : undefined }}
            columns={columns}
          />
        )}
        <Pagination meta={devis.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <NewDevisModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
