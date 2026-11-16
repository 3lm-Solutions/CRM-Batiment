import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import type { ServiceMainOeuvre } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Search, Edit, Trash2, X, Wrench, Loader2,
} from 'lucide-react';

type UniteValue =
  | 'M2'
  | 'ML'
  | 'PIECE'
  | 'JOUR'
  | 'HEURE'
  | 'LITRE'
  | 'KG'
  | 'FORFAIT';

const UNITES: Array<{ value: UniteValue; label: string }> = [
  { value: 'M2', label: 'm²' },
  { value: 'ML', label: 'mètre linéaire' },
  { value: 'PIECE', label: 'pièce' },
  { value: 'JOUR', label: 'jour' },
  { value: 'HEURE', label: 'heure' },
  { value: 'LITRE', label: 'litre' },
  { value: 'KG', label: 'kg' },
  { value: 'FORFAIT', label: 'forfait' },
];

export default function ServicesMoPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServiceMainOeuvre | null>(null);
  const [form, setForm] = useState({ nom: '', prixUnitaire: '', unite: 'M2' as UniteValue });

  const {
    data: services,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['services-mo', search],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: 1,
        limit: 500,
        actif: true,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await api.get('/services-mo', { params });
      const data = (res.data?.data ?? res.data) as ServiceMainOeuvre[];

      // Sécurité supplémentaire côté UI : ne jamais afficher un service soft-deleted.
      return data.filter(
        (service) =>
          (service as ServiceMainOeuvre & { actif?: boolean }).actif !== false,
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/services-mo', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-mo'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/services-mo/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-mo'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/services-mo/${id}`);
      return id;
    },
    onSuccess: async (deletedId) => {
      // Retirer immédiatement l'élément de toutes les recherches en cache.
      queryClient.setQueriesData<ServiceMainOeuvre[]>(
        { queryKey: ['services-mo'] },
        (current) => current?.filter((service) => service.id !== deletedId) ?? current,
      );

      // Puis resynchroniser avec l'API.
      await queryClient.invalidateQueries({ queryKey: ['services-mo'] });
      await queryClient.refetchQueries({ queryKey: ['services-mo'], type: 'active' });
    },
    onError: (mutationError) => {
      if (axios.isAxiosError(mutationError)) {
        const data = mutationError.response?.data as
          | { message?: string | string[] }
          | undefined;

        if (Array.isArray(data?.message)) {
          window.alert(data.message.join(' '));
          return;
        }

        if (typeof data?.message === 'string') {
          window.alert(data.message);
          return;
        }
      }

      window.alert('Erreur lors de la suppression du service.');
    },
  });

  function handleDelete(service: ServiceMainOeuvre) {
    if (deleteMutation.isPending) return;

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer le service "${service.nom}" ?`,
    );
    if (!confirmed) return;

    deleteMutation.mutate(service.id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const prixUnitaire = Number(form.prixUnitaire);
    if (!Number.isFinite(prixUnitaire) || prixUnitaire <= 0) {
      window.alert('Veuillez saisir un prix unitaire supérieur à 0.');
      return;
    }

    const payload = {
      nom: form.nom.trim(),
      prixUnitaire,
      unite: form.unite,
    };
    if (editing) updateMutation.mutate({ id: editing.id, body: payload });
    else createMutation.mutate(payload);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm({ nom: '', prixUnitaire: '', unite: 'M2' });
  }

  function openCreate() {
    closeModal();
    setShowModal(true);
  }

  function openEdit(service: ServiceMainOeuvre) {
    setEditing(service);
    setForm({
      nom: service.nom,
      prixUnitaire: String(service.prixUnitaire),
      unite: service.unite as UniteValue,
    });
    setShowModal(true);
  }

  const createErrorMessage = (() => {
    const mutationError = editing ? updateMutation.error : createMutation.error;
    if (!mutationError) return null;

    if (axios.isAxiosError(mutationError)) {
      const data = mutationError.response?.data as
        | { message?: string | string[] }
        | undefined;

      if (Array.isArray(data?.message)) {
        return data.message.join(' ');
      }

      if (typeof data?.message === 'string') {
        return data.message;
      }
    }

    return editing
      ? 'Erreur lors de la modification du service de main-d’œuvre.'
      : 'Erreur lors de la création du service de main-d’œuvre.';
  })();

  const list = services ?? [];
  const errorStatus = (error as { response?: { status?: number } } | null)?.response?.status;
  const isForbidden = errorStatus === 403;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench size={24} className="text-orange-600" />
            Services Main d’Œuvre
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isError ? 'Erreur de chargement' : `${list.length} service(s) enregistré(s)`}
          </p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 batiflow-gradient text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm">
          <Plus size={17} /> Nouveau service
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un service..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all" />
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
      ) : isError ? (
        <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Wrench size={32} className="text-gray-400" /></div>
          <p className="text-lg font-semibold text-gray-700">
            {isForbidden ? 'Accès réservé aux admins' : 'Impossible de charger les services'}
          </p>
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Wrench size={32} className="text-gray-400" /></div>
          <p className="text-lg font-semibold text-gray-700">Aucun service trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 card-hover shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                  <Wrench size={20} />
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50" title={`Modifier ${s.nom}`}><Edit size={14} /></button>
                  <button type="button" onClick={() => handleDelete(s)} disabled={deleteMutation.isPending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title={`Supprimer ${s.nom}`}><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{s.nom}</h3>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm font-bold text-primary-600">
                  {s.prixUnitaire ? formatCurrency(s.prixUnitaire) : '—'}
                </span>
                <span className="text-xs text-gray-500">{s.unite ?? 'par heure'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Modifier le service' : 'Nouveau service'}</h2>
              <button type="button" onClick={closeModal} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                <input type="text" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix unitaire *</label>
                  <input type="number" step="0.01" min="0.01" required value={form.prixUnitaire} onChange={(e) => setForm({ ...form, prixUnitaire: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Unité *</label>
                  <select
                    required
                    value={form.unite}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        unite: e.target.value as UniteValue,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {UNITES.map((unite) => (
                      <option key={unite.value} value={unite.value}>
                        {unite.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {createErrorMessage && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                  {createErrorMessage}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-6 py-2.5 text-sm font-medium text-white batiflow-gradient rounded-xl hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 transition-all">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}