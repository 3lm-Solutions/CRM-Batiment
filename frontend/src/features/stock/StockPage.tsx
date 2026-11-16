import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, DataTable, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Select, statusOptions, StatusBadge, Tabs } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatEuros, formatNumber, formatUnite, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useChantiers } from '../chantiers/api';
import { useCreateMouvement, useMouvements, useStock, type StockItem, type TypeMouvement } from './api';

const TYPE_HELP: Record<TypeMouvement, { label: string; quantite: string }> = {
  ENTREE: { label: 'Entrée', quantite: 'Quantité entrée' },
  SORTIE: { label: 'Sortie', quantite: 'Quantité sortie' },
  AJUSTEMENT: { label: 'Inventaire', quantite: 'Stock compté (nouvelle valeur)' },
};

function MouvementModal({ item, type, onClose }: { item: StockItem | null; type: TypeMouvement; onClose: () => void }) {
  const create = useCreateMouvement();
  const chantiers = useChantiers({ page: 1, limit: 100, statuts: ['PLANIFIE', 'EN_COURS', 'SUSPENDU'] }, !!item && type !== 'AJUSTEMENT');
  const [quantite, setQuantite] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [motif, setMotif] = useState('');
  useEffect(() => {
    setQuantite('');
    setChantierId('');
    setMotif('');
  }, [item, type]);

  if (!item) return null;
  const q = Number(quantite);
  const valid = quantite !== '' && (type === 'AJUSTEMENT' ? q >= 0 : q > 0);
  const insufficient = type === 'SORTIE' && q > item.stockActuel;
  const after = type === 'AJUSTEMENT' ? q : type === 'ENTREE' ? item.stockActuel + q : item.stockActuel - q;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${TYPE_HELP[type].label} — ${item.nom}`}
      description={`Stock actuel : ${formatNumber(item.stockActuel)} ${formatUnite(item.unite)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!valid || insufficient}
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { materiauId: item.id, type, quantite: q, chantierId: chantierId ? Number(chantierId) : undefined, motif: motif.trim() || undefined },
                { onSuccess: () => { toast.success('Mouvement enregistré'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={`${TYPE_HELP[type].quantite} (${formatUnite(item.unite)})`}
          type="number"
          min={0}
          step="0.001"
          required
          value={quantite}
          error={insufficient ? 'Stock insuffisant' : undefined}
          hint={valid && !insufficient ? `Stock après : ${formatNumber(after)} ${formatUnite(item.unite)}` : undefined}
          onChange={(e) => setQuantite(e.target.value)}
        />
        {type !== 'AJUSTEMENT' && (
          <Select
            label="Chantier"
            placeholder="Aucun"
            options={(chantiers.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.reference} · ${fullName(c.client)}` }))}
            value={chantierId}
            onChange={(e) => setChantierId(e.target.value)}
          />
        )}
        <Input label="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={type === 'AJUSTEMENT' ? 'Inventaire annuel' : 'Casse, retour, achat comptoir…'} />
      </div>
    </Modal>
  );
}

function Niveaux() {
  const { hasRole } = useAuth();
  const seesCosts = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const [query, setQuery] = useState({ page: 1, search: '', alerte: false });
  const stock = useStock(query);
  const [mouvement, setMouvement] = useState<{ item: StockItem; type: TypeMouvement } | null>(null);
  const iconBtn = 'rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white';

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
        <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Matériau…" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-700" checked={query.alerte} onChange={(e) => setQuery((q) => ({ ...q, alerte: e.target.checked, page: 1 }))} />
          Sous le seuil uniquement
        </label>
      </div>
      {stock.isError ? (
        <div className="p-4"><ErrorState error={stock.error} onRetry={() => void stock.refetch()} /></div>
      ) : (
        <DataTable
          loading={stock.isPending}
          rows={stock.data?.data}
          rowKey={(m) => m.id}
          empty={{ title: query.alerte ? 'Aucun matériau en alerte' : 'Aucun matériau', description: 'Les matériaux se gèrent dans le catalogue.' }}
          columns={[
            {
              key: 'nom',
              header: 'Matériau',
              cell: (m) => (
                <div>
                  <p className="font-medium">{m.nom}</p>
                  {m.fournisseur && <p className="text-xs text-slate-500">{m.fournisseur.nom}</p>}
                </div>
              ),
            },
            {
              key: 'stock',
              header: 'Stock',
              align: 'right',
              cell: (m) => (
                <span className={m.alerte ? 'inline-flex items-center gap-1 font-semibold text-amber-700' : 'tabular-nums'}>
                  {m.alerte && <TriangleAlert className="size-4" aria-label="Sous le seuil" />}
                  {formatNumber(m.stockActuel)} {formatUnite(m.unite)}
                </span>
              ),
            },
            { key: 'min', header: 'Seuil', align: 'right', cell: (m) => <span className="tabular-nums text-slate-500">{formatNumber(m.stockMinimum)}</span> },
            ...(seesCosts ? [{ key: 'valeur', header: 'Valeur', align: 'right' as const, cell: (m: StockItem) => <span className="tabular-nums">{formatEuros(m.valeurStock)}</span> }] : []),
            {
              key: 'actions',
              header: <span className="sr-only">Mouvements</span>,
              align: 'right',
              cell: (m) => (
                <span className="inline-flex gap-1">
                  <button type="button" className={iconBtn} title="Entrée" aria-label={`Entrée ${m.nom}`} onClick={() => setMouvement({ item: m, type: 'ENTREE' })}><ArrowDownToLine className="size-4" /></button>
                  <button type="button" className={iconBtn} title="Sortie" aria-label={`Sortie ${m.nom}`} onClick={() => setMouvement({ item: m, type: 'SORTIE' })}><ArrowUpFromLine className="size-4" /></button>
                  <button type="button" className={iconBtn} title="Inventaire" aria-label={`Inventaire ${m.nom}`} onClick={() => setMouvement({ item: m, type: 'AJUSTEMENT' })}><SlidersHorizontal className="size-4" /></button>
                </span>
              ),
            },
          ]}
        />
      )}
      <Pagination meta={stock.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      <MouvementModal item={mouvement?.item ?? null} type={mouvement?.type ?? 'ENTREE'} onClose={() => setMouvement(null)} />
    </Card>
  );
}

function Historique() {
  const [query, setQuery] = useState<{ page: number; type: TypeMouvement | '' }>({ page: 1, type: '' });
  const mouvements = useMouvements(query);
  return (
    <Card>
      <div className="border-b border-gray-100 px-6 py-4 dark:border-slate-800">
        <Select
          aria-label="Type de mouvement"
          containerClassName="w-52"
          placeholder="Tous les mouvements"
          options={statusOptions('mouvement')}
          value={query.type}
          onChange={(e) => setQuery({ page: 1, type: e.target.value as TypeMouvement | '' })}
        />
      </div>
      {mouvements.isError ? (
        <div className="p-4"><ErrorState error={mouvements.error} onRetry={() => void mouvements.refetch()} /></div>
      ) : (
        <DataTable
          loading={mouvements.isPending}
          rows={mouvements.data?.data}
          rowKey={(m) => m.id}
          empty={{ title: 'Aucun mouvement' }}
          columns={[
            { key: 'date', header: 'Date', cell: (m) => formatDateTime(m.createdAt) },
            { key: 'type', header: 'Type', cell: (m) => <StatusBadge kind="mouvement" value={m.type} /> },
            { key: 'materiau', header: 'Matériau', cell: (m) => m.materiau.nom },
            { key: 'qte', header: 'Quantité', align: 'right', cell: (m) => <span className="tabular-nums">{formatNumber(m.quantite)} {formatUnite(m.materiau.unite)}</span> },
            { key: 'stock', header: 'Stock', align: 'right', cell: (m) => <span className="tabular-nums text-slate-500">{formatNumber(m.stockAvant)} → {formatNumber(m.stockApres)}</span> },
            {
              key: 'contexte',
              header: 'Contexte',
              cell: (m) => (
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {[m.chantier?.reference, m.reference, m.motif].filter(Boolean).join(' · ') || '—'}
                  {m.user && <Badge className="ml-2">{fullName(m.user)}</Badge>}
                </span>
              ),
            },
          ]}
        />
      )}
      <Pagination meta={mouvements.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
    </Card>
  );
}

export function StockPage() {
  const [tab, setTab] = useState<'niveaux' | 'historique'>('niveaux');
  return (
    <>
      <PageHeader title="Stock" description="Niveaux des matériaux, alertes de réapprovisionnement et mouvements. Les livraisons fournisseur alimentent le stock automatiquement." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'niveaux', label: 'Niveaux' }, { value: 'historique', label: 'Mouvements' }]} />
      {tab === 'niveaux' ? <Niveaux /> : <Historique />}
    </>
  );
}
