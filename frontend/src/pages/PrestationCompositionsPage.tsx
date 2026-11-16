import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CatalogueCategorieWithCompositions,
  Materiau,
  Prestation,
  ServiceMainOeuvre,
} from '@/types';

type CompositionRow = {
  key: string;
  compositionId: number;
  prestationId: number;
  prestationNom: string;
  prestationUnite: string;
  categorieNom: string;
  sousCategorieNom: string;
  typeComposant: string;
  composantNom: string;
  composantUnite: string;
  quantiteParUnite: number;
  coutUnitaire: number | null;
  coutParUnite: number | null;
  materiauId: number | null;
  serviceMainOeuvreId: number | null;
};

type PrestationChoice = {
  id: number;
  nom: string;
  categorieNom: string;
  sousCategorieNom: string;
};

type CompositionFormState = {
  prestationId: string;
  materiauId: string;
  serviceMainOeuvreId: string;
  quantiteParUnite: string;
};

function createEmptyForm(prestationId = ''): CompositionFormState {
  return {
    prestationId,
    materiauId: '',
    serviceMainOeuvreId: '',
    quantiteParUnite: '1',
  };
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data
  ) {
    const apiMessage = error.response.data.message;
    if (Array.isArray(apiMessage)) return apiMessage.join(', ');
    if (typeof apiMessage === 'string') return apiMessage;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function flattenCompositions(catalogue: CatalogueCategorieWithCompositions[]): CompositionRow[] {
  const rows: CompositionRow[] = [];

  const pushRowsForPrestation = (
    prestation: Prestation,
    categorieNom: string,
    sousCategorieNom: string,
  ) => {
    for (const composition of prestation.compositions ?? []) {
      const materiau = composition.materiau;
      const service = composition.serviceMainOeuvre;

      let typeComposant = 'Inconnu';
      let composantNom = '-';
      let composantUnite = '-';
      let coutUnitaire: number | null = null;

      if (materiau && service) {
        typeComposant = 'Mixte';
        composantNom = `${materiau.nom} + ${service.nom}`;
        composantUnite = `${materiau.unite} + ${service.unite}`;
        coutUnitaire = materiau.prixAchatFixe + service.prixUnitaire;
      } else if (materiau) {
        typeComposant = 'Materiau';
        composantNom = materiau.nom;
        composantUnite = materiau.unite;
        coutUnitaire = materiau.prixAchatFixe;
      } else if (service) {
        typeComposant = "Main d'oeuvre";
        composantNom = service.nom;
        composantUnite = service.unite;
        coutUnitaire = service.prixUnitaire;
      }

      rows.push({
        key: `${composition.id}-${prestation.id}-${rows.length}`,
        compositionId: composition.id,
        prestationId: prestation.id,
        prestationNom: prestation.nom,
        prestationUnite: prestation.unite,
        categorieNom,
        sousCategorieNom,
        typeComposant,
        composantNom,
        composantUnite,
        quantiteParUnite: composition.quantiteParUnite,
        coutUnitaire,
        coutParUnite:
          coutUnitaire === null ? null : coutUnitaire * composition.quantiteParUnite,
        materiauId: composition.materiau?.id ?? null,
        serviceMainOeuvreId: composition.serviceMainOeuvre?.id ?? null,
      });
    }
  };

  for (const categorie of catalogue) {
    for (const prestation of categorie.prestations ?? []) {
      pushRowsForPrestation(prestation, categorie.nom, '-');
    }

    for (const sousCategorie of categorie.sousCategories ?? []) {
      for (const prestation of sousCategorie.prestations ?? []) {
        pushRowsForPrestation(prestation, categorie.nom, sousCategorie.nom);
      }
    }
  }

  return rows.sort((a, b) => {
    const byPrestation = a.prestationNom.localeCompare(b.prestationNom, 'fr', {
      sensitivity: 'base',
    });
    if (byPrestation !== 0) return byPrestation;
    return a.compositionId - b.compositionId;
  });
}

function flattenPrestations(catalogue: CatalogueCategorieWithCompositions[]): PrestationChoice[] {
  const byId = new Map<number, PrestationChoice>();

  for (const categorie of catalogue) {
    for (const prestation of categorie.prestations ?? []) {
      byId.set(prestation.id, {
        id: prestation.id,
        nom: prestation.nom,
        categorieNom: categorie.nom,
        sousCategorieNom: '-',
      });
    }

    for (const sousCategorie of categorie.sousCategories ?? []) {
      for (const prestation of sousCategorie.prestations ?? []) {
        byId.set(prestation.id, {
          id: prestation.id,
          nom: prestation.nom,
          categorieNom: categorie.nom,
          sousCategorieNom: sousCategorie.nom,
        });
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }),
  );
}

export default function PrestationCompositionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingRow, setEditingRow] = useState<CompositionRow | null>(null);
  const [form, setForm] = useState<CompositionFormState>(() => createEmptyForm());

  const {
    data: catalogue,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['catalogue-full', 'prestation-compositions'],
    queryFn: async () => {
      const res = await api.get('/prestations/catalogue');
      return res.data as CatalogueCategorieWithCompositions[];
    },
  });

  const { data: materiaux = [] } = useQuery({
    queryKey: ['materiaux', 'composition-editor'],
    enabled: isAdmin && showEditor,
    queryFn: async () => {
      const res = await api.get('/materiaux', {
        params: { page: 1, limit: 500, actif: true },
      });

      if (Array.isArray(res.data?.data)) {
        return res.data.data as Materiau[];
      }
      if (Array.isArray(res.data)) {
        return res.data as Materiau[];
      }
      return [] as Materiau[];
    },
  });

  const { data: servicesMo = [] } = useQuery({
    queryKey: ['services-mo', 'composition-editor'],
    enabled: isAdmin && showEditor,
    queryFn: async () => {
      const res = await api.get('/services-mo', {
        params: { page: 1, limit: 500, actif: true },
      });

      if (Array.isArray(res.data?.data)) {
        return res.data.data as ServiceMainOeuvre[];
      }
      if (Array.isArray(res.data)) {
        return res.data as ServiceMainOeuvre[];
      }
      return [] as ServiceMainOeuvre[];
    },
  });

  const rows = useMemo(
    () => flattenCompositions(catalogue ?? []),
    [catalogue],
  );

  const prestationChoices = useMemo(
    () => flattenPrestations(catalogue ?? []),
    [catalogue],
  );

  useEffect(() => {
    if (!showEditor) return;
    if (editingRow) return;
    if (form.prestationId) return;

    const firstPrestation = prestationChoices[0]?.id;
    if (firstPrestation) {
      setForm((current) => ({ ...current, prestationId: firstPrestation.toString() }));
    }
  }, [showEditor, editingRow, prestationChoices, form.prestationId]);

  async function refreshCatalogueQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['catalogue-full'] }),
      queryClient.invalidateQueries({ queryKey: ['catalogue-full', 'prestation-compositions'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (payload: {
      prestationId: number;
      quantiteParUnite: number;
      materiauId?: number;
      serviceMainOeuvreId?: number;
    }) => api.post('/prestations/compositions', payload),
    onSuccess: async () => {
      await refreshCatalogueQueries();
      setShowEditor(false);
      setEditingRow(null);
      setForm(createEmptyForm());
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        quantiteParUnite: number;
        materiauId: number | null;
        serviceMainOeuvreId: number | null;
      };
    }) => api.patch(`/prestations/compositions/${id}`, payload),
    onSuccess: async () => {
      await refreshCatalogueQueries();
      setShowEditor(false);
      setEditingRow(null);
      setForm(createEmptyForm());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/prestations/compositions/${id}`),
    onSuccess: async () => {
      await refreshCatalogueQueries();
    },
  });

  function openCreateEditor() {
    setEditingRow(null);
    setForm(createEmptyForm(prestationChoices[0]?.id?.toString() ?? ''));
    setShowEditor(true);
  }

  function openEditEditor(row: CompositionRow) {
    setEditingRow(row);
    setForm({
      prestationId: row.prestationId.toString(),
      materiauId: row.materiauId ? row.materiauId.toString() : '',
      serviceMainOeuvreId: row.serviceMainOeuvreId ? row.serviceMainOeuvreId.toString() : '',
      quantiteParUnite: row.quantiteParUnite.toString(),
    });
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingRow(null);
    setForm(createEmptyForm());
  }

  function handleDelete(row: CompositionRow) {
    if (deleteMutation.isPending) return;
    const confirmed = window.confirm(
      `Supprimer la composition #${row.compositionId} de la prestation "${row.prestationNom}" ?`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(row.compositionId);
  }

  function handleEditorSubmit(e: React.FormEvent) {
    e.preventDefault();

    const prestationId = Number(form.prestationId);
    const quantiteParUnite = Number(form.quantiteParUnite);
    const materiauId = form.materiauId ? Number(form.materiauId) : null;
    const serviceMainOeuvreId = form.serviceMainOeuvreId
      ? Number(form.serviceMainOeuvreId)
      : null;

    if (!Number.isInteger(prestationId) || prestationId <= 0) {
      window.alert('Veuillez sélectionner une prestation.');
      return;
    }
    if (!Number.isFinite(quantiteParUnite) || quantiteParUnite <= 0) {
      window.alert('La quantité par unité doit être strictement positive.');
      return;
    }
    if (!materiauId && !serviceMainOeuvreId) {
      window.alert('Sélectionnez au moins un matériau ou un service main d\'oeuvre.');
      return;
    }

    if (editingRow) {
      updateMutation.mutate({
        id: editingRow.compositionId,
        payload: {
          quantiteParUnite,
          materiauId,
          serviceMainOeuvreId,
        },
      });
      return;
    }

    createMutation.mutate({
      prestationId,
      quantiteParUnite,
      materiauId: materiauId ?? undefined,
      serviceMainOeuvreId: serviceMainOeuvreId ?? undefined,
    });
  }

  const editorError = createMutation.error || updateMutation.error;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) => {
      return (
        row.compositionId.toString().includes(keyword) ||
        row.prestationId.toString().includes(keyword) ||
        row.prestationNom.toLowerCase().includes(keyword) ||
        row.categorieNom.toLowerCase().includes(keyword) ||
        row.sousCategorieNom.toLowerCase().includes(keyword) ||
        row.typeComposant.toLowerCase().includes(keyword) ||
        row.composantNom.toLowerCase().includes(keyword)
      );
    });
  }, [rows, search]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={24} className="text-blue-600" />
            Prestations et leurs compositions
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Table prestations_compositions: {filteredRows.length} ligne(s)
          </p>
          {!isAdmin && (
            <p className="text-xs text-amber-700 mt-1">Mode lecture seule: les modifications sont réservées aux admins.</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={openCreateEditor}
            className="inline-flex items-center gap-2 batiflow-gradient text-white px-4 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm"
          >
            <Plus size={16} />
            Nouvelle composition
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher une composition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary-600" size={32} />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-gray-500">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">
              Impossible de charger les compositions
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucune composition trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Prestation
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Categorie
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Sous-categorie
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Type composant
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Composant
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Qte / unite presta
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Cout unitaire
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Cout total / unite presta
                  </th>
                  {isAdmin && (
                    <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => (
                  <tr key={row.key} className="hover:bg-primary-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">#{row.compositionId}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{row.prestationNom}</p>
                      <p className="text-xs text-gray-500">ID prestation: {row.prestationId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.categorieNom}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.sousCategorieNom}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.typeComposant}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{row.composantNom}</p>
                      <p className="text-xs text-gray-500">Unité: {row.composantUnite}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {row.quantiteParUnite} / {row.prestationUnite}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {row.coutUnitaire === null ? '-' : formatCurrency(row.coutUnitaire)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {row.coutParUnite === null ? '-' : formatCurrency(row.coutParUnite)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditEditor(row)}
                            className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditor && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingRow ? 'Modifier la composition' : 'Nouvelle composition'}
              </h2>
              <button
                onClick={closeEditor}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditorSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Prestation</label>
                <select
                  value={form.prestationId}
                  onChange={(e) => setForm((current) => ({ ...current, prestationId: e.target.value }))}
                  disabled={Boolean(editingRow)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 bg-white disabled:bg-gray-50"
                >
                  <option value="">Choisir une prestation</option>
                  {prestationChoices.map((prestation) => (
                    <option key={prestation.id} value={prestation.id}>
                      {prestation.nom} - {prestation.categorieNom}
                      {prestation.sousCategorieNom !== '-' ? ` / ${prestation.sousCategorieNom}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Matériau (optionnel)</label>
                  <select
                    value={form.materiauId}
                    onChange={(e) => setForm((current) => ({ ...current, materiauId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 bg-white"
                  >
                    <option value="">Aucun matériau</option>
                    {materiaux.map((materiau) => (
                      <option key={materiau.id} value={materiau.id}>
                        {materiau.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Main d'oeuvre (optionnel)</label>
                  <select
                    value={form.serviceMainOeuvreId}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, serviceMainOeuvreId: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 bg-white"
                  >
                    <option value="">Aucun service MO</option>
                    {servicesMo.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Quantité par unité de prestation</label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={form.quantiteParUnite}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, quantiteParUnite: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                />
              </div>

              {editorError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                  {getApiErrorMessage(editorError, 'Erreur lors de la sauvegarde de la composition.')}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 text-sm font-medium text-white batiflow-gradient rounded-xl hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isSaving ? 'Enregistrement...' : editingRow ? 'Enregistrer' : 'Créer la composition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}