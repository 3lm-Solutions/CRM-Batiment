import { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Plus, Search, X } from 'lucide-react';
import { api, CataloguePrestation } from '../api';
import { formatCurrency } from '../utils/calculations';

interface AddPrestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPrestation: (prestationId: number) => void;
}

export const AddPrestationModal = ({ isOpen, onClose, onAddPrestation }: AddPrestationModalProps) => {
  const [catalogue, setCatalogue] = useState<CataloguePrestation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || catalogue.length) return;
    api<{ prestations: CataloguePrestation[] }>('/api/catalogue')
      .then((data) => setCatalogue(data.prestations))
      .catch((err) => setError(err instanceof Error ? err.message : 'Catalogue indisponible.'));
  }, [isOpen, catalogue.length]);

  const filtered = useMemo(() => catalogue.filter((item) =>
    `${item.nom} ${item.categorie || ''}`.toLowerCase().includes(searchTerm.toLowerCase())), [catalogue, searchTerm]);

  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
    <div className="relative w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800 border border-amber-200"><Layers className="h-5 w-5" /></div><div><h3 className="text-base font-bold text-stone-900">Ajouter une prestation du catalogue</h3><p className="text-xs text-stone-500">Catalogue connecté au backend</p></div></div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher une prestation…" className="w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-9 pr-4 py-2 text-xs font-medium focus:bg-white focus:border-amber-600 focus:outline-none" /></div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p> : <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-100">
        {filtered.map((item) => <button key={item.id} type="button" onClick={() => { onAddPrestation(item.id); onClose(); }} className="w-full flex items-center justify-between gap-4 pt-3 pb-2 hover:bg-amber-50/50 p-2.5 rounded-xl text-left group">
          <div className="space-y-1"><div className="text-[11px] font-bold text-amber-800">{item.categorie || 'Catalogue'}</div><h4 className="text-sm font-bold text-stone-900">{item.nom}</h4><p className="text-xs text-stone-500">{formatCurrency(item.prix_vente_min)} – {formatCurrency(item.prix_vente_max)} / {item.unite}</p></div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-stone-100 group-hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-stone-700 group-hover:text-white"><Plus className="h-3.5 w-3.5" />Ajouter</span>
        </button>)}
        {!filtered.length && <div className="py-8 text-center text-xs text-stone-400">Aucune prestation ne correspond à votre recherche.</div>}
      </div>}
      {catalogue.length === 0 && !error && <p className="text-xs text-stone-500 text-center">Chargement du catalogue…</p>}
    </div>
  </div>;
};
