import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { parseClientsSpreadsheet } from '@/lib/clientSpreadsheetImport';
import { ProjectTypeCheckboxGroup } from '@/components/ProjectTypeCheckboxGroup';
import { formatDate } from '@/lib/utils';
import type { Client, TypeProjet } from '@/types';
import {
  Phone,
  Mail,
  MapPin,
  UserPlus,
  Filter,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SearchBar from '@/components/ui/SearchBar';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';

const sourceLabels: Record<string, { label: string; color: string }> = {
  CHATBOT: { label: 'Chatbot', color: 'bg-cyan-100 text-cyan-700' },
  TECHNICO_COMMERCIAL: { label: 'Technico-Commercial', color: 'bg-blue-100 text-blue-700' },
  APPEL: { label: 'Appel', color: 'bg-blue-100 text-blue-700' },
  SITE_WEB: { label: 'Site web', color: 'bg-purple-100 text-purple-700' },
  RECOMMANDATION: { label: 'Recommandation', color: 'bg-green-100 text-green-700' },
  AUTRE: { label: 'Autre', color: 'bg-gray-100 text-gray-600' },
};

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

function getClientProjectTypes(client: Client) {
  if ((client.typeProjets?.length ?? 0) > 0) return client.typeProjets ?? [];
  return client.typeProjet ? [client.typeProjet] : [];
}

function getClientProjectLabel(client: Client, fallback = 'Projet à étudier') {
  const labels = getClientProjectTypes(client).map((project) => project.nom).filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : fallback;
}

function buildDefaultDemandeDescription(client: Client) {
  const project = getClientProjectLabel(client, '').trim();
  const location = (client.adresseChantier ?? client.adresseClient ?? '').trim();
  const clientName = `${client.prenom ?? ''} ${client.nom}`.trim();

  if (project && location) return `${project} - ${location}`;
  if (project) return `${project} - ${clientName}`;
  if (location) return `Projet à étudier - ${location}`;
  return `Projet à étudier pour ${clientName}`;
}

export default function TechnicoClients() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [selectedTypeProjetIds, setSelectedTypeProjetIds] = useState<number[]>([]);
  const [demandeClient, setDemandeClient] = useState<Client | null>(null);
  const [demandeDescription, setDemandeDescription] = useState('');
  const [deleteClientId, setDeleteClientId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['technico-clients', page, search, sourceFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      if (sourceFilter) params.source = sourceFilter;
      const res = await api.get('/clients', { params });
      return res.data;
    },
  });

  const clients: Client[] = data?.data ?? [];
  const sortedClients = [...clients].sort((a, b) => {
    if (sortBy === 'name') return `${a.nom} ${a.prenom ?? ''}`.localeCompare(`${b.nom} ${b.prenom ?? ''}`);
    if (sortBy === 'source') return (a.source ?? '').localeCompare(b.source ?? '');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const meta = data?.meta ?? { total: 0, totalPages: 1 };

  // Fetch types de projet for dropdown
  const { data: typesProjet } = useQuery({
    queryKey: ['types-projet'],
    queryFn: async () => {
      const res = await api.get('/types-projet');
      return (res.data ?? []) as TypeProjet[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/clients', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technico-clients'] });
      closeClientModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/clients/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technico-clients'] });
      closeClientModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technico-clients'] });
      setDeleteClientId(null);
    },
  });

  const createDemandeMutation = useMutation({
    mutationFn: (body: { clientId: number; description: string; source: string }) =>
      api.post('/demandes-devis', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technico-demandes'] });
      queryClient.invalidateQueries({ queryKey: ['demandes-devis'] });
      setDemandeClient(null);
      setDemandeDescription('');
      navigate('/technico/demandes');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      nom: fd.get('nom'),
      prenom: fd.get('prenom'),
      email: fd.get('email') || undefined,
      telephone: fd.get('telephone') || undefined,
      adresseClient: fd.get('adresseClient') || undefined,
      adresseChantier: fd.get('adresseChantier') || undefined,
      typeProjetIds: selectedTypeProjetIds,
      source: fd.get('source') || undefined,
      notes: fd.get('notes') || undefined,
    };
    if (editClient) {
      updateMutation.mutate({ id: editClient.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const closeClientModal = () => {
    setShowModal(false);
    setEditClient(null);
    setSelectedTypeProjetIds([]);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setSelectedTypeProjetIds(
      client.typeProjetIds ?? getClientProjectTypes(client).map((project) => project.id),
    );
    setShowModal(true);
  };

  const toggleProjectType = (typeProjetId: number) => {
    setSelectedTypeProjetIds((current) =>
      current.includes(typeProjetId)
        ? current.filter((id) => id !== typeProjetId)
        : [...current, typeProjetId],
    );
  };

  const openDemandeModal = (client: Client) => {
    createDemandeMutation.reset();
    setDemandeClient(client);
    setDemandeDescription(buildDefaultDemandeDescription(client));
  };

  const closeDemandeModal = () => {
    createDemandeMutation.reset();
    setDemandeClient(null);
    setDemandeDescription('');
  };

  const handleCreateDemande = () => {
    if (!demandeClient) return;

    const description =
      demandeDescription.trim() || buildDefaultDemandeDescription(demandeClient);

    createDemandeMutation.mutate({
      clientId: demandeClient.id,
      description,
      source: demandeClient.source ?? 'AUTRE',
    });
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportFeedback(null);
    setIsImporting(true);

    try {
      const parsed = await parseClientsSpreadsheet(file);
      const apiErrors: { rowNumber: number; reason: string }[] = [];
      let createdCount = 0;

      for (const row of parsed.rows) {
        try {
          await api.post('/clients', row.payload);
          createdCount += 1;
        } catch (error) {
          apiErrors.push({
            rowNumber: row.rowNumber,
            reason: getApiErrorMessage(error, 'Création impossible.'),
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['technico-clients'] });

      const failedRows = [...parsed.invalidRows, ...apiErrors];
      const failedCount = failedRows.length;
      const status: 'success' | 'warning' | 'error' = createdCount > 0
        ? (failedCount > 0 ? 'warning' : 'success')
        : 'error';

      const preview = failedRows
        .slice(0, 3)
        .map((entry) => `Ligne ${entry.rowNumber}: ${entry.reason}`);
      const moreErrors = failedCount - preview.length;
      const details = preview.length > 0
        ? ` ${preview.join(' | ')}${moreErrors > 0 ? ` | +${moreErrors} autres erreurs.` : ''}`
        : '';

      setImportFeedback({
        type: status,
        message: `Import terminé : ${createdCount} créé(s), ${failedCount} échec(s), ${parsed.skippedRows} ligne(s) vide(s) ignorée(s).${details}`,
      });
    } catch (error) {
      setImportFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Impossible de lire le fichier Excel.'),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mes Clients</h2>
          <p className="text-sm text-gray-400 mt-0.5">{meta.total} client{meta.total > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-2 border border-gray-200 bg-white px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {isImporting ? 'Import en cours...' : 'Importer Excel'}
          </button>
          <button
            onClick={() => {
              setEditClient(null);
              setSelectedTypeProjetIds([]);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all"
          >
            <UserPlus size={18} />
            Nouveau client
          </button>
        </div>
      </div>

      {importFeedback && (
        <div
          className={cn(
            'rounded-xl border px-4 py-2.5 text-sm',
            importFeedback.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            importFeedback.type === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
            importFeedback.type === 'error' && 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {importFeedback.message}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Rechercher par nom, email, téléphone..."
            onClear={() => setSearch('')}
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <Filter size={16} className="text-gray-400" />
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="bg-transparent text-sm outline-none text-gray-600"
          >
            <option value="">Toutes les sources</option>
            <option value="CHATBOT">Chatbot</option>
            <option value="TECHNICO_COMMERCIAL">Technico-Commercial</option>
            <option value="APPEL">Appel</option>
            <option value="SITE_WEB">Site web</option>
            <option value="RECOMMANDATION">Recommandation</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent text-sm outline-none text-gray-600"
            aria-label="Trier les clients"
          >
            <option value="recent">Tri : plus récent</option>
            <option value="name">Tri : nom A-Z</option>
            <option value="source">Tri : source</option>
          </select>
        </div>
      </div>

      {/* Client cards grid */}
      {isLoading ? (
        <LoadingSkeleton type="card" count={4} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Aucun client trouvé"
          description="Commencez par ajouter votre premier client."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedClients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                  {(client.prenom?.charAt(0) ?? '') + (client.nom?.charAt(0) ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">
                      {client.prenom} {client.nom}
                    </h3>
                    {client.source && (
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', sourceLabels[client.source]?.color ?? 'bg-gray-100 text-gray-600')}>
                        {sourceLabels[client.source]?.label ?? client.source}
                      </span>
                    )}
                  </div>
                  {getClientProjectTypes(client).length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {getClientProjectLabel(client)}
                    </p>
                  )}

                  <div className="mt-3 space-y-1.5">
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Mail size={13} className="text-gray-400" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {client.telephone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone size={13} className="text-gray-400" />
                        <span>{client.telephone}</span>
                      </div>
                    )}
                    {(client.adresseClient || client.adresseChantier) && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin size={13} className="text-gray-400" />
                        <span className="truncate">{client.adresseChantier ?? client.adresseClient}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => openEdit(client)}
                    className="p-2 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-all"
                    title="Modifier"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteClientId(client.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-gray-400">
                  Ajouté le {formatDate(client.createdAt)}
                </span>
                <button
                  onClick={() => openDemandeModal(client)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
                >
                  <FileText size={14} />
                  Créer demande
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteClientId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="mb-2 text-center text-lg font-bold text-gray-900">Supprimer ce client ?</h3>
            <p className="mb-6 text-center text-sm text-gray-500">
              Cette action est irréversible. Toutes les données associées seront supprimées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteClientId(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteClientId)}
                disabled={deleteMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition"
              >
                {deleteMutation.isPending
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Trash2 size={15} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600 font-medium px-3">
            Page {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editClient ? 'Modifier le client' : 'Nouveau client'}
              </h3>
              <button
                onClick={closeClientModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prénom" name="prenom" defaultValue={editClient?.prenom} required />
                <FormField label="Nom" name="nom" defaultValue={editClient?.nom} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Email" name="email" type="email" defaultValue={editClient?.email} />
                <FormField label="Téléphone" name="telephone" defaultValue={editClient?.telephone} />
              </div>
              <FormField label="Adresse client" name="adresseClient" defaultValue={editClient?.adresseClient} />
              <FormField label="Adresse chantier" name="adresseChantier" defaultValue={editClient?.adresseChantier} />
              <ProjectTypeCheckboxGroup
                label="Type de projet"
                typesProjet={typesProjet ?? []}
                selectedIds={selectedTypeProjetIds}
                onToggle={toggleProjectType}
                accent="teal"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  name="source"
                  defaultValue={editClient?.source ?? ''}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">-- Choisir --</option>
                  <option value="CHATBOT">Chatbot</option>
                  <option value="TECHNICO_COMMERCIAL">Technico-Commercial</option>
                  <option value="APPEL">Appel</option>
                  <option value="SITE_WEB">Site web</option>
                  <option value="RECOMMANDATION">Recommandation</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editClient?.notes ?? ''}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeClientModal}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-lg shadow-teal-600/20 disabled:opacity-50 transition-all"
                >
                  {editClient ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {demandeClient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Créer une demande de devis</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Client : {demandeClient.prenom} {demandeClient.nom}
                </p>
              </div>
              <button
                onClick={closeDemandeModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Type de projet
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {getClientProjectLabel(demandeClient, 'Non renseigné')}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Source
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {sourceLabels[demandeClient.source ?? 'AUTRE']?.label ?? demandeClient.source ?? 'Autre'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description de la demande
                </label>
                <textarea
                  rows={4}
                  value={demandeDescription}
                  onChange={(event) => setDemandeDescription(event.target.value)}
                  placeholder="Décrivez le besoin du client..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 resize-none"
                />
                <p className="mt-2 text-xs text-gray-400">
                  Cette demande sera créée avec le statut initial `NOUVEAU`.
                </p>
              </div>

              {createDemandeMutation.error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {getApiErrorMessage(
                    createDemandeMutation.error,
                    'Impossible de créer la demande de devis.',
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDemandeModal}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCreateDemande}
                  disabled={createDemandeMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-lg shadow-teal-600/20 disabled:opacity-50 transition-all"
                >
                  {createDemandeMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  Enregistrer la demande
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
      />
    </div>
  );
}
