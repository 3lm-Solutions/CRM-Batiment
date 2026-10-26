import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, Select, statusOptions, StatusBadge, Tabs } from '@/components/ui';
import { formatDate, formatEuros, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { factureLabel, isOverdue, useFactures, type FacturesQuery, type FactureStatut, type FactureType } from './api';

const TABS: { value: string; label: string; statuts?: FactureStatut[] }[] = [
  { value: 'unpaid', label: 'À encaisser', statuts: ['ENVOYEE'] },
  { value: 'draft', label: 'Brouillons', statuts: ['BROUILLON'] },
  { value: 'paid', label: 'Payées', statuts: ['PAYEE'] },
  { value: 'canceled', label: 'Annulées', statuts: ['ANNULEE'] },
  { value: 'all', label: 'Toutes' },
];

export function FacturesPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  // The chef only sees issued invoices of his job sites: no « Brouillons » tab for him
  const tabs = isBureau ? TABS : TABS.filter((t) => t.value !== 'draft');
  const [tab, setTab] = useState('unpaid');
  const [query, setQuery] = useState<FacturesQuery>({ page: 1, search: '', type: '', statuts: TABS[0].statuts });
  const factures = useFactures(query);

  return (
    <>
      <PageHeader
        title="Factures"
        description={isBureau ? 'Acomptes, situations de travaux, factures finales et avoirs. Les factures se créent depuis un devis signé.' : 'Factures émises pour vos chantiers (consultation).'}
      />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setQuery((q) => ({ ...q, statuts: TABS.find((t) => t.value === v)?.statuts, page: 1 }));
        }}
        tabs={tabs}
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Numéro, devis, client…" />
          <Select
            aria-label="Type"
            containerClassName="w-48"
            placeholder="Tous les types"
            options={statusOptions('factureType')}
            value={query.type}
            onChange={(e) => setQuery((q) => ({ ...q, type: e.target.value as FactureType | '', page: 1 }))}
          />
        </div>
        {factures.isError ? (
          <div className="p-4"><ErrorState error={factures.error} onRetry={() => void factures.refetch()} /></div>
        ) : (
          <DataTable
            loading={factures.isPending}
            rows={factures.data?.data}
            rowKey={(f) => f.id}
            onRowClick={(f) => navigate(`/factures/${f.id}`)}
            empty={{ title: 'Aucune facture', description: 'La facture d’acompte est créée automatiquement à la signature du devis.' }}
            columns={[
              { key: 'ref', header: 'Numéro', cell: (f) => <span className={f.reference ? 'font-medium' : 'italic text-slate-500'}>{factureLabel(f)}</span> },
              { key: 'type', header: 'Type', cell: (f) => <StatusBadge kind="factureType" value={f.typeFacture} /> },
              {
                key: 'client',
                header: 'Client / devis',
                cell: (f) => (
                  <div>
                    <p className="font-medium">{f.nomClient ? fullName({ nom: f.nomClient, prenom: f.prenomClient }) : fullName(f.devis.client)}</p>
                    <p className="text-xs text-slate-500">{f.devis.reference}</p>
                  </div>
                ),
              },
              { key: 'date', header: 'Émise le', cell: (f) => formatDate(f.dateEmission) },
              {
                key: 'echeance',
                header: 'Échéance',
                cell: (f) => (
                  <span className={isOverdue(f) ? 'font-semibold text-red-600' : undefined}>
                    {formatDate(f.dateEcheance)}
                    {isOverdue(f) && <Badge tone="red" className="ml-2">En retard</Badge>}
                  </span>
                ),
              },
              { key: 'ttc', header: 'Montant TTC', align: 'right', cell: (f) => <span className="font-semibold tabular-nums">{formatEuros(f.montantTTC)}</span> },
              { key: 'statut', header: 'Statut', cell: (f) => <StatusBadge kind="facture" value={f.statut} /> },
            ]}
          />
        )}
        <Pagination meta={factures.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
    </>
  );
}
