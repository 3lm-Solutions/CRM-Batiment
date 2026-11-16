import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, Select } from '@/components/ui';
import { formatDate, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { formatSiret, LEAD_SOURCE_OPTIONS, LEAD_SOURCES, TYPE_CLIENT_OPTIONS, useClients, type ClientsQuery, type LeadSource, type StatutClient, type TypeClient } from './api';
import { ClientFormModal } from './ClientFormModal';

/**
 * 27/10 + 29/10: two lists of the same contacts —
 *  - « Prospects »: qualified, not yet signed. Requests from the chatbot or by email wait in
 *    « Assistant IA » until qualified; a contact entered by hand starts qualified. (PROSPECT =
 *    older rows only, still listed here.)
 *  - « Clients »: signed at least one quote (moved there automatically on signature).
 */
const MODES = {
  prospects: { titre: 'Prospects', description: 'Prospects qualifiés qui n’ont pas encore signé de devis', statuts: ['PROSPECT', 'QUALIFIE'] as StatutClient[], nouveau: 'Nouveau prospect', vide: 'Aucun prospect qualifié' },
  clients: { titre: 'Clients', description: 'Ont signé au moins un devis', statuts: ['CLIENT'] as StatutClient[], nouveau: 'Nouveau client', vide: 'Aucun client' },
} as const;

export function ClientsPage({ mode = 'clients' }: { mode?: keyof typeof MODES }) {
  const m = MODES[mode];
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const [query, setQuery] = useState<ClientsQuery>({ page: 1, search: '', source: '', typeClient: '', archived: false });
  const clients = useClients({ ...query, statuts: [...m.statuts] });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={m.titre}
        description={m.description}
        toolbar={
          <>
            <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder={mode === 'prospects' ? 'Rechercher un prospect…' : 'Rechercher un client…'} />
            <Select
              aria-label="Statut"
              containerClassName="w-40"
              options={[{ value: 'active', label: 'Actifs' }, { value: 'archived', label: 'Archivés' }]}
              value={query.archived ? 'archived' : 'active'}
              onChange={(e) => setQuery((q) => ({ ...q, archived: e.target.value === 'archived', page: 1 }))}
            />
            <Select
              aria-label="Type de client"
              containerClassName="w-44"
              placeholder="Particuliers et pros"
              options={TYPE_CLIENT_OPTIONS.map((o) => ({ ...o, label: `${o.label}s` }))}
              value={query.typeClient}
              onChange={(e) => setQuery((q) => ({ ...q, typeClient: e.target.value as TypeClient, page: 1 }))}
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
        actions={canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{m.nouveau}</Button>}
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
              title: query.archived ? `${m.vide} archivé` : m.vide,
              description: query.archived
                ? undefined
                : mode === 'clients'
                  ? 'Un prospect devient client automatiquement à la signature de son premier devis.'
                  : (
                    <>
                      Les demandes reçues par email ou par le chatbot arrivent dans{' '}
                      <Link to="/assistant" className="font-medium text-brand-700 underline dark:text-blue-300">Assistant IA</Link> : qualifiez-les pour les retrouver ici.
                    </>
                  ),
              action: canWrite && !query.archived ? <Button onClick={() => setCreating(true)}>{m.nouveau}</Button> : undefined,
            }}
            columns={[
              {
                key: 'nom',
                header: mode === 'prospects' ? 'Prospect' : 'Client',
                cell: (c) => (
                  <span className="flex items-center gap-3">
                    <Avatar name={fullName(c)} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-slate-100">
                        {fullName(c)}
                        {c.typeClient === 'PROFESSIONNEL' && <Badge tone="violet">Pro</Badge>}
                      </span>
                      {c.typeClient === 'PROFESSIONNEL' && (c.contactNom || c.siret) && (
                        <span className="block truncate text-xs text-slate-500">{c.contactNom ?? `SIRET ${formatSiret(c.siret!)}`}</span>
                      )}
                    </span>
                  </span>
                ),
              },
              { key: 'contact', header: 'Coordonnées', cell: (c) => <span className="text-slate-600 dark:text-slate-400">{c.email ?? c.telephone ?? '—'}</span> },
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
      <ClientFormModal open={creating} onClose={() => setCreating(false)} statutInitial={mode === 'clients' ? 'CLIENT' : 'QUALIFIE'} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </>
  );
}
