import { Pencil, Plus } from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, DataTable, ErrorState, Input, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, type Column } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros, formatNumber, formatUnite } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useCategories, useCreateSousCategorie, useMateriaux, usePrestations, useServicesMo, type ListQuery, type Materiau, type Prestation, type ServiceMo } from './api';
import { CategorieModal, MateriauModal, PrestationModal, ServiceModal } from './CatalogueForms';

type Tab = 'prestations' | 'materiaux' | 'services' | 'categories';

function Filters({ query, setQuery, withCategory }: { query: ListQuery; setQuery: Dispatch<SetStateAction<ListQuery>>; withCategory?: boolean }) {
  const categories = useCategories();
  return (
    <div className="flex flex-wrap gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
      <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} />
      {withCategory && (
        <Select
          aria-label="Catégorie"
          containerClassName="w-56"
          placeholder="Toutes les catégories"
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.nom }))}
          value={query.categorieId}
          onChange={(e) => setQuery((q) => ({ ...q, categorieId: e.target.value ? Number(e.target.value) : '', page: 1 }))}
        />
      )}
      <Select
        aria-label="Statut"
        containerClassName="w-40"
        placeholder="Tous"
        options={[{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }]}
        value={query.actif}
        onChange={(e) => setQuery((q) => ({ ...q, actif: e.target.value as ListQuery['actif'], page: 1 }))}
      />
    </div>
  );
}

function PrestationsTab({ isAdmin, seesCosts }: { isAdmin: boolean; seesCosts: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState<ListQuery>({ page: 1, search: '', categorieId: '', actif: 'true' });
  const [creating, setCreating] = useState(false);
  const data = usePrestations(query);
  return (
    <Card>
      <Filters query={query} setQuery={setQuery} withCategory />
      {isAdmin && <div className="flex justify-end px-4 pt-3"><Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouvelle prestation</Button></div>}
      {data.isError ? <div className="p-4"><ErrorState error={data.error} /></div> : (
        <DataTable
          loading={data.isPending}
          rows={data.data?.data}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/catalogue/prestations/${p.id}`)}
          empty={{ title: 'Aucune prestation' }}
          columns={[
            { key: 'nom', header: 'Prestation', cell: (p) => <span className="font-medium">{p.nom}</span> },
            { key: 'cat', header: 'Catégorie', cell: (p) => <span className="text-slate-600 dark:text-slate-400">{p.categorie.nom}{p.sousCategorie && ` › ${p.sousCategorie.nom}`}</span> },
            ...(seesCosts ? [{ key: 'prix', header: 'Prix de vente HT', align: 'right' as const, cell: (p: Prestation) => <span className="tabular-nums">{formatEuros(p.prixVenteMin)} – {formatEuros(p.prixVenteMax)} / {formatUnite(p.unite)}</span> }] : []),
            { key: 'compo', header: 'Composition', cell: (p) => (p._count?.compositions ? <Badge tone="green">{p._count.compositions} élément(s)</Badge> : <Badge tone="amber">à compléter</Badge>) },
            { key: 'actif', header: 'Statut', cell: (p) => <StatusBadge kind="actif" value={p.actif} /> },
          ]}
        />
      )}
      <Pagination meta={data.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      <PrestationModal open={creating} onClose={() => setCreating(false)} />
    </Card>
  );
}

function MateriauxTab({ isAdmin, seesCosts }: { isAdmin: boolean; seesCosts: boolean }) {
  const [query, setQuery] = useState<ListQuery>({ page: 1, search: '', actif: 'true' });
  const [editing, setEditing] = useState<Materiau | 'new' | null>(null);
  const data = useMateriaux(query);
  const columns: Column<Materiau>[] = [
    { key: 'nom', header: 'Matériau', cell: (m) => <span className="font-medium">{m.nom}{m.couleur && <span className="text-slate-500"> · {m.couleur}</span>}</span> },
    ...(seesCosts ? [{ key: 'prix', header: 'Prix d’achat HT', align: 'right' as const, cell: (m: Materiau) => <span className="tabular-nums">{formatEuros(m.prixAchatFixe)} / {formatUnite(m.unite)}</span> }] : [{ key: 'unite', header: 'Unité', cell: (m: Materiau) => formatUnite(m.unite) }]),
    { key: 'fourn', header: 'Fournisseur', cell: (m) => m.fournisseur?.nom ?? <Badge tone="amber">aucun</Badge> },
    { key: 'stock', header: 'Stock', align: 'right', cell: (m) => <span className={m.stockActuel <= m.stockMinimum ? 'font-semibold text-amber-700' : ''}>{formatNumber(m.stockActuel)}</span> },
    { key: 'actif', header: 'Statut', cell: (m) => <StatusBadge kind="actif" value={m.actif} /> },
  ];
  if (isAdmin) {
    columns.push({ key: 'edit', header: <span className="sr-only">Modifier</span>, align: 'right', cell: (m) => <Button variant="ghost" size="sm" aria-label={`Modifier ${m.nom}`} onClick={() => setEditing(m)} icon={<Pencil className="size-4" />} /> });
  }
  return (
    <Card>
      <Filters query={query} setQuery={setQuery} />
      {isAdmin && <div className="flex justify-end px-4 pt-3"><Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nouveau matériau</Button></div>}
      {data.isError ? <div className="p-4"><ErrorState error={data.error} /></div> : (
        <DataTable loading={data.isPending} rows={data.data?.data} rowKey={(m) => m.id} empty={{ title: 'Aucun matériau' }} columns={columns} />
      )}
      <Pagination meta={data.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      <MateriauModal open={editing !== null} materiau={editing === 'new' ? undefined : (editing ?? undefined)} onClose={() => setEditing(null)} />
    </Card>
  );
}

function ServicesTab({ isAdmin, seesCosts }: { isAdmin: boolean; seesCosts: boolean }) {
  const [query, setQuery] = useState<ListQuery>({ page: 1, search: '', actif: 'true' });
  const [editing, setEditing] = useState<ServiceMo | 'new' | null>(null);
  const data = useServicesMo(query);
  const columns: Column<ServiceMo>[] = [
    { key: 'nom', header: 'Service', cell: (s) => <span className="font-medium">{s.nom}</span> },
    ...(seesCosts ? [{ key: 'prix', header: 'Coût HT', align: 'right' as const, cell: (s: ServiceMo) => <span className="tabular-nums">{formatEuros(s.prixUnitaire)} / {formatUnite(s.unite)}</span> }] : [{ key: 'unite', header: 'Unité', cell: (s: ServiceMo) => formatUnite(s.unite) }]),
    { key: 'prod', header: 'Productivité / jour', align: 'right', cell: (s) => (s.productiviteJour ? `${formatNumber(s.productiviteJour)} ${formatUnite(s.unite)}` : '—') },
    { key: 'actif', header: 'Statut', cell: (s) => <StatusBadge kind="actif" value={s.actif} /> },
  ];
  if (isAdmin) {
    columns.push({ key: 'edit', header: <span className="sr-only">Modifier</span>, align: 'right', cell: (s) => <Button variant="ghost" size="sm" aria-label={`Modifier ${s.nom}`} onClick={() => setEditing(s)} icon={<Pencil className="size-4" />} /> });
  }
  return (
    <Card>
      <Filters query={query} setQuery={setQuery} />
      {isAdmin && <div className="flex justify-end px-4 pt-3"><Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nouveau service</Button></div>}
      {data.isError ? <div className="p-4"><ErrorState error={data.error} /></div> : (
        <DataTable loading={data.isPending} rows={data.data?.data} rowKey={(s) => s.id} empty={{ title: 'Aucun service de main d’œuvre' }} columns={columns} />
      )}
      <Pagination meta={data.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      <ServiceModal open={editing !== null} service={editing === 'new' ? undefined : (editing ?? undefined)} onClose={() => setEditing(null)} />
    </Card>
  );
}

function CategoriesTab({ isAdmin }: { isAdmin: boolean }) {
  const categories = useCategories();
  const addSub = useCreateSousCategorie();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  if (categories.isError) return <ErrorState error={categories.error} />;
  return (
    <>
      {isAdmin && <div className="mb-4 flex justify-end"><Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouvelle catégorie</Button></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.data?.map((c) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{c.nom}</h3>
              <Badge>{c._count.prestations} prestation(s)</Badge>
            </div>
            {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.sousCategories.map((s) => <li key={s.id}><Badge tone="blue">{s.nom}</Badge></li>)}
            </ul>
            {isAdmin && (
              <form
                className="mt-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const nom = draft[c.id]?.trim();
                  if (!nom) return;
                  addSub.mutate({ categorieId: c.id, nom }, {
                    onSuccess: () => setDraft((d) => ({ ...d, [c.id]: '' })),
                    onError: (err) => toast.error(errorMessage(err)),
                  });
                }}
              >
                <Input aria-label={`Nouvelle sous-catégorie de ${c.nom}`} placeholder="Ajouter une sous-catégorie" containerClassName="flex-1" value={draft[c.id] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))} />
                <Button type="submit" variant="outline" size="sm" icon={<Plus className="size-4" />} aria-label="Ajouter" />
              </form>
            )}
          </Card>
        ))}
      </div>
      <CategorieModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

export function CataloguePage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const seesCosts = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const [tab, setTab] = useState<Tab>('prestations');
  return (
    <>
      <PageHeader title="Catalogue" description={isAdmin ? 'Prestations, matériaux et main d’œuvre utilisés pour chiffrer les devis' : 'Consultation du catalogue de l’entreprise'} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'prestations', label: 'Prestations' },
          { value: 'materiaux', label: 'Matériaux' },
          { value: 'services', label: 'Main d’œuvre' },
          { value: 'categories', label: 'Catégories' },
        ]}
      />
      {tab === 'prestations' && <PrestationsTab isAdmin={isAdmin} seesCosts={seesCosts} />}
      {tab === 'materiaux' && <MateriauxTab isAdmin={isAdmin} seesCosts={seesCosts} />}
      {tab === 'services' && <ServicesTab isAdmin={isAdmin} seesCosts={seesCosts} />}
      {tab === 'categories' && <CategoriesTab isAdmin={isAdmin} />}
    </>
  );
}
