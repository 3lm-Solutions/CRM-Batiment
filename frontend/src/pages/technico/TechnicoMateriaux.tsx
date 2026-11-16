import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Materiau } from '@/types';
import {
  Search,
  X,
  Package,
  Palette,
  Ruler,
} from 'lucide-react';

export default function TechnicoMateriaux() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const { data: materiauxData, isLoading } = useQuery({
    queryKey: ['technico-materiaux'],
    queryFn: async () => {
      const res = await api.get('/materiaux', { params: { limit: 200 } });
      return (res.data?.data ?? res.data) as Materiau[];
    },
  });

  const allMateriaux = materiauxData ?? [];
  const filtered = (search
    ? allMateriaux.filter(
        (m) =>
          m.nom.toLowerCase().includes(search.toLowerCase()) ||
          m.couleur?.toLowerCase().includes(search.toLowerCase()) ||
          m.finition?.toLowerCase().includes(search.toLowerCase()),
      )
    : allMateriaux
  ).sort((a, b) => {
    if (sortBy === 'priceDesc') return (b.prixAchatFixe ?? 0) - (a.prixAchatFixe ?? 0);
    if (sortBy === 'priceAsc') return (a.prixAchatFixe ?? 0) - (b.prixAchatFixe ?? 0);
    if (sortBy === 'supplier') return (a.fournisseur?.nom ?? '').localeCompare(b.fournisseur?.nom ?? '');
    return a.nom.localeCompare(b.nom);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Catalogue Matériaux</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {allMateriaux.length} matériaux disponibles pour vos devis
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex max-w-md flex-1 items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, couleur, finition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500">
              <X size={16} />
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 shadow-sm outline-none"
          aria-label="Trier les matériaux"
        >
          <option value="name">Tri : nom A-Z</option>
          <option value="priceAsc">Tri : prix croissant</option>
          <option value="priceDesc">Tri : prix décroissant</option>
          <option value="supplier">Tri : fournisseur</option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-900">Aucun matériau trouvé</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                  <Package size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">{m.nom}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.couleur && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[11px] font-medium">
                        <Palette size={10} /> {m.couleur}
                      </span>
                    )}
                    {m.finition && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-medium">
                        {m.finition}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Ruler size={12} />
                  <span>{m.unite}</span>
                </div>
                <span className="text-sm font-extrabold text-amber-700">
                  {formatCurrency(m.prixAchatFixe)}
                </span>
              </div>
              {m.fournisseur && (
                <div className="mt-2 text-[11px] text-gray-400">
                  Fournisseur : {m.fournisseur.nom}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
