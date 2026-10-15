import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, ErrorState, PageHeader, Pagination, Progress, SearchInput, StatusBadge, Tabs } from '@/components/ui';
import { formatDate, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useChantiers, type ChantierListItem, type ChantiersQuery, type ChantierStatut } from './api';
import { ChantierFormModal } from './ChantierFormModal';

const TABS: { value: string; label: string; statuts?: ChantierStatut[] }[] = [
  { value: 'active', label: 'En cours', statuts: ['PLANIFIE', 'EN_COURS', 'SUSPENDU'] },
  { value: 'done', label: 'Terminés', statuts: ['TERMINE', 'CLOTURE'] },
  { value: 'canceled', label: 'Annulés', statuts: ['ANNULE'] },
  { value: 'all', label: 'Tous' },
];

/** A job site is late when its planned end has passed and it is not finished. */
const isLate = (c: { dateFin: string | null; statut: ChantierStatut }) =>
  !!c.dateFin && new Date(c.dateFin) < new Date() && ['PLANIFIE', 'EN_COURS', 'SUSPENDU'].includes(c.statut);

export function ChantiersPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canCreate = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  // A chef only sees the job sites assigned to him (filtered by the API)
  const isChef = hasRole('CHEF_CHANTIER');
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState<ChantiersQuery>({ page: 1, search: '', statuts: TABS[0].statuts });
  const chantiers = useChantiers(query);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={isChef ? 'Mes chantiers' : 'Chantiers'}
        description={isChef ? 'Les chantiers qui vous sont affectés : planning, tâches et avancement' : 'Planning, tâches et avancement des travaux'}
        actions={canCreate && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau chantier</Button>}
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
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Référence, adresse, client…" />
        </div>
        {chantiers.isError ? (
          <div className="p-4"><ErrorState error={chantiers.error} onRetry={() => void chantiers.refetch()} /></div>
        ) : (
          <DataTable
            loading={chantiers.isPending}
            rows={chantiers.data?.data}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/chantiers/${c.id}`)}
            empty={
              isChef
                ? { title: 'Aucun chantier ne vous est affecté', description: 'Demandez à l’administrateur de vous attribuer un chantier.' }
                : { title: 'Aucun chantier', description: 'Un chantier est créé automatiquement à la signature d’un devis.' }
            }
            columns={[
              { key: 'ref', header: 'Référence', cell: (c) => <span className="font-medium">{c.reference}</span> },
              {
                key: 'client',
                header: 'Client / adresse',
                cell: (c) => (
                  <div>
                    <p className="font-medium">{fullName(c.client)}</p>
                    <p className="text-xs text-slate-500">{c.adresse}</p>
                  </div>
                ),
              },
              ...(isChef
                ? []
                : [{ key: 'chef', header: 'Chef de chantier', cell: (c: ChantierListItem) => (c.chefChantier ? fullName(c.chefChantier) : <span className="text-slate-400">Non affecté</span>) }]),
              {
                key: 'dates',
                header: 'Période',
                cell: (c) => (
                  <span className={isLate(c) ? 'font-semibold text-red-600' : undefined}>
                    {formatDate(c.dateDebut)} → {formatDate(c.dateFin)}
                    {isLate(c) && <span className="ml-1 text-xs">(en retard)</span>}
                  </span>
                ),
              },
              { key: 'avancement', header: 'Avancement', className: 'w-44', cell: (c) => (c.nombreTaches ? <Progress value={c.avancement} /> : <span className="text-xs text-slate-400">Aucune tâche</span>) },
              { key: 'statut', header: 'Statut', cell: (c) => <StatusBadge kind="chantier" value={c.statut} /> },
            ]}
          />
        )}
        <Pagination meta={chantiers.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <ChantierFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => navigate(`/chantiers/${c.id}`)} />
    </>
  );
}
