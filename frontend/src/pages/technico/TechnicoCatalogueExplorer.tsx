import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type {
  CatalogueCategorieWithCompositions,
  OptionPrestation,
  ChoixOption,
  Prestation,
  QuestionDiagnostic,
  InfoRequise,
} from '@/types';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  Settings2,
  CheckCircle2,
  Loader2,
  Layers,
  BookOpen,
  HelpCircle,
  ClipboardList,
  Ruler,
  Camera,
  Eye,
  ListChecks,
  Info,
  ArrowRight,
  Tag,
  Edit,
  Trash2,
  Save,
} from 'lucide-react';

// ====================================================
// Types locaux pour la navigation par breadcrumb
// ====================================================

type ViewLevel = 'categories' | 'sousCategories' | 'prestations' | 'detail';

interface BreadcrumbItem {
  label: string;
  level: ViewLevel;
  catId?: number;
  scId?: number;
  prestId?: number;
}

type EditableEntity =
  | { type: 'categorie'; id: number; nom: string; description?: string }
  | { type: 'sousCategorie'; id: number; nom: string; description?: string }
  | { type: 'option'; id: number; nom: string; description?: string; obligatoire: boolean }
  | { type: 'choixOption'; id: number; nom: string; description?: string; impactPrix: number };

type DeletableEntity = {
  type: 'categorie' | 'sousCategorie' | 'prestation' | 'option' | 'choixOption';
  id: number;
  nom: string;
};

// ====================================================
// COMPOSANT PRINCIPAL
// ====================================================

export default function TechnicoCatalogueExplorer() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count'>('name');
  const [currentCatId, setCurrentCatId] = useState<number | null>(null);
  const [currentScId, setCurrentScId] = useState<number | null>(null);
  const [currentPrestId, setCurrentPrestId] = useState<number | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('categories');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPrestForAction, setSelectedPrestForAction] = useState<Prestation | null>(null);
  const [editEntity, setEditEntity] = useState<EditableEntity | null>(null);
  const [deleteEntity, setDeleteEntity] = useState<DeletableEntity | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: catalogue, isLoading } = useQuery({
    queryKey: ['catalogue-complet'],
    queryFn: async () => {
      const res = await api.get('/prestations/catalogue-complet');
      return res.data as CatalogueCategorieWithCompositions[];
    },
  });

  async function refreshCatalogue() {
    await queryClient.invalidateQueries({ queryKey: ['catalogue-complet'] });
  }

  function getErrorMessage(err: unknown, fallback: string) {
    const maybe = err as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
    };
    const msg = maybe.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    return fallback;
  }

  const updatePrestationMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      nom: string;
      description: string;
      unite: string;
      prixVenteMin: number;
      prixVenteMax: number;
    }) => {
      const { id, ...data } = payload;
      const res = await api.patch(`/prestations/${id}`, data);
      return res.data;
    },
    onSuccess: async () => {
      await refreshCatalogue();
      setEditModalOpen(false);
      setSelectedPrestForAction(null);
    },
    onError: (err: unknown) => {
      setActionError(getErrorMessage(err, 'Erreur lors de la modification de la prestation.'));
    },
  });

  const updateEntityMutation = useMutation({
    mutationFn: async (payload: EditableEntity) => {
      if (payload.type === 'categorie') {
        const res = await api.patch(`/prestations/categories/${payload.id}`, {
          nom: payload.nom,
          description: payload.description,
        });
        return res.data;
      }
      if (payload.type === 'sousCategorie') {
        const res = await api.patch(`/prestations/sous-categories/${payload.id}`, {
          nom: payload.nom,
          description: payload.description,
        });
        return res.data;
      }
      if (payload.type === 'choixOption') {
        const res = await api.patch(`/prestations/choix/${payload.id}`, {
          nom: payload.nom,
          description: payload.description,
          impactPrix: payload.impactPrix,
        });
        return res.data;
      }
      const res = await api.patch(`/prestations/options/${payload.id}`, {
        nom: payload.nom,
        description: payload.description,
        obligatoire: payload.obligatoire,
      });
      return res.data;
    },
    onSuccess: async () => {
      await refreshCatalogue();
      setEditEntity(null);
    },
    onError: (err: unknown) => {
      setActionError(getErrorMessage(err, 'Erreur lors de la modification.'));
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: async (payload: DeletableEntity) => {
      if (payload.type === 'categorie') {
        const res = await api.delete(`/prestations/categories/${payload.id}`);
        return res.data;
      }
      if (payload.type === 'sousCategorie') {
        const res = await api.delete(`/prestations/sous-categories/${payload.id}`);
        return res.data;
      }
      if (payload.type === 'option') {
        const res = await api.delete(`/prestations/options/${payload.id}`);
        return res.data;
      }
      if (payload.type === 'choixOption') {
        const res = await api.delete(`/prestations/choix/${payload.id}`);
        return res.data;
      }
      const res = await api.delete(`/prestations/${payload.id}`);
      return res.data;
    },
    onSuccess: async (_data, variables) => {
      await refreshCatalogue();
      if (variables.type === 'prestation' && currentPrestId === variables.id) {
        if (currentScId) setViewLevel('prestations');
        else setViewLevel('sousCategories');
        setCurrentPrestId(null);
      }
      setDeleteEntity(null);
    },
    onError: (err: unknown) => {
      setActionError(getErrorMessage(err, 'Erreur lors de la suppression.'));
    },
  });

  // ───── Navigation helpers ─────
  const currentCat = useMemo(
    () => catalogue?.find((c) => c.id === currentCatId) ?? null,
    [catalogue, currentCatId],
  );
  const currentSc = useMemo(
    () => currentCat?.sousCategories?.find((sc) => sc.id === currentScId) ?? null,
    [currentCat, currentScId],
  );
  const currentPrest = useMemo(() => {
    if (!currentPrestId) return null;
    const fromSc = currentSc?.prestations?.find((p) => p.id === currentPrestId);
    if (fromSc) return fromSc;
    return currentCat?.prestations?.find((p) => p.id === currentPrestId) ?? null;
  }, [currentSc, currentCat, currentPrestId]);

  function goToCategories() {
    setViewLevel('categories');
    setCurrentCatId(null);
    setCurrentScId(null);
    setCurrentPrestId(null);
  }
  function goToSousCategories(catId: number) {
    setViewLevel('sousCategories');
    setCurrentCatId(catId);
    setCurrentScId(null);
    setCurrentPrestId(null);
  }
  function goToPrestations(scId: number) {
    setViewLevel('prestations');
    setCurrentScId(scId);
    setCurrentPrestId(null);
  }
  function goToDetail(prestId: number) {
    setViewLevel('detail');
    setCurrentPrestId(prestId);
  }
  function goBack() {
    if (viewLevel === 'detail') {
      if (currentScId) setViewLevel('prestations');
      else setViewLevel('sousCategories');
      setCurrentPrestId(null);
    } else if (viewLevel === 'prestations') {
      setViewLevel('sousCategories');
      setCurrentScId(null);
    } else if (viewLevel === 'sousCategories') {
      goToCategories();
    }
  }

  function handleEditPrestation(presta: Prestation) {
    setActionError(null);
    setSelectedPrestForAction(presta);
    setEditModalOpen(true);
  }

  function handleDeletePrestation(presta: Prestation) {
    setActionError(null);
    setDeleteEntity({ type: 'prestation', id: presta.id, nom: presta.nom });
  }

  function handleEditCategorie(cat: { id: number; nom: string; description?: string }) {
    setActionError(null);
    setEditEntity({ type: 'categorie', id: cat.id, nom: cat.nom, description: cat.description });
  }

  function handleDeleteCategorie(cat: { id: number; nom: string }) {
    setActionError(null);
    setDeleteEntity({ type: 'categorie', id: cat.id, nom: cat.nom });
  }

  function handleEditSousCategorie(sc: { id: number; nom: string; description?: string }) {
    setActionError(null);
    setEditEntity({ type: 'sousCategorie', id: sc.id, nom: sc.nom, description: sc.description });
  }

  function handleDeleteSousCategorie(sc: { id: number; nom: string }) {
    setActionError(null);
    setDeleteEntity({ type: 'sousCategorie', id: sc.id, nom: sc.nom });
  }

  function handleEditOption(option: OptionPrestation) {
    setActionError(null);
    setEditEntity({
      type: 'option',
      id: option.id,
      nom: option.nom,
      description: option.description,
      obligatoire: option.obligatoire,
    });
  }

  function handleDeleteOption(option: OptionPrestation) {
    setActionError(null);
    setDeleteEntity({ type: 'option', id: option.id, nom: option.nom });
  }

  function handleEditChoix(choix: ChoixOption) {
    setActionError(null);
    setEditEntity({
      type: 'choixOption',
      id: choix.id,
      nom: choix.nom,
      description: choix.description,
      impactPrix: choix.impactPrix,
    });
  }

  function handleDeleteChoix(choix: ChoixOption) {
    setActionError(null);
    setDeleteEntity({ type: 'choixOption', id: choix.id, nom: choix.nom });
  }

  // ───── Breadcrumb ─────
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Catalogue', level: 'categories' }];
  if (currentCat && viewLevel !== 'categories') {
    breadcrumbs.push({ label: currentCat.nom, level: 'sousCategories', catId: currentCat.id });
  }
  if (currentSc && (viewLevel === 'prestations' || viewLevel === 'detail')) {
    breadcrumbs.push({ label: currentSc.nom, level: 'prestations', catId: currentCat!.id, scId: currentSc.id });
  }
  if (currentPrest && viewLevel === 'detail') {
    breadcrumbs.push({ label: currentPrest.nom, level: 'detail', prestId: currentPrest.id });
  }

  // ───── Search filter (global — categories level only) ─────
  const filteredCatalogue = useMemo(() => {
    if (!catalogue) return [];
    const lc = search.toLowerCase();
    const baseCatalogue = search
      ? catalogue.map((cat) => {
        const filteredSubs =
          cat.sousCategories
            ?.map((sc) => {
              const fp =
                sc.prestations?.filter(
                  (p) =>
                    p.nom.toLowerCase().includes(lc) ||
                    p.description?.toLowerCase().includes(lc) ||
                    sc.nom.toLowerCase().includes(lc) ||
                    cat.nom.toLowerCase().includes(lc),
                ) ?? [];
              return { ...sc, prestations: fp };
            })
            .filter((sc) => sc.prestations.length > 0) ?? [];
        return { ...cat, sousCategories: filteredSubs };
      })
      .filter((cat) => (cat.sousCategories?.length ?? 0) > 0)
      : [...catalogue];

    return baseCatalogue
      .sort((a, b) => {
        const countA =
          (a.sousCategories?.reduce((sum, sc) => sum + (sc.prestations?.length ?? 0), 0) ?? 0) +
          (a.prestations?.length ?? 0);
        const countB =
          (b.sousCategories?.reduce((sum, sc) => sum + (sc.prestations?.length ?? 0), 0) ?? 0) +
          (b.prestations?.length ?? 0);
        if (sortBy === 'count') return countB - countA;
        return a.nom.localeCompare(b.nom);
      });
  }, [catalogue, search, sortBy]);

  // ───── Stats ─────
  const stats = useMemo(() => {
    if (!catalogue) return { cats: 0, subs: 0, prests: 0 };
    let subs = 0,
      prests = 0;
    catalogue.forEach((c) => {
      c.sousCategories?.forEach((sc) => {
        subs++;
        prests += sc.prestations?.length ?? 0;
      });
      prests += c.prestations?.length ?? 0;
    });
    return { cats: catalogue.length, subs, prests };
  }, [catalogue]);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-teal-500" size={32} />
        <span className="ml-3 text-gray-500 text-sm">Chargement du catalogue...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Layers size={22} className="text-teal-600" />
          Explorateur Catalogue
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {stats.cats} catégories • {stats.subs} sous-catégories • {stats.prests} prestations
        </p>
      </div>

      {/* Breadcrumb */}
      {viewLevel !== 'categories' && (
        <div className="flex items-center gap-1.5 text-sm">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ChevronLeft size={16} />
            <span>Retour</span>
          </button>
          <span className="text-gray-300 mx-1">|</span>
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
              <button
                onClick={() => {
                  if (bc.level === 'categories') goToCategories();
                  else if (bc.level === 'sousCategories' && bc.catId) goToSousCategories(bc.catId);
                  else if (bc.level === 'prestations' && bc.scId) goToPrestations(bc.scId);
                }}
                className={cn(
                  'transition-colors',
                  i === breadcrumbs.length - 1
                    ? 'text-gray-900 font-semibold cursor-default'
                    : 'text-teal-600 hover:text-teal-700 font-medium',
                )}
              >
                {bc.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ═══════ VIEW: CATEGORIES ═══════ */}
      {viewLevel === 'categories' && (
        <>
          {/* Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all max-w-md">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher catégorie, sous-catégorie, prestation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-gray-300 hover:text-gray-500"
                  aria-label="Effacer la recherche"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'count')}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              aria-label="Trier le catalogue"
            >
              <option value="name">Trier par nom</option>
              <option value="count">Trier par nombre de prestations</option>
            </select>
          </div>

          {/* Category grid */}
          {filteredCatalogue.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
              <h3 className="font-semibold text-gray-900">Aucun résultat</h3>
              <p className="text-sm text-gray-400 mt-1">Essayez un autre terme de recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCatalogue.map((cat) => {
                const prestCount =
                  (cat.sousCategories?.reduce((a, sc) => a + (sc.prestations?.length ?? 0), 0) ?? 0) +
                  (cat.prestations?.length ?? 0);
                const questCount = cat.questionsDiagnostic?.length ?? 0;
                return (
                  <div
                    key={cat.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:border-teal-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-xl flex items-center justify-center group-hover:from-teal-200 group-hover:to-emerald-200 transition-colors">
                          <Layers size={20} className="text-teal-600" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCategorie(cat);
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          title="Modifier cette catégorie"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategorie(cat);
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
                          title="Supprimer cette catégorie"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <button
                        onClick={() => goToSousCategories(cat.id)}
                        className="p-1 rounded-md hover:bg-teal-50"
                        title="Voir les sous-catégories"
                      >
                        <ArrowRight size={16} className="text-gray-300 group-hover:text-teal-500 transition-colors mt-1" />
                      </button>
                    </div>
                    <button onClick={() => goToSousCategories(cat.id)} className="text-left">
                      <h3 className="text-sm font-bold text-gray-900 mb-1">{cat.nom}</h3>
                    </button>
                    {cat.description && (
                      <p className="text-[11px] text-gray-400 mb-3 line-clamp-2">{cat.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                        {cat.sousCategories?.length ?? 0} sous-cat.
                      </span>
                      <span className="text-[11px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md font-medium">
                        {prestCount} prestations
                      </span>
                      {questCount > 0 && (
                        <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
                          {questCount} questions
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ VIEW: SOUS-CATÉGORIES ═══════ */}
      {viewLevel === 'sousCategories' && currentCat && (
        <div className="space-y-4">
          {/* Category header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-xl flex items-center justify-center">
                <Layers size={20} className="text-teal-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{currentCat.nom}</h3>
                {currentCat.description && (
                  <p className="text-xs text-gray-400">{currentCat.description}</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => handleEditCategorie(currentCat)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                  title="Modifier cette catégorie"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteCategorie(currentCat)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
                  title="Supprimer cette catégorie"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Questions diagnostiques de la catégorie */}
            {(currentCat.questionsDiagnostic?.length ?? 0) > 0 && (
              <QuestionsBlock
                questions={currentCat.questionsDiagnostic ?? []}
                title="Questions diagnostiques pour cette catégorie"
              />
            )}
          </div>

          {/* Sous-catégories list  */}
          {(currentCat.sousCategories?.length ?? 0) === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <FolderOpen size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Aucune sous-catégorie</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentCat.sousCategories?.map((sc) => {
                const prestCount = sc.prestations?.length ?? 0;
                const questCount = sc.questionsDiagnostic?.length ?? 0;
                return (
                  <div
                    key={sc.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl flex items-center justify-center group-hover:from-emerald-100 group-hover:to-green-200 transition-colors">
                          <FolderOpen size={18} className="text-emerald-600" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSousCategorie(sc);
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          title="Modifier cette sous-catégorie"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSousCategorie(sc);
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
                          title="Supprimer cette sous-catégorie"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <button
                        onClick={() => goToPrestations(sc.id)}
                        className="p-1 rounded-md hover:bg-emerald-50"
                        title="Voir les prestations"
                      >
                        <ArrowRight size={14} className="text-gray-300 group-hover:text-emerald-500 transition-colors mt-1" />
                      </button>
                    </div>
                    <button onClick={() => goToPrestations(sc.id)} className="text-left">
                      <h4 className="text-sm font-bold text-gray-900 mb-1">{sc.nom}</h4>
                    </button>
                    {sc.description && (
                      <p className="text-[11px] text-gray-400 mb-2 line-clamp-2">{sc.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md font-medium">
                        {prestCount} prestations
                      </span>
                      {questCount > 0 && (
                        <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">
                          {questCount} quest.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Direct prestations (sans sous-catégorie) */}
          {(currentCat.prestations?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                Prestations directes
              </h4>
              <div className="space-y-2">
                {currentCat.prestations?.map((p) => (
                  <PrestationCard
                    key={p.id}
                    prestation={p}
                    onClick={() => goToDetail(p.id)}
                    onEdit={handleEditPrestation}
                    onDelete={handleDeletePrestation}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ VIEW: PRESTATIONS ═══════ */}
      {viewLevel === 'prestations' && currentSc && (
        <div className="space-y-4">
          {/* Sous-catégorie header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl flex items-center justify-center">
                <FolderOpen size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{currentSc.nom}</h3>
                {currentSc.description && (
                  <p className="text-xs text-gray-400">{currentSc.description}</p>
                )}
              </div>
              <span className="ml-auto text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-medium">
                {currentSc.prestations?.length ?? 0} prestations
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEditSousCategorie(currentSc)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
                  title="Modifier cette sous-catégorie"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteSousCategorie(currentSc)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
                  title="Supprimer cette sous-catégorie"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Questions diagnostiques de la sous-catégorie */}
            {(currentSc.questionsDiagnostic?.length ?? 0) > 0 && (
              <QuestionsBlock
                questions={currentSc.questionsDiagnostic ?? []}
                title="Questions à poser au client"
              />
            )}
          </div>

          {/* Prestations list */}
          {(currentSc.prestations?.length ?? 0) === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <BookOpen size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Aucune prestation dans cette sous-catégorie</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentSc.prestations?.map((p) => (
                <PrestationCard
                  key={p.id}
                  prestation={p}
                  onClick={() => goToDetail(p.id)}
                  onEdit={handleEditPrestation}
                  onDelete={handleDeletePrestation}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ VIEW: DETAIL PRESTATION ═══════ */}
      {viewLevel === 'detail' && currentPrest && (
        <PrestationDetail
          prestation={currentPrest}
          onEditOption={handleEditOption}
          onDeleteOption={handleDeleteOption}
          onEditChoix={handleEditChoix}
          onDeleteChoix={handleDeleteChoix}
        />
      )}

      {/* ═══════ MODAL: ÉDITION PRESTATION ═══════ */}
      {editModalOpen && selectedPrestForAction && (
        <PrestationEditModal
          prestation={selectedPrestForAction}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedPrestForAction(null);
            setActionError(null);
          }}
          onSave={async (payload) => {
            setActionError(null);
            await updatePrestationMutation.mutateAsync({ id: selectedPrestForAction.id, ...payload });
          }}
          isSaving={updatePrestationMutation.isPending}
          error={actionError}
        />
      )}

      {editEntity && (
        <EntityEditModal
          key={`${editEntity.type}-${editEntity.id}`}
          entity={editEntity}
          error={actionError}
          isSaving={updateEntityMutation.isPending}
          onClose={() => {
            setEditEntity(null);
            setActionError(null);
          }}
          onSave={async (payload) => {
            setActionError(null);
            await updateEntityMutation.mutateAsync(payload);
          }}
        />
      )}

      {deleteEntity && (
        <EntityDeleteModal
          key={`${deleteEntity.type}-${deleteEntity.id}`}
          entity={deleteEntity}
          error={actionError}
          isDeleting={deleteEntityMutation.isPending}
          onClose={() => {
            setDeleteEntity(null);
            setActionError(null);
          }}
          onConfirm={async () => {
            setActionError(null);
            await deleteEntityMutation.mutateAsync(deleteEntity);
          }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Card prestation (liste)
// ════════════════════════════════════════════════

function PrestationCard({
  prestation: p,
  onClick,
  onEdit,
  onDelete,
}: {
  prestation: Prestation;
  onClick: () => void;
  onEdit: (presta: Prestation) => void;
  onDelete: (presta: Prestation) => void;
}) {
  const optCount = p.options?.length ?? 0;
  const infoCount = p.infosRequises?.length ?? 0;
  const composCount = p.compositions?.length ?? 0;

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group flex items-start gap-3">
      <button
        onClick={onClick}
        className="flex-1 flex items-start gap-3"
      >
        <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center shrink-0 group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
          <BookOpen size={16} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900">{p.nom}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] font-medium text-gray-500 rounded">
              {p.unite}
            </span>
          </div>
          {p.description && (
            <p className="text-[12px] text-gray-400 line-clamp-2 mb-2">{p.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {optCount > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-medium">
                <Settings2 size={10} className="inline mr-0.5" />
                {optCount} options
              </span>
            )}
            {infoCount > 0 && (
              <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded border border-violet-100 font-medium">
                <ClipboardList size={10} className="inline mr-0.5" />
                {infoCount} infos requises
              </span>
            )}
            {composCount > 0 && (
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-100 font-medium">
                {composCount} composants
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-teal-700">
            {formatCurrency(p.prixVenteMin)}
          </div>
          <div className="text-[11px] text-gray-400">
            à {formatCurrency(p.prixVenteMax)}
          </div>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors ml-auto mt-1" />
        </div>
      </button>

      {/* Action buttons for admin */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(p);
          }}
          className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
          title="Modifier cette prestation"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(p);
          }}
          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
          title="Supprimer cette prestation"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Détail complet prestation
// ════════════════════════════════════════════════

function PrestationDetail({
  prestation: p,
  onEditOption,
  onDeleteOption,
  onEditChoix,
  onDeleteChoix,
}: {
  prestation: Prestation;
  onEditOption: (option: OptionPrestation) => void;
  onDeleteOption: (option: OptionPrestation) => void;
  onEditChoix: (choix: ChoixOption) => void;
  onDeleteChoix: (choix: ChoixOption) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen size={22} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">{p.nom}</h3>
              <span className="px-2 py-0.5 bg-gray-100 text-xs font-medium text-gray-500 rounded-md">
                {p.unite}
              </span>
            </div>
            {p.description && <p className="text-sm text-gray-500 mb-3">{p.description}</p>}
            <div className="flex items-center gap-4">
              <div className="bg-teal-50 rounded-xl px-4 py-2.5">
                <div className="text-[10px] text-teal-600 font-medium uppercase tracking-wide">Prix min</div>
                <div className="text-lg font-bold text-teal-700">{formatCurrency(p.prixVenteMin)}</div>
              </div>
              <div className="text-gray-300">—</div>
              <div className="bg-teal-50 rounded-xl px-4 py-2.5">
                <div className="text-[10px] text-teal-600 font-medium uppercase tracking-wide">Prix max</div>
                <div className="text-lg font-bold text-teal-700">{formatCurrency(p.prixVenteMax)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Options & Choix */}
      {(p.options?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={18} className="text-amber-500" />
            <h4 className="text-sm font-bold text-gray-900">Options de configuration</h4>
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-medium">
              {p.options!.length} options
            </span>
          </div>
          <div className="space-y-3">
            {p.options!.map((opt) => (
              <OptionBlock
                key={opt.id}
                option={opt}
                onEditOption={onEditOption}
                onDeleteOption={onDeleteOption}
                onEditChoix={onEditChoix}
                onDeleteChoix={onDeleteChoix}
              />
            ))}
          </div>
        </div>
      )}

      {/* Informations requises */}
      {(p.infosRequises?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={18} className="text-violet-500" />
            <h4 className="text-sm font-bold text-gray-900">Informations à recueillir</h4>
            <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md font-medium">
              {p.infosRequises!.length} détails
            </span>
          </div>
          <div className="space-y-2">
            {p.infosRequises!.map((info) => (
              <InfoRequiseRow key={info.id} info={info} />
            ))}
          </div>
        </div>
      )}

      {/* Compositions (matériaux + main d'œuvre) */}
      {(p.compositions?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={18} className="text-cyan-500" />
            <h4 className="text-sm font-bold text-gray-900">Composition & Chiffrage</h4>
            <span className="text-xs bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-md font-medium">
              {p.compositions!.length} composants
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Désignation
                  </th>
                  <th className="text-center py-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Unité
                  </th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Qté/unité
                  </th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Prix unit.
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.compositions!.map((comp) => {
                  const isMat = !!comp.materiau;
                  const item = comp.materiau ?? comp.serviceMainOeuvre;
                  if (!item) return null;
                  return (
                    <tr key={comp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2 px-3">
                        <span
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded',
                            isMat
                              ? 'bg-orange-50 text-orange-600 border border-orange-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100',
                          )}
                        >
                          {isMat ? 'Matériau' : 'Main d\'œuvre'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-gray-800 text-[13px]">{item.nom}</td>
                      <td className="py-2 px-3 text-center text-gray-500 text-xs">{item.unite}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">
                        {comp.quantiteParUnite}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-gray-700 text-xs">
                        {formatCurrency(
                          isMat
                            ? (comp.materiau?.prixAchatFixe ?? 0)
                            : (comp.serviceMainOeuvre?.prixUnitaire ?? 0),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Bloc questions diagnostiques
// ════════════════════════════════════════════════

function QuestionsBlock({
  questions,
  title,
}: {
  questions: QuestionDiagnostic[];
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-50/50 rounded-xl border border-amber-100 p-4 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-amber-500" />
        ) : (
          <ChevronRight size={16} className="text-amber-500" />
        )}
        <HelpCircle size={16} className="text-amber-500" />
        <span className="text-xs font-bold text-amber-800 flex-1">{title}</span>
        <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
          {questions.length} questions
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-lg border border-amber-100 p-3">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-semibold text-gray-800">{q.question}</p>
                    {q.obligatoire && (
                      <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase">
                        Requis
                      </span>
                    )}
                  </div>
                  {q.aide && (
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mb-2">
                      <Info size={10} className="shrink-0" />
                      {q.aide}
                    </p>
                  )}
                  {/* Type badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeReponseBadge type={q.typeReponse} />
                    {q.choixPossibles && q.choixPossibles.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {q.choixPossibles.map((ch, ci) => (
                          <span
                            key={ci}
                            className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Modal d'édition prestation
// ════════════════════════════════════════════════

function PrestationEditModal({
  prestation: initialPresta,
  onClose,
  onSave,
  isSaving,
  error,
}: {
  prestation: Prestation;
  onClose: () => void;
  onSave: (payload: {
    nom: string;
    description: string;
    unite: string;
    prixVenteMin: number;
    prixVenteMax: number;
  }) => Promise<void>;
  isSaving: boolean;
  error: string | null;
}) {
  const [nom, setNom] = useState(initialPresta.nom);
  const [description, setDescription] = useState(initialPresta.description || '');
  const [prixMin, setPrixMin] = useState(initialPresta.prixVenteMin.toString());
  const [prixMax, setPrixMax] = useState(initialPresta.prixVenteMax.toString());
  const [unite, setUnite] = useState(initialPresta.unite);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = async () => {
    const min = Number(prixMin);
    const max = Number(prixMax);

    if (!nom.trim()) {
      setValidationError('Le nom de la prestation est obligatoire.');
      return;
    }
    if (Number.isNaN(min) || Number.isNaN(max)) {
      setValidationError('Les prix min/max doivent être des nombres valides.');
      return;
    }
    if (min > max) {
      setValidationError('Le prix minimum ne peut pas dépasser le prix maximum.');
      return;
    }

    setValidationError(null);
    await onSave({
      nom: nom.trim(),
      description: description.trim(),
      unite,
      prixVenteMin: min,
      prixVenteMax: max,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Edit size={20} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Modifier la prestation</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Nom */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nom de la prestation</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Ex: Pose carrelage mural"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Détails ou notes sur la prestation"
              rows={3}
            />
          </div>

          {/* Prix et Unité */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Unité</label>
              <select
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm"
              >
                <option>PIECE</option>
                <option>M2</option>
                <option>M</option>
                <option>FORFAIT</option>
                <option>HEURE</option>
                <option>JOUR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Prix min.</label>
              <input
                type="number"
                value={prixMin}
                onChange={(e) => setPrixMin(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Prix max.</label>
              <input
                type="number"
                value={prixMax}
                onChange={(e) => setPrixMax(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="0"
              />
            </div>
          </div>

          {(validationError || error) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {validationError ?? error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium transition-colors flex items-center gap-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Badge type de réponse
// ════════════════════════════════════════════════

function TypeReponseBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    TEXTE: { label: 'Texte libre', color: 'bg-gray-50 text-gray-600 border-gray-200' },
    CHOIX_UNIQUE: { label: 'Choix unique', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    CHOIX_MULTIPLE: { label: 'Choix multiple', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
    NOMBRE: { label: 'Nombre', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    BOOLEEN: { label: 'Oui / Non', color: 'bg-violet-50 text-violet-600 border-violet-200' },
    PHOTO: { label: 'Photo', color: 'bg-pink-50 text-pink-600 border-pink-200' },
  };
  const cfg = map[type] ?? { label: type, color: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', cfg.color)}>
      {cfg.label}
    </span>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Option prestation (détail)
// ════════════════════════════════════════════════

function OptionBlock({
  option,
  onEditOption,
  onDeleteOption,
  onEditChoix,
  onDeleteChoix,
}: {
  option: OptionPrestation;
  onEditOption: (option: OptionPrestation) => void;
  onDeleteOption: (option: OptionPrestation) => void;
  onEditChoix: (choix: ChoixOption) => void;
  onDeleteChoix: (choix: ChoixOption) => void;
}) {
  return (
    <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <Settings2 size={14} className="text-amber-500" />
        <span className="text-xs font-bold text-gray-700">{option.nom}</span>
        {option.obligatoire && (
          <span className="px-1.5 py-0.5 bg-red-50 text-[9px] font-bold text-red-500 rounded border border-red-100 uppercase">
            Obligatoire
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onEditOption(option)}
            className="p-1.5 rounded-md text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
            title="Modifier cette option"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => onDeleteOption(option)}
            className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
            title="Supprimer cette option"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {option.choix.map((ch) => (
          <div
            key={ch.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs hover:border-teal-300 transition-colors"
          >
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="font-medium text-gray-700">{ch.nom}</span>
            {ch.impactPrix !== 0 && (
              <span
                className={cn(
                  'font-semibold',
                  ch.impactPrix > 0 ? 'text-emerald-600' : 'text-red-500',
                )}
              >
                {ch.impactPrix > 0 ? '+' : ''}
                {formatCurrency(ch.impactPrix)}
              </span>
            )}

            <button
              onClick={() => onEditChoix(ch)}
              className="ml-1 p-1 rounded-md text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
              title="Modifier ce choix"
            >
              <Edit size={13} />
            </button>
            <button
              onClick={() => onDeleteChoix(ch)}
              className="p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
              title="Supprimer ce choix"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPOSANT: Info requise row
// ════════════════════════════════════════════════

function InfoRequiseRow({ info }: { info: InfoRequise }) {
  const iconMap: Record<string, React.ReactNode> = {
    MESURE: <Ruler size={14} className="text-violet-500" />,
    PHOTO: <Camera size={14} className="text-pink-500" />,
    OBSERVATION: <Eye size={14} className="text-sky-500" />,
    CHOIX: <ListChecks size={14} className="text-amber-500" />,
  };
  const colorMap: Record<string, string> = {
    MESURE: 'bg-violet-50 border-violet-100',
    PHOTO: 'bg-pink-50 border-pink-100',
    OBSERVATION: 'bg-sky-50 border-sky-100',
    CHOIX: 'bg-amber-50 border-amber-100',
  };

  return (
    <div className={cn('rounded-lg border p-3 flex items-start gap-3', colorMap[info.typeInfo] ?? 'bg-gray-50 border-gray-100')}>
      <div className="shrink-0 mt-0.5">{iconMap[info.typeInfo] ?? <Info size={14} className="text-gray-400" />}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-semibold text-gray-800">{info.nom}</span>
          {info.unite && (
            <span className="text-[10px] bg-white text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
              {info.unite}
            </span>
          )}
          {info.obligatoire && (
            <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase">
              Requis
            </span>
          )}
        </div>
        {info.aide && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            <Info size={10} className="shrink-0" />
            {info.aide}
          </p>
        )}
      </div>
      <TypeInfoBadge type={info.typeInfo} />
    </div>
  );
}

function TypeInfoBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    MESURE: { label: 'Mesure', color: 'bg-violet-100 text-violet-700' },
    PHOTO: { label: 'Photo', color: 'bg-pink-100 text-pink-700' },
    OBSERVATION: { label: 'Observation', color: 'bg-sky-100 text-sky-700' },
    CHOIX: { label: 'Choix', color: 'bg-amber-100 text-amber-700' },
  };
  const cfg = map[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function EntityEditModal({
  entity,
  onClose,
  onSave,
  isSaving,
  error,
}: {
  entity: EditableEntity;
  onClose: () => void;
  onSave: (payload: EditableEntity) => Promise<void>;
  isSaving: boolean;
  error: string | null;
}) {
  const [nom, setNom] = useState(entity.nom);
  const [description, setDescription] = useState(entity.description || '');
  const [obligatoire, setObligatoire] = useState(entity.type === 'option' ? entity.obligatoire : false);
  const [impactPrix, setImpactPrix] = useState(entity.type === 'choixOption' ? entity.impactPrix.toString() : '0');
  const [validationError, setValidationError] = useState<string | null>(null);

  const titleByType: Record<EditableEntity['type'], string> = {
    categorie: 'Modifier la catégorie',
    sousCategorie: 'Modifier la sous-catégorie',
    option: 'Modifier l’option',
    choixOption: 'Modifier le choix',
  };

  async function handleSave() {
    if (!nom.trim()) {
      setValidationError('Le nom est obligatoire.');
      return;
    }

    if (entity.type === 'choixOption') {
      const impact = Number(impactPrix);
      if (Number.isNaN(impact)) {
        setValidationError('Impact prix invalide.');
        return;
      }
    }

    setValidationError(null);

    if (entity.type === 'option') {
      await onSave({
        type: 'option',
        id: entity.id,
        nom: nom.trim(),
        description: description.trim(),
        obligatoire,
      });
      return;
    }

    if (entity.type === 'choixOption') {
      await onSave({
        type: 'choixOption',
        id: entity.id,
        nom: nom.trim(),
        description: description.trim(),
        impactPrix: Number(impactPrix),
      });
      return;
    }

    await onSave({
      type: entity.type,
      id: entity.id,
      nom: nom.trim(),
      description: description.trim(),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full">
        <div className="border-b border-gray-200 p-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{titleByType[entity.type]}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" disabled={isSaving}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nom</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {entity.type === 'option' && (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={obligatoire}
                onChange={(e) => setObligatoire(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Option obligatoire
            </label>
          )}

          {entity.type === 'choixOption' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Impact prix (€/unité)</label>
              <input
                type="number"
                value={impactPrix}
                onChange={(e) => setImpactPrix(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {(validationError || error) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {validationError ?? error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white flex items-center gap-2"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityDeleteModal({
  entity,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: {
  entity: DeletableEntity;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}) {
  const labelByType: Record<DeletableEntity['type'], string> = {
    categorie: 'categorie',
    sousCategorie: 'sous-categorie',
    prestation: 'prestation',
    option: 'option',
    choixOption: 'choix',
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center">Supprimer cette {labelByType[entity.type]} ?</h2>
          <p className="text-center text-gray-600">
            Vous allez supprimer <strong>{entity.nom}</strong>.
          </p>
          <p className="text-center text-sm text-gray-400">Cette action ne peut pas être annulée.</p>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium transition-colors flex items-center gap-2"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}