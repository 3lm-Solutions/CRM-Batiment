import { Plus, ShieldAlert, Star } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, DataTable, ErrorState, PageHeader, Pagination, SearchInput, Select, statusOptions, StatusBadge } from '@/components/ui';
import { useAuth } from '../auth/auth-context';
import { TYPE_ASSURANCE, useSousTraitants, type SousTraitantStatut } from './api';
import { SousTraitantFormModal } from './SousTraitantFormModal';

export function Note({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
      {value.toFixed(1)}
      <span className="sr-only">sur 5</span>
    </span>
  );
}

export function SousTraitantsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [query, setQuery] = useState<{ page: number; search: string; statut: SousTraitantStatut | '' }>({ page: 1, search: '', statut: 'ACTIF' });
  const list = useSousTraitants(query);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Sous-traitants"
        description="Dossiers, assurances, contrats, paiements et évaluations"
        actions={isAdmin && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouveau sous-traitant</Button>}
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Nom, spécialité…" />
          <Select
            aria-label="Statut"
            containerClassName="w-44"
            placeholder="Tous les statuts"
            options={statusOptions('sousTraitant')}
            value={query.statut}
            onChange={(e) => setQuery((q) => ({ ...q, statut: e.target.value as SousTraitantStatut | '', page: 1 }))}
          />
        </div>
        {list.isError ? (
          <div className="p-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
        ) : (
          <DataTable
            loading={list.isPending}
            rows={list.data?.data}
            rowKey={(s) => s.id}
            onRowClick={(s) => navigate(`/sous-traitants/${s.id}`)}
            empty={{ title: 'Aucun sous-traitant' }}
            columns={[
              {
                key: 'nom',
                header: 'Sous-traitant',
                cell: (s) => (
                  <div>
                    <p className="font-medium">{s.nom}</p>
                    <p className="text-xs text-slate-500">{s.specialite ?? '—'}</p>
                  </div>
                ),
              },
              { key: 'contact', header: 'Contact', cell: (s) => <span className="text-slate-600 dark:text-slate-400">{s.telephone ?? s.email ?? s.contact ?? '—'}</span> },
              {
                key: 'assurances',
                header: 'Assurances',
                cell: (s) =>
                  s.assurancesAlerte.length === 0 ? (
                    <Badge tone="green">À jour</Badge>
                  ) : (
                    <span className="inline-flex flex-wrap gap-1">
                      {s.assurancesAlerte.map((a) => (
                        <Badge key={a.typeAssurance + a.dateExpiration} tone={a.statut === 'EXPIREE' ? 'red' : 'amber'}>
                          <ShieldAlert className="mr-1 size-3" aria-hidden />
                          {TYPE_ASSURANCE[a.typeAssurance]}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
              { key: 'contrats', header: 'Contrats', align: 'right', cell: (s) => s._count.contrats },
              { key: 'note', header: 'Note', cell: (s) => <Note value={s.noteMoyenne} /> },
              { key: 'compte', header: 'Portail', cell: (s) => (s.userId ? <Badge tone="blue">Compte lié</Badge> : <span className="text-xs text-slate-400">Aucun</span>) },
              { key: 'statut', header: 'Statut', cell: (s) => <StatusBadge kind="sousTraitant" value={s.statut} /> },
            ]}
          />
        )}
        <Pagination meta={list.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
      <SousTraitantFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/sous-traitants/${id}`)} />
    </>
  );
}
