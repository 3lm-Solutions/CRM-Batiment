import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, Select } from '@/components/ui';
import { formatDate, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCES, useClients, type ClientsQuery, type LeadSource } from './api';
import { ClientFormModal } from './ClientFormModal';

export function ClientsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const [query, setQuery] = useState<ClientsQuery>({ page: 1, search: '', source: '', archived: false });
  const clients = useClients(query);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Gestion de votre portefeuille clients"
        toolbar={
          <>
            <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Rechercher un client…" />
            <Select
              aria-label="Statut"
              containerClassName="w-40"
              options={[{ value: 'active', label: 'Actifs' }, { value: 'archived', label: 'Archivés' }]}
              value={query.archived ? 'archived' : 'active'}
              onChange={(e) => setQuery((q) => ({ ...q, archived: e.target.value === 'archived', page: 1 }))}
            />
            <Select
              aria-label="Origine"
              containerClassName="w-48"
              placeholder="Toutes les origines"
              options={LEAD_SOURCE_OPTIONS}
              value={query.source}
              onChange={(e) => setQuery((q) => ({ ...q, source: e.target.value as LeadSource, page: 1 }))}
            />
          </>
        }
        actions={canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau client</Button>}
      />
      <Card className="overflow-hidden">
        {clients.isError ? (
          <div className="p-4"><ErrorState error={clients.error} onRetry={() => void clients.refetch()} /></div>
        ) : (
          <DataTable
            loading={clients.isPending}
            rows={clients.data?.data}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/clients/${c.id}`)}
            empty={{
              title: query.archived ? 'Aucun client archivé' : 'Aucun client',
              action: canWrite && !query.archived ? <Button onClick={() => setCreating(true)}>Créer un client</Button> : undefined,
            }}
            columns={[
              {
                key: 'nom',
                header: 'Client',
                cell: (c) => (
                  <span className="flex items-center gap-3">
                    <Avatar name={fullName(c)} />
                    <span className="font-medium text-gray-800 dark:text-slate-100">{fullName(c)}</span>
                  </span>
                ),
              },
              { key: 'contact', header: 'Contact', cell: (c) => <span className="text-slate-600 dark:text-slate-400">{c.email ?? c.telephone ?? '—'}</span> },
              {
                key: 'types',
                header: 'Projets',
                cell: (c) => (
                  <div className="flex flex-wrap gap-1">
                    {c.typeProjets.slice(0, 2).map((t) => <Badge key={t.id}>{t.nom}</Badge>)}
                    {c.typeProjets.length > 2 && <Badge>+{c.typeProjets.length - 2}</Badge>}
                  </div>
                ),
              },
              { key: 'source', header: 'Origine', cell: (c) => LEAD_SOURCES[c.source] },
              { key: 'date', header: 'Créé le', cell: (c) => formatDate(c.createdAt) },
            ]}
          />
        )}
        <Pagination meta={clients.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <ClientFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </>
  );
}
