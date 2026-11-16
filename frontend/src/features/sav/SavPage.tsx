import { Globe, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, Select, statusOptions, StatusBadge, Tabs } from '@/components/ui';
import { formatDate, fullName } from '@/lib/format';
import { SAV_CATEGORIES, useSavTickets, type SavCategorie, type SavPriorite, type SavQuery, type SavStatut } from './api';
import { SavFormModal } from './SavFormModal';

const TABS: { value: string; label: string; statuts?: SavStatut[] }[] = [
  { value: 'open', label: 'À traiter', statuts: ['OUVERT', 'EN_COURS', 'EN_ATTENTE_CLIENT'] },
  { value: 'resolved', label: 'Résolus', statuts: ['RESOLU'] },
  { value: 'closed', label: 'Clôturés', statuts: ['CLOTURE'] },
  { value: 'all', label: 'Tous' },
];

export function SavPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState<SavQuery>({ page: 1, search: '', priorite: '', categorie: '', statuts: TABS[0].statuts });
  const tickets = useSavTickets(query);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="SAV"
        description="Réclamations et interventions après travaux"
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau ticket</Button>}
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
        <div className="flex flex-wrap gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Référence, titre, client…" />
          <Select aria-label="Priorité" containerClassName="w-40" placeholder="Toutes priorités" options={statusOptions('priorite')} value={query.priorite} onChange={(e) => setQuery((q) => ({ ...q, priorite: e.target.value as SavPriorite | '', page: 1 }))} />
          <Select
            aria-label="Catégorie"
            containerClassName="w-48"
            placeholder="Toutes catégories"
            options={Object.entries(SAV_CATEGORIES).map(([value, label]) => ({ value, label }))}
            value={query.categorie}
            onChange={(e) => setQuery((q) => ({ ...q, categorie: e.target.value as SavCategorie | '', page: 1 }))}
          />
        </div>
        {tickets.isError ? (
          <div className="p-4"><ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} /></div>
        ) : (
          <DataTable
            loading={tickets.isPending}
            rows={tickets.data?.data}
            rowKey={(t) => t.id}
            onRowClick={(t) => navigate(`/sav/${t.id}`)}
            empty={{ title: 'Aucun ticket', description: 'Les réclamations clients apparaissent ici.' }}
            columns={[
              { key: 'ref', header: 'Référence', cell: (t) => <span className="font-medium">{t.reference}</span> },
              {
                key: 'titre',
                header: 'Ticket',
                cell: (t) => (
                  <div>
                    <p className="flex items-center gap-1 font-medium">
                      {t.origine === 'ESPACE_CLIENT' && <Globe className="size-3.5 text-brand-700" aria-label="Ouvert par le client" />}
                      {t.titre}
                    </p>
                    <p className="text-xs text-slate-500">{t.client.nom} · {SAV_CATEGORIES[t.categorie]}</p>
                  </div>
                ),
              },
              { key: 'priorite', header: 'Priorité', cell: (t) => <StatusBadge kind="priorite" value={t.priorite} /> },
              { key: 'assigne', header: 'Assigné', cell: (t) => (t.assignedTo ? fullName(t.assignedTo) : <span className="text-slate-400">—</span>) },
              {
                key: 'echeance',
                header: 'Échéance',
                cell: (t) => {
                  const late = t.dateEcheance && new Date(t.dateEcheance) < new Date() && !['RESOLU', 'CLOTURE'].includes(t.statut);
                  return <span className={late ? 'font-semibold text-red-600' : undefined}>{formatDate(t.dateEcheance)}</span>;
                },
              },
              { key: 'date', header: 'Ouvert le', cell: (t) => formatDate(t.createdAt) },
              { key: 'statut', header: 'Statut', cell: (t) => <StatusBadge kind="sav" value={t.statut} /> },
            ]}
          />
        )}
        <Pagination meta={tickets.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <SavFormModal open={creating} onClose={() => setCreating(false)} onSaved={(t) => navigate(`/sav/${t.id}`)} />
    </>
  );
}
