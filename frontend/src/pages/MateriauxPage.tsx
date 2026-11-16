import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Box,
  Edit,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import api from '@/lib/api';
import type { Fournisseur, Materiau } from '@/types';
import { formatCurrency } from '@/lib/utils';

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

const emptyForm = {
  nom: '',
  couleur: '',
  finition: '',
  unite: 'M2' as UniteValue,
  prixAchatFixe: '',
  fournisseurId: '',
};

export default function MateriauxPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Materiau | null>(null);
  const [form, setForm] = useState(emptyForm);

  const {
    data: materiaux,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['materiaux', search],
    queryFn: async () => {
      const params: Record<string, unknown> = {};

      if (search) params.search = search;

      const res = await api.get('/materiaux', { params });
      return (res.data?.data ?? res.data) as Materiau[];
    },
  });

  const { data: fournisseurs } = useQuery({
    queryKey: ['fournisseurs', 'materiaux-form'],
    queryFn: async () => {
      const res = await api.get('/fournisseurs', {
        params: { limit: 300 },
      });
      return (res.data?.data ?? res.data) as Fournisseur[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/materiaux', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiaux'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Record<string, unknown>;
    }) => api.patch(`/materiaux/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiaux'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/materiaux/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['materiaux'] }),
  });

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(materiau: Materiau) {
    setEditing(materiau);
    setForm({
      nom: materiau.nom,
      couleur: materiau.couleur ?? '',
      finition: materiau.finition ?? '',
      unite: materiau.unite as UniteValue,
      prixAchatFixe: String(materiau.prixAchatFixe),
      fournisseurId: materiau.fournisseurId
        ? String(materiau.fournisseurId)
        : '',
    });
    setShowModal(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const prixAchatFixe = Number(form.prixAchatFixe);

    if (!Number.isFinite(prixAchatFixe) || prixAchatFixe < 0) {
      window.alert("Veuillez saisir un prix d'achat valide.");
      return;
    }

    const payload = {
      nom: form.nom.trim(),
      couleur: form.couleur.trim() || undefined,
      finition: form.finition.trim() || undefined,
      unite: form.unite,
      prixAchatFixe,
      fournisseurId: form.fournisseurId
        ? Number(form.fournisseurId)
        : undefined,
    };

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        body: payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  }

  const saveErrorMessage = (() => {
    const mutationError = editing
      ? updateMutation.error
      : createMutation.error;

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
      ? 'Erreur lors de la modification du matériau.'
      : 'Erreur lors de la création du matériau.';
  })();

  const list = materiaux ?? [];
  const fournisseursList = fournisseurs ?? [];
  const errorStatus = (
    error as { response?: { status?: number } } | null
  )?.response?.status;
  const isForbidden = errorStatus === 403;
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Box size={24} className="text-blue-600" />
            Gestion des Matériaux
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isError
              ? 'Erreur de chargement'
              : `${list.length} matériau(x) enregistré(s)`}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="batiflow-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/20"
        >
          <Plus size={17} />
          Nouveau matériau
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un matériau..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2
              className="animate-spin text-primary-600"
              size={32}
            />
          </div>
        ) : isError ? (
          <div className="py-20 text-center text-gray-500">
            <Box size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">
              {isForbidden
                ? 'Accès réservé aux admins'
                : 'Impossible de charger les matériaux'}
            </p>
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <Box size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">
              Aucun matériau trouvé
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Nom
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Unité
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Prix d'achat
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {list.map((materiau) => (
                  <tr
                    key={materiau.id}
                    className="group transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {materiau.nom}
                      </p>

                      {materiau.couleur ? (
                        <p className="text-xs text-gray-500">
                          {materiau.couleur}
                          {materiau.finition
                            ? ` - ${materiau.finition}`
                            : ''}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {materiau.unite ?? '—'}
                    </td>

                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {materiau.prixAchatFixe != null
                        ? formatCurrency(materiau.prixAchatFixe)
                        : '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {materiau.fournisseur?.nom ?? '—'}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(materiau)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-primary-50 hover:text-primary-600"
                          title={`Modifier ${materiau.nom}`}
                        >
                          <Edit size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteMutation.mutate(materiau.id)
                          }
                          disabled={deleteMutation.isPending}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title={`Supprimer ${materiau.nom}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Modifier le matériau' : 'Nouveau matériau'}
              </h2>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-6"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={form.nom}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      nom: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Couleur
                  </label>
                  <input
                    type="text"
                    value={form.couleur}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        couleur: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Finition
                  </label>
                  <input
                    type="text"
                    value={form.finition}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        finition: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Prix d'achat *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.prixAchatFixe}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        prixAchatFixe: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Unité *
                  </label>
                  <select
                    required
                    value={form.unite}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        unite: event.target.value as UniteValue,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
                  >
                    {UNITES.map((unite) => (
                      <option
                        key={unite.value}
                        value={unite.value}
                      >
                        {unite.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Fournisseur
                </label>
                <select
                  value={form.fournisseurId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      fournisseurId: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Aucun fournisseur</option>
                  {fournisseursList.map((fournisseur) => (
                    <option
                      key={fournisseur.id}
                      value={fournisseur.id}
                    >
                      {fournisseur.nom}
                    </option>
                  ))}
                </select>
              </div>

              {saveErrorMessage ? (
                <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                  {saveErrorMessage}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="batiflow-gradient flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : null}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}