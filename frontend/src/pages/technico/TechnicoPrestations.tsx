import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { CatalogueCategorieWithCompositions, OptionPrestation } from '@/types';
import {
  Search,
  X,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Settings2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export default function TechnicoPrestations() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<number>>(new Set());
  const [expandedPrestations, setExpandedPrestations] = useState<Set<number>>(new Set());

  const { data: catalogue, isLoading } = useQuery({
    queryKey: ['technico-catalogue'],
    queryFn: async () => {
      const res = await api.get('/prestations/catalogue');
      return res.data as CatalogueCategorieWithCompositions[];
    },
  });

  function toggle(_set: Set<number>, id: number, setter: React.Dispatch<React.SetStateAction<Set<number>>>) {
    setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function expandAll() {
    if (!catalogue) return;
    const cats = new Set<number>();
    const subs = new Set<number>();
    catalogue.forEach(c => { cats.add(c.id); c.sousCategories?.forEach(sc => subs.add(sc.id)); });
    setExpandedCats(cats);
    setExpandedSubs(subs);
  }
  function collapseAll() {
    setExpandedCats(new Set());
    setExpandedSubs(new Set());
    setExpandedPrestations(new Set());
  }

  // Filter
  const filteredCatalogue = catalogue?.map(cat => {
    if (!search) return cat;
    const lc = search.toLowerCase();
    const filteredSubs = cat.sousCategories?.map(sc => {
      const fp = sc.prestations?.filter(p =>
        p.nom.toLowerCase().includes(lc) || p.description?.toLowerCase().includes(lc) || sc.nom.toLowerCase().includes(lc) || cat.nom.toLowerCase().includes(lc)
      ) ?? [];
      return { ...sc, prestations: fp };
    }).filter(sc => sc.prestations.length > 0) ?? [];
    const filteredDirect = cat.prestations?.filter(p =>
      p.nom.toLowerCase().includes(lc) || p.description?.toLowerCase().includes(lc) || cat.nom.toLowerCase().includes(lc)
    ) ?? [];
    return { ...cat, sousCategories: filteredSubs, prestations: filteredDirect };
  }).filter(cat => (cat.sousCategories?.length ?? 0) > 0 || (cat.prestations?.length ?? 0) > 0)
    .sort((a, b) => {
      const countA = (a.sousCategories?.reduce((sum, sc) => sum + (sc.prestations?.length ?? 0), 0) ?? 0) + (a.prestations?.length ?? 0);
      const countB = (b.sousCategories?.reduce((sum, sc) => sum + (sc.prestations?.length ?? 0), 0) ?? 0) + (b.prestations?.length ?? 0);
      if (sortBy === 'count') return countB - countA;
      return a.nom.localeCompare(b.nom);
    }) ?? [];

  // Totals
  let totalPrestations = 0;
  let totalSousCat = 0;
  catalogue?.forEach(cat => {
    cat.sousCategories?.forEach(sc => { totalSousCat++; totalPrestations += sc.prestations?.length ?? 0; });
    totalPrestations += cat.prestations?.length ?? 0;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Layers size={22} className="text-teal-600" />
          Catalogue Prestations
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {catalogue?.length ?? 0} catégories • {totalSousCat} sous-catégories • {totalPrestations} prestations
        </p>
      </div>

      {/* Search + controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all flex-1 max-w-md">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans le catalogue..."
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
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 outline-none"
          aria-label="Trier les prestations"
        >
          <option value="name">Tri : catégorie A-Z</option>
          <option value="count">Tri : plus fournies</option>
        </select>
        <button onClick={expandAll} className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-teal-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
          Tout déplier
        </button>
        <button onClick={collapseAll} className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-teal-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
          Tout replier
        </button>
      </div>

      {/* Catalogue tree */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-teal-500" size={28} />
        </div>
      ) : filteredCatalogue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
          <h3 className="font-semibold text-gray-900">Aucune prestation trouvée</h3>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCatalogue.map(cat => {
            const catPrestCount = (cat.sousCategories?.reduce((a, sc) => a + (sc.prestations?.length ?? 0), 0) ?? 0) + (cat.prestations?.length ?? 0);
            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Catégorie */}
                <button
                  onClick={() => toggle(expandedCats, cat.id, setExpandedCats)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                >
                  {expandedCats.has(cat.id) ? <ChevronDown size={18} className="text-teal-500" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <div className="w-8 h-8 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-xl flex items-center justify-center">
                    <Layers size={16} className="text-teal-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-sm font-bold text-gray-900">{cat.nom}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md font-medium">{cat.sousCategories?.length ?? 0} sous-cat.</span>
                    <span className="bg-teal-50 text-teal-600 px-2 py-0.5 rounded-md font-medium">{catPrestCount} prest.</span>
                  </div>
                </button>

                {expandedCats.has(cat.id) && (
                  <div className="border-t border-gray-100">
                    {/* Direct prestations */}
                    {cat.prestations?.map(p => (
                      <TechnicoPrestationRow
                        key={p.id}
                        prestation={p}
                        expanded={expandedPrestations.has(p.id)}
                        onToggle={() => toggle(expandedPrestations, p.id, setExpandedPrestations)}
                        indent={1}
                      />
                    ))}

                    {/* Sous-catégories */}
                    {cat.sousCategories?.map(sc => (
                      <div key={sc.id}>
                        <button
                          onClick={() => toggle(expandedSubs, sc.id, setExpandedSubs)}
                          className="w-full flex items-center gap-3 pl-12 pr-5 py-2.5 hover:bg-gray-50/50 transition-colors border-t border-gray-50"
                        >
                          {expandedSubs.has(sc.id) ? <ChevronDown size={15} className="text-emerald-500" /> : <ChevronRight size={15} className="text-gray-400" />}
                          <FolderOpen size={15} className="text-emerald-500" />
                          <span className="flex-1 text-left text-[13px] font-semibold text-gray-700">{sc.nom}</span>
                          <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{sc.prestations?.length ?? 0}</span>
                        </button>

                        {expandedSubs.has(sc.id) && sc.prestations?.map(p => (
                          <TechnicoPrestationRow
                            key={p.id}
                            prestation={p}
                            expanded={expandedPrestations.has(p.id)}
                            onToggle={() => toggle(expandedPrestations, p.id, setExpandedPrestations)}
                            indent={2}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Prestation row (levels 3-5)
// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

function TechnicoPrestationRow({
  prestation: p,
  expanded,
  onToggle,
  indent,
}: {
  prestation: CatalogueCategorieWithCompositions['prestations'][0];
  expanded: boolean;
  onToggle: () => void;
  indent: number;
}) {
  const hasOptions = (p.options?.length ?? 0) > 0;
  const pl = indent === 1 ? 'pl-14' : 'pl-20';

  return (
    <div className="border-t border-gray-50">
      <div className={cn('flex items-center gap-3 pr-5 py-2.5 hover:bg-teal-50/30 transition-colors', pl)}>
        {hasOptions ? (
          <button onClick={onToggle} className="shrink-0">
            {expanded ? <ChevronDown size={14} className="text-amber-500" /> : <ChevronRight size={14} className="text-gray-400" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <div className="w-7 h-7 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center shrink-0">
          <BookOpen size={13} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-gray-900">{p.nom}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] font-medium text-gray-500 rounded">{p.unite}</span>
            {hasOptions && (
              <span className="px-1.5 py-0.5 bg-amber-50 text-[10px] font-medium text-amber-600 rounded border border-amber-100">
                {p.options!.length} opt.
              </span>
            )}
          </div>
          {p.description && <p className="text-[11px] text-gray-400 truncate max-w-md">{p.description}</p>}
        </div>
        <span className="text-sm font-bold text-teal-700 whitespace-nowrap">
          {formatCurrency(p.prixVenteMin)} – {formatCurrency(p.prixVenteMax)}
        </span>
      </div>

      {/* Options & Choix */}
      {expanded && hasOptions && (
        <div className={cn('pb-3 space-y-2', indent === 1 ? 'pl-24 pr-5' : 'pl-28 pr-5')}>
          {p.options!.map(opt => (
            <TechnicoOptionBlock key={opt.id} option={opt} />
          ))}
        </div>
      )}
    </div>
  );
}

// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Option block (level 4) + Choix (level 5)
// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

function TechnicoOptionBlock({ option }: { option: OptionPrestation }) {
  return (
    <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 size={13} className="text-amber-500" />
        <span className="text-xs font-bold text-gray-700">{option.nom}</span>
        {option.obligatoire && (
          <span className="px-1.5 py-0.5 bg-red-50 text-[10px] font-semibold text-red-500 rounded border border-red-100">
            Obligatoire
          </span>
        )}
        {option.description && <span className="text-[11px] text-gray-400 ml-1">— {option.description}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {option.choix.map(ch => (
          <div key={ch.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs hover:border-teal-300 transition-colors">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="font-medium text-gray-700">{ch.nom}</span>
            {ch.impactPrix !== 0 && (
              <span className={cn('font-semibold', ch.impactPrix > 0 ? 'text-emerald-600' : 'text-red-500')}>
                {ch.impactPrix > 0 ? '+' : ''}{formatCurrency(ch.impactPrix)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
