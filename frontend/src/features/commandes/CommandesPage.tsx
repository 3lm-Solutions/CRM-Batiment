import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, StatusBadge, Tabs } from '@/components/ui';
import { formatDate, formatEuros } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useCommandes, type CommandeListItem, type CommandesQuery, type CommandeStatut } from './api';
import { NouvelleCommandeModal } from './NouvelleCommandeModal';

const TABS: { value: string; label: string; statuts?: CommandeStatut[] }[] = [
  { value: 'todo', label: 'À envoyer', statuts: ['CREEE'] },
  { value: 'waiting', label: 'En attente de livraison', statuts: ['ENVOYEE', 'EXPEDIEE', 'PARTIELLE'] },
  { value: 'received', label: 'Reçues', statuts: ['RECUE', 'CLOTUREE'] },
  { value: 'canceled', label: 'Annulées', statuts: ['ANNULEE'] },
  { value: 'all', label: 'Toutes' },
];

export function CommandesPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const [creating, setCreating] = useState(false);
  // « Toutes » by default: a sent order no longer shows in « À envoyer » (report of 20/10)
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState<CommandesQuery>({ page: 1, search: '' });
  const commandes = useCommandes(query);

  return (
    <>
      <PageHeader
        title="Commandes fournisseur"
        description="Créées automatiquement à l’acceptation d’un devis (une par fournisseur), ou saisies à la main."
        actions={isBureau && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouvelle commande</Button>}
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
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Référence…" />
        </div>
        {commandes.isError ? (
          <div className="p-4"><ErrorState error={commandes.error} onRetry={() => void commandes.refetch()} /></div>
        ) : (
          <DataTable
            loading={commandes.isPending}
            rows={commandes.data?.data}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/commandes/${c.id}`)}
            empty={{ title: 'Aucune commande', description: 'Les besoins en matériaux d’un devis accepté génèrent les commandes.' }}
            columns={[
              { key: 'ref', header: 'Référence', cell: (c) => <span className="font-medium">{c.reference}</span> },
              { key: 'fournisseur', header: 'Fournisseur', cell: (c) => c.fournisseur.nom },
              {
                key: 'devis',
                header: 'Origine',
                cell: (c) =>
                  c.devis ? (
                    <Link to={`/devis/${c.devis.id}`} onClick={(e) => e.stopPropagation()} className="text-brand-700 hover:underline dark:text-blue-300">
                      {c.devis.reference}
                    </Link>
                  ) : (
                    <span className="text-slate-500">Manuelle{c.chantier ? ` · ${c.chantier.reference}` : ' · stock'}</span>
                  ),
              },
              { key: 'date', header: 'Créée le', cell: (c) => formatDate(c.date) },
              { key: 'livraison', header: 'Livraison prévue', cell: (c) => formatDate(c.dateLivraisonPrevue) },
              ...(isBureau ? [{ key: 'total', header: 'Total HT', align: 'right' as const, cell: (c: CommandeListItem) => <span className="tabular-nums">{formatEuros(c.totalHT)}</span> }] : []),
              { key: 'statut', header: 'Statut', cell: (c) => <StatusBadge kind="commande" value={c.statutLivraison} /> },
            ]}
          />
        )}
        <Pagination meta={commandes.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      {isBureau && <NouvelleCommandeModal open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}
