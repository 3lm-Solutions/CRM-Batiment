import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, History, Loader2, Pencil, Search, SlidersHorizontal, X } from 'lucide-react';
import api from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { StockMaterial, StockMovement, StockResponse } from '@/types';

const statusLabels = { DISPONIBLE: 'Disponible', BAS: 'Stock bas', RUPTURE: 'Rupture' } as const;
const statusStyles = {
  DISPONIBLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BAS: 'bg-amber-50 text-amber-700 border-amber-200',
  RUPTURE: 'bg-red-50 text-red-700 border-red-200',
} as const;

function apiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return 'L’opération a échoué.';
}

export default function StockPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StockMaterial | null>(null);
  const [movementForm, setMovementForm] = useState({ type: 'ENTREE' as 'ENTREE' | 'SORTIE' | 'AJUSTEMENT', quantite: '', motif: '', reference: '' });
  const [thresholdMaterial, setThresholdMaterial] = useState<StockMaterial | null>(null);
  const [threshold, setThreshold] = useState('');

  const stockQuery = useQuery({
    queryKey: ['stock', search],
    queryFn: async () => {
      const response = await api.get<StockResponse>('/stock', { params: { search: search.trim() || undefined } });
      return response.data;
    },
  });

  const movementsQuery = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const response = await api.get<StockMovement[]>('/stock/mouvements', { params: { limit: 40 } });
      return response.data;
    },
  });

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Aucun matériau sélectionné.');
      return api.post('/stock/mouvements', {
        materiauId: selected.id,
        type: movementForm.type,
        quantite: Number(movementForm.quantite),
        motif: movementForm.motif.trim() || undefined,
        reference: movementForm.reference.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSelected(null);
      setMovementForm({ type: 'ENTREE', quantite: '', motif: '', reference: '' });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    },
  });

  const thresholdMutation = useMutation({
    mutationFn: async () => {
      if (!thresholdMaterial) throw new Error('Aucun matériau sélectionné.');
      return api.patch(`/stock/materiaux/${thresholdMaterial.id}/seuil`, { stockMinimum: Number(threshold) });
    },
    onSuccess: () => {
      setThresholdMaterial(null);
      setThreshold('');
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  const items = stockQuery.data?.items ?? [];
  const summary = stockQuery.data?.summary;
  const movements = useMemo(() => movementsQuery.data ?? [], [movementsQuery.data]);

  function openMovement(material: StockMaterial, type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT') {
    setSelected(material);
    setMovementForm({ type, quantite: '', motif: '', reference: '' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-950"><Boxes className="text-blue-600" /> Gestion du stock</h1>
        <p className="mt-1 text-sm text-slate-500">Suivez les quantités disponibles, les seuils d’alerte et tous les mouvements de matériaux.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Références" value={summary?.totalReferences ?? 0} tone="blue" />
        <Metric label="Stocks bas" value={summary?.stockBas ?? 0} tone="amber" />
        <Metric label="Ruptures" value={summary?.ruptures ?? 0} tone="red" />
        <Metric label="Valeur du stock" value={formatCurrency(summary?.valeurTotale ?? 0)} tone="green" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un matériau…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white" />
          </div>
          <p className="text-xs text-slate-500">Une sortie impossible est bloquée si le stock devient négatif.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left">Matériau</th><th className="px-5 py-3 text-left">Fournisseur</th><th className="px-5 py-3 text-right">Stock</th><th className="px-5 py-3 text-right">Seuil</th><th className="px-5 py-3 text-left">État</th><th className="px-5 py-3 text-right">Valeur</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {stockQuery.isLoading ? <tr><td colSpan={7} className="p-12 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" /></td></tr> : items.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-slate-500">Aucun matériau trouvé.</td></tr> : items.map((material) => (
                <tr key={material.id} className="hover:bg-blue-50/30">
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{material.nom}</p><p className="text-xs text-slate-500">{material.unite}</p></td>
                  <td className="px-5 py-4 text-slate-600">{material.fournisseur?.nom ?? '—'}</td>
                  <td className="px-5 py-4 text-right font-bold text-slate-900">{material.stockActuel}</td>
                  <td className="px-5 py-4 text-right text-slate-600">{material.stockMinimum}</td>
                  <td className="px-5 py-4"><span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', statusStyles[material.statutStock])}>{statusLabels[material.statutStock]}</span></td>
                  <td className="px-5 py-4 text-right font-medium text-slate-700">{formatCurrency(material.valeurStock)}</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => openMovement(material, 'ENTREE')} title="Entrée de stock" className="rounded-xl border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50"><ArrowDownToLine size={15} /></button>
                    <button type="button" onClick={() => openMovement(material, 'SORTIE')} title="Sortie de stock" className="rounded-xl border border-amber-200 p-2 text-amber-600 hover:bg-amber-50"><ArrowUpFromLine size={15} /></button>
                    <button type="button" onClick={() => openMovement(material, 'AJUSTEMENT')} title="Ajuster le stock" className="rounded-xl border border-blue-200 p-2 text-blue-600 hover:bg-blue-50"><SlidersHorizontal size={15} /></button>
                    <button type="button" onClick={() => { setThresholdMaterial(material); setThreshold(String(material.stockMinimum)); }} title="Modifier le seuil" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Pencil size={15} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><History size={18} className="text-blue-600" /><h2 className="font-bold text-slate-900">Historique des mouvements</h2></div>
        {movementsQuery.isLoading ? <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></div> : movements.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Aucun mouvement enregistré.</div> : <div className="divide-y divide-slate-100">{movements.map((movement) => (
          <div key={movement.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1.2fr_.7fr_.8fr_1.5fr] sm:items-center">
            <div><p className="font-semibold text-slate-900">{movement.materiau.nom}</p><p className="text-xs text-slate-500">{formatDate(movement.createdAt)}</p></div>
            <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold', movement.type === 'ENTREE' ? 'bg-emerald-50 text-emerald-700' : movement.type === 'SORTIE' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')}>{movement.type}</span>
            <p className="font-medium text-slate-700">{movement.stockAvant} → {movement.stockApres} {movement.materiau.unite}</p>
            <div><p className="text-slate-600">{movement.motif || 'Sans motif'}</p><p className="text-xs text-slate-400">{movement.reference || 'Sans référence'}{movement.user ? ` · ${movement.user.prenom} ${movement.user.nom}` : ''}</p></div>
          </div>
        ))}</div>}
      </section>

      {selected ? (
        <Modal title={`${movementForm.type === 'ENTREE' ? 'Entrée' : movementForm.type === 'SORTIE' ? 'Sortie' : 'Ajustement'} — ${selected.nom}`} onClose={() => setSelected(null)}>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); movementMutation.mutate(); }}>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Stock actuel : <strong>{selected.stockActuel} {selected.unite}</strong>{movementForm.type === 'AJUSTEMENT' ? ' — saisissez la nouvelle quantité totale.' : ''}</div>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Quantité *</span><input required type="number" min="0" step="0.01" value={movementForm.quantite} onChange={(event) => setMovementForm((current) => ({ ...current, quantite: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Motif</span><input value={movementForm.motif} onChange={(event) => setMovementForm((current) => ({ ...current, motif: event.target.value }))} placeholder="Réception, utilisation chantier, inventaire…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Référence</span><input value={movementForm.reference} onChange={(event) => setMovementForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Commande ou chantier" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></label>
            {movementMutation.error ? <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{apiError(movementMutation.error)}</p> : null}
            <button type="submit" disabled={movementMutation.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{movementMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Enregistrer le mouvement</button>
          </form>
        </Modal>
      ) : null}

      {thresholdMaterial ? (
        <Modal title={`Seuil d’alerte — ${thresholdMaterial.nom}`} onClose={() => setThresholdMaterial(null)}>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); thresholdMutation.mutate(); }}>
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Stock minimum *</span><input required type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></label>
            <button type="submit" disabled={thresholdMutation.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{thresholdMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null} Enregistrer le seuil</button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: 'blue' | 'amber' | 'red' | 'green' }) {
  const styles = { blue: 'border-blue-100 bg-blue-50 text-blue-700', amber: 'border-amber-100 bg-amber-50 text-amber-700', red: 'border-red-100 bg-red-50 text-red-700', green: 'border-emerald-100 bg-emerald-50 text-emerald-700' };
  return <div className={cn('rounded-3xl border p-5', styles[tone])}><p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-950">{title}</h2><button type="button" onClick={onClose} aria-label="Fermer" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={17} /></button></div>{children}</div></div>;
}
