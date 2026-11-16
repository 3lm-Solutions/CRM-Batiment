import { Fragment, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getImportErrorMessage, parseClientsSpreadsheet } from '@/lib/clientSpreadsheetImport';
import { ProjectTypeCheckboxGroup } from '@/components/ProjectTypeCheckboxGroup';
import { MapPickerModal } from '@/components/MapPickerModal';
import type { Client, TypeProjet, LeadSource } from '@/types';
import { formatDate, getInitials, cn } from '@/lib/utils';
import {
  Search, Edit, Trash2, X, ChevronLeft, ChevronRight,
  Users, Phone, Mail, Building, Loader2,
  MapPin, Home, FileText, Zap, PhoneCall, Upload,
  Info, HardHat, AlertTriangle, CheckCircle2, Sparkles, UserPlus,
} from 'lucide-react';
/* ───── Config labels ───── */
const sourceLabels: Record<string, { label: string; bg: string; text: string }> = {
  CHATBOT: { label: 'Chatbot', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  TECHNICO_COMMERCIAL: { label: 'Technico-Commercial', bg: 'bg-blue-50', text: 'text-blue-700' },
  APPEL: { label: 'Appel', bg: 'bg-green-50', text: 'text-green-700' },
  RECOMMANDATION: { label: 'Recommandation', bg: 'bg-purple-50', text: 'text-purple-700' },
  SITE_WEB: { label: 'Site Web', bg: 'bg-orange-50', text: 'text-orange-700' },
  AUTRE: { label: 'Autre', bg: 'bg-gray-50', text: 'text-gray-600' },
};

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'CHATBOT', label: 'Chatbot' },
  { value: 'TECHNICO_COMMERCIAL', label: 'Technico-Commercial' },
  { value: 'APPEL', label: 'Appel téléphonique' },
  { value: 'RECOMMANDATION', label: 'Recommandation' },
  { value: 'SITE_WEB', label: 'Site Web' },
  { value: 'AUTRE', label: 'Autre' },
];

const besoinOptions = [
  { value: 'DEVIS', label: 'Demande un devis', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', activeBg: 'bg-emerald-100' },
  { value: 'CONTACT_RESPONSABLE', label: 'Contacter responsable', icon: PhoneCall, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', activeBg: 'bg-blue-100' },
  { value: 'INFORMATION', label: 'Demande d\'information', icon: Info, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', activeBg: 'bg-violet-100' },
  { value: 'VISITE_TECHNIQUE', label: 'Visite technique', icon: HardHat, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100' },
  { value: 'URGENCE', label: 'Urgence', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', activeBg: 'bg-red-100' },
];

const besoinConfig: Record<string, { label: string; bg: string; text: string }> = {
  DEVIS: { label: 'Veut un devis', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  RENDEZ_VOUS: { label: 'Veut un rendez-vous', bg: 'bg-sky-50', text: 'text-sky-700' },
  CONTACT_RESPONSABLE: { label: 'Contacter', bg: 'bg-blue-50', text: 'text-blue-700' },
  INFORMATION: { label: 'Information', bg: 'bg-violet-50', text: 'text-violet-700' },
  VISITE_TECHNIQUE: { label: 'Visite tech.', bg: 'bg-amber-50', text: 'text-amber-700' },
  URGENCE: { label: 'Urgent', bg: 'bg-red-50', text: 'text-red-700' },
};

/* ───── Types ───── */
interface ClientForm {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresseClient: string;
  adresseChantier: string;
  typeProjetIds: number[];
  source: string;
  besoin: string;
  notes: string;
}

const emptyForm: ClientForm = {
  nom: '', prenom: '', email: '', telephone: '',
  adresseClient: '', adresseChantier: '', typeProjetIds: [], source: 'AUTRE', besoin: '', notes: '',
};

function getClientProjectTypes(client: Client) {
  if ((client.typeProjets?.length ?? 0) > 0) return client.typeProjets ?? [];
  return client.typeProjet ? [client.typeProjet] : [];
}

function getClientProjectLabel(client: Client, fallback = 'Projet') {
  const labels = getClientProjectTypes(client).map((project) => project.nom).filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : fallback;
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [genDescription, setGenDescription] = useState('');
  const [mapPickerField, setMapPickerField] = useState<'adresseClient' | 'adresseChantier' | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const limit = 8;

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      const res = await api.get('/clients', { params });
      return res.data;
    },
  });

  const { data: typesProjetData } = useQuery({
    queryKey: ['types-projet'],
    queryFn: async () => {
      const res = await api.get('/types-projet');
      return (res.data ?? []) as TypeProjet[];
    },
  });

  const projectTypesForClientForm = useMemo(() => {
    const all = typesProjetData ?? [];
    const complex = all
      .filter((typeProjet) => (typeProjet.categories?.length ?? 0) > 1)
      .sort((a, b) => a.nom.localeCompare(b.nom));
    const simple = all
      .filter((typeProjet) => (typeProjet.categories?.length ?? 0) <= 1)
      .sort((a, b) => a.nom.localeCompare(b.nom));

    return {
      items: [...complex, ...simple],
      complexCount: complex.length,
      simpleCount: simple.length,
    };
  }, [typesProjetData]);

  const clients: Client[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };
  const canCreateClient = user?.role !== 'ASSISTANTE';

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/clients', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch(`/clients/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setDeleteId(null); },
  });

  // Mutation : générer une demande de devis automatiquement
  const generateDemandeMutation = useMutation({
    mutationFn: (body: { clientId: number; description: string; source: string }) =>
      api.post('/demandes-devis', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['demandes-devis'] });
      setExpandedId(null);
      setGenDescription('');
      navigate('/admin/demandes-devis');
    },
  });

  function openCreate() { setEditingClient(null); setForm(emptyForm); setShowModal(true); }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      nom: client.nom ?? '', prenom: client.prenom ?? '',
      email: client.email ?? '', telephone: client.telephone ?? '',
      adresseClient: client.adresseClient ?? '', adresseChantier: client.adresseChantier ?? '',
      typeProjetIds:
        client.typeProjetIds ??
        getClientProjectTypes(client).map((project) => project.id),
      source: client.source ?? 'AUTRE', besoin: client.besoin ?? '', notes: client.notes ?? '',
    });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditingClient(null); setForm(emptyForm); }

  function toggleProjectType(typeProjetId: number) {
    setForm((current) => ({
      ...current,
      typeProjetIds: current.typeProjetIds.includes(typeProjetId)
        ? current.typeProjetIds.filter((id) => id !== typeProjetId)
        : [...current.typeProjetIds, typeProjetId],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      nom: form.nom,
      prenom: form.prenom || undefined,
      email: form.email || undefined,
      telephone: form.telephone || undefined,
      adresseClient: form.adresseClient || undefined,
      adresseChantier: form.adresseChantier || undefined,
      typeProjetIds: form.typeProjetIds,
      source: form.source || 'AUTRE',
      besoin: form.besoin || undefined,
      notes: form.notes || undefined,
    };
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function handleGenerateDemande(client: Client) {
    const typeLabel = getClientProjectLabel(client);
    const desc = genDescription.trim() || `${typeLabel} — ${client.prenom ?? ''} ${client.nom}`.trim();
    generateDemandeMutation.mutate({
      clientId: client.id,
      description: desc,
      source: client.source ?? 'AUTRE',
    });
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportFeedback(null);
    setIsImporting(true);

    try {
      const parsed = await parseClientsSpreadsheet(file, typesProjetData ?? []);
      const apiErrors: { rowNumber: number; reason: string }[] = [];
      let createdCount = 0;

      for (const row of parsed.rows) {
        try {
          await api.post('/clients', row.payload);
          createdCount += 1;
        } catch (error) {
          apiErrors.push({
            rowNumber: row.rowNumber,
            reason: getImportErrorMessage(error, 'Creation impossible.'),
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['clients'] });

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
        message: `Import termine: ${createdCount} cree(s), ${failedCount} echec(s), ${parsed.skippedRows} ligne(s) vide(s) ignoree(s).${details}`,
      });
    } catch (error) {
      setImportFeedback({
        type: 'error',
        message: getImportErrorMessage(error, 'Impossible de lire le fichier Excel.'),
      });
    } finally {
      setIsImporting(false);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-primary-600" />
            Gestion des Clients
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta.total} client(s) enregistré(s)</p>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {isImporting ? 'Import en cours...' : 'Importer Excel'}
          </button>
          {canCreateClient ? (
            <button onClick={openCreate} className="inline-flex items-center gap-2 batiflow-gradient text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all font-medium text-sm">
              <ChevronRight size={17} /> Nouveau client
            </button>
          ) : null}
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

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher par nom, email, téléphone..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all" />
        </div>
      </div>

      {/* Table */}
      <div className="max-w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={32} className="text-gray-300" /></div>
            <p className="text-lg font-semibold text-gray-700">Aucun client trouvé</p>
            <p className="text-sm text-gray-400 mt-1">Commencez par ajouter votre premier client.</p>
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 text-primary-600 font-medium text-sm hover:text-primary-700"><UserPlus size={16} /> Ajouter un client</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/90">
                  <th className="w-[6%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">ID</th>
                  <th className="w-[18%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Client</th>
                  <th className="w-[20%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Contact</th>
                  <th className="w-[17%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Type projet</th>
                  <th className="w-[11%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Besoin</th>
                  <th className="w-[13%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Source</th>
                  <th className="w-[9%] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="w-[6%] px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => {
                  const isExpanded = expandedId === client.id;
                  const bCfg = besoinConfig[client.besoin ?? ''];
                  const wantsDevis = client.besoin === 'DEVIS';
                  const projectTypes = getClientProjectTypes(client);
                  const primaryProject = projectTypes[0];
                  const fullName = `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() || 'Client sans nom';

                  return (
                    <Fragment key={client.id}>
                      <tr
                        className={cn(
                          'group cursor-pointer border-l-2 transition-colors',
                          wantsDevis ? 'border-l-emerald-300 hover:bg-emerald-50/40' : 'border-l-transparent hover:bg-slate-50',
                          isExpanded && 'bg-slate-50',
                        )}
                        onClick={() => { setExpandedId(isExpanded ? null : client.id); setGenDescription(''); }}
                      >
                        {/* ID */}
                        <td className="px-3 py-3.5 align-top">
                          <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-mono font-semibold text-gray-500">
                            #{client.id}
                          </span>
                        </td>

                        {/* Client */}
                        <td className="px-3 py-3.5 align-top">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold shadow-sm',
                              wantsDevis
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                : 'border-blue-200 bg-blue-100 text-blue-700',
                            )}>
                              {getInitials(fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-gray-900" title={fullName}>
                                {fullName}
                              </p>
                              {wantsDevis && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  <Sparkles size={12} />
                                  Demande devis
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-3 py-3.5 align-top">
                          <div className="min-w-0 space-y-1.5">
                            {client.email && (
                              <p className="flex min-w-0 items-center gap-2 text-[13px] text-gray-700">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                                  <Mail size={13} />
                                </span>
                                <span className="truncate" title={client.email}>{client.email}</span>
                              </p>
                            )}
                            {client.telephone && (
                              <p className="flex min-w-0 items-center gap-2 text-[13px] text-gray-700">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                                  <Phone size={13} />
                                </span>
                                <span className="truncate" title={client.telephone}>{client.telephone}</span>
                              </p>
                            )}
                            {!client.email && !client.telephone && (
                              <span className="text-[12px] text-gray-400">Non renseigne</span>
                            )}
                          </div>
                        </td>

                        {/* Type projet */}
                        <td className="px-3 py-3.5 align-top">
                          {primaryProject ? (
                            <div className="space-y-1">
                              <div
                                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700"
                                title={primaryProject.nom}
                              >
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                                  <Building size={13} />
                                </span>
                                <span className="truncate">{primaryProject.nom}</span>
                              </div>
                              {projectTypes.length > 1 && (
                                <p className="text-[11px] font-medium text-gray-500">+{projectTypes.length - 1} autre(s) type(s)</p>
                              )}
                            </div>
                          ) : <span className="text-[12px] text-gray-300">-</span>}
                        </td>

                        {/* Besoin */}
                        <td className="px-3 py-3.5 align-top">
                          {bCfg ? (
                            <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold', bCfg.bg, bCfg.text)}>
                              {bCfg.label}
                            </span>
                          ) : <span className="text-[12px] text-gray-300">-</span>}
                        </td>

                        {/* Source */}
                        <td className="min-w-0 px-3 py-3.5 align-top">
                          {(() => {
                            const src = sourceLabels[client.source ?? 'AUTRE'] ?? sourceLabels.AUTRE;
                            return (
                              <span
                                className={cn('inline-flex max-w-full items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold', src.bg, src.text)}
                                title={src.label}
                              >
                                <span className="truncate">{src.label}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-3 py-3.5 align-top text-[13px] font-medium text-gray-600">{formatDate(client.createdAt)}</td>

                        {/* Actions */}
                        <td className="px-3 py-3.5 align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(client); }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                              title="Modifier"
                            >
                              <Edit size={13} />
                            </button>
                            {canCreateClient && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteId(client.id); }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                title="Supprimer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ─── Expandable Panel ─── */}
                      {isExpanded && (
                        <tr key={`${client.id}-expand`} className="bg-gray-50/50">
                          <td colSpan={8} className="px-3 py-3">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" onClick={(e) => e.stopPropagation()}>
                              {/* Col 1: Détails client */}
                              <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-3 space-y-2">
                                <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Détails du client</h4>
                                <div className="space-y-2 text-sm">
                                  {client.adresseClient && (
                                    <p className="flex items-center gap-2 text-gray-600"><Home size={13} className="text-blue-400" /> {client.adresseClient}</p>
                                  )}
                                  {client.adresseChantier && (
                                    <p className="flex items-center gap-2 text-gray-600"><MapPin size={13} className="text-orange-400" /> {client.adresseChantier}</p>
                                  )}
                                  {!client.adresseClient && !client.adresseChantier && (
                                    <p className="text-gray-400 text-sm italic">Aucune adresse renseignée</p>
                                  )}
                                  {client.notes && (
                                    <div className="mt-2 p-2.5 bg-gray-50 rounded-lg">
                                      <p className="text-[11px] font-bold text-gray-400 uppercase mb-1">Notes</p>
                                      <p className="text-gray-600 text-[13px]">{client.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Col 2: Type de projet détaillé */}
                              <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-3 space-y-2">
                                <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Projet</h4>
                                {projectTypes.length > 0 ? (
                                  <div className="space-y-2">
                                    {projectTypes.map((projectType) => (
                                      <div key={`${client.id}-project-${projectType.id}`} className="rounded-lg bg-blue-50/70 p-2.5">
                                        <div className="flex items-center gap-2">
                                          <Building size={16} className="text-blue-600" />
                                          <span className="font-semibold text-gray-800">{projectType.nom}</span>
                                        </div>
                                        {projectType.description && (
                                          <p className="mt-1 text-[13px] text-gray-500">{projectType.description}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 text-sm italic">Aucun type de projet assigné</p>
                                )}
                                {bCfg && (
                                  <div className="mt-3">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase mb-1">Besoin exprimé</p>
                                    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold', bCfg.bg, bCfg.text)}>
                                      {bCfg.label}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Col 3: Action — Générer demande de devis */}
                              <div className={cn(
                                'min-w-0 rounded-xl p-3 space-y-2 border-2',
                                wantsDevis ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-gray-200 bg-white',
                              )}>
                                <h4 className={cn(
                                  'text-[12px] font-bold uppercase tracking-wide flex items-center gap-1.5',
                                  wantsDevis ? 'text-emerald-700' : 'text-gray-500',
                                )}>
                                  <Zap size={13} /> Générer une demande de devis
                                </h4>
                                {wantsDevis && (
                                  <div className="flex items-center gap-2 p-2 bg-emerald-100 rounded-lg">
                                    <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                                    <p className="text-[12px] font-semibold text-emerald-700">Ce client a demandé un devis !</p>
                                  </div>
                                )}
                                <div>
                                  <label className="block text-[12px] font-semibold text-gray-600 mb-1">Description du besoin</label>
                                  <textarea
                                    value={genDescription}
                                    onChange={(e) => setGenDescription(e.target.value)}
                                    placeholder={`Ex: ${getClientProjectLabel(client, 'Rénovation')} — ${client.adresseChantier ?? 'adresse à préciser'}`}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none transition-all"
                                  />
                                </div>
                                <button
                                  onClick={() => handleGenerateDemande(client)}
                                  disabled={generateDemandeMutation.isPending}
                                  className={cn(
                                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
                                    wantsDevis
                                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/20'
                                      : 'batiflow-gradient text-white hover:shadow-lg hover:shadow-blue-500/20',
                                    generateDemandeMutation.isPending && 'opacity-50',
                                  )}
                                >
                                  {generateDemandeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                  Créer la demande de devis
                                </button>
                                {generateDemandeMutation.error && (
                                  <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">Erreur lors de la création.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[13px] text-gray-500">Page <span className="font-semibold text-gray-700">{meta.page}</span> sur <span className="font-semibold text-gray-700">{meta.totalPages}</span></p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-40 transition-all"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-40 transition-all"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingClient ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={closeModal} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Nom / Prénom */}
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Nom" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} required />
                <InputField label="Prénom" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
              </div>

              {/* Email / Téléphone */}
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <InputField label="Téléphone" value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} />
              </div>

              {/* Adresses */}
              <AddressFieldWithMap
                label="Adresse Client"
                value={form.adresseClient}
                onChange={(v) => setForm({ ...form, adresseClient: v })}
                onMapClick={() => setMapPickerField('adresseClient')}
              />
              <AddressFieldWithMap
                label="Adresse Chantier"
                value={form.adresseChantier}
                onChange={(v) => setForm({ ...form, adresseChantier: v })}
                onMapClick={() => setMapPickerField('adresseChantier')}
              />

              {/* Type de projet & Source */}
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <ProjectTypeCheckboxGroup
                  label="Type de projet"
                  typesProjet={projectTypesForClientForm.items}
                  selectedIds={form.typeProjetIds}
                  onToggle={toggleProjectType}
                  helperText={`${projectTypesForClientForm.complexCount} type(s) complexe(s) et ${projectTypesForClientForm.simpleCount} type(s) simple(s) disponibles.`}
                  accent="primary"
                />
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all bg-white">
                    {sourceOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* ─── Besoin rapide ─── */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                  Besoin du client <span className="text-gray-400 font-normal text-[12px]">— cliquez pour sélectionner</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {besoinOptions.map((b) => {
                    const selected = form.besoin === b.value;
                    const Icon = b.icon;
                    return (
                      <button key={b.value} type="button"
                        onClick={() => setForm({ ...form, besoin: selected ? '' : b.value })}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-[12px] font-semibold transition-all',
                          selected
                            ? `${b.activeBg} ${b.border} ${b.color} shadow-sm`
                            : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50',
                        )}
                      >
                        <Icon size={15} className={selected ? b.color : 'text-gray-400'} />
                        {b.label}
                        {selected && <CheckCircle2 size={13} className={cn('ml-auto', b.color)} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm resize-none transition-all"
                  placeholder="Informations complémentaires, détails du besoin..." />
              </div>

              {/* Errors */}
              {(createMutation.error || updateMutation.error) && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">Une erreur est survenue. Veuillez réessayer.</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-medium text-white batiflow-gradient rounded-xl hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 transition-all">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingClient ? 'Enregistrer' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Map Picker ─── */}
      <MapPickerModal
        open={mapPickerField !== null}
        title={mapPickerField === 'adresseClient' ? 'Sélectionner l\'adresse client' : 'Sélectionner l\'adresse chantier'}
        initialAddress={mapPickerField === 'adresseClient' ? form.adresseClient : form.adresseChantier}
        onClose={() => setMapPickerField(null)}
        onConfirm={(address) => {
          if (mapPickerField === 'adresseClient') {
            setForm((f) => ({ ...f, adresseClient: address }));
          } else {
            setForm((f) => ({ ...f, adresseChantier: address }));
          }
        }}
      />

      {/* ─── Delete Confirmation ─── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 className="text-red-600" size={24} /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer ce client ?</h3>
            <p className="text-sm text-gray-500 mb-6">Cette action est irréversible. Toutes les données associées seront supprimées.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Reusable InputField ─── */
function InputField({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all" />
    </div>
  );
}

/* ─── Address field with map picker button ─── */
function AddressFieldWithMap({ label, value, onChange, onMapClick }: {
  label: string; value: string; onChange: (v: string) => void; onMapClick: () => void;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all"
          placeholder="Saisir manuellement ou choisir sur la carte"
        />
        <button
          type="button"
          onClick={onMapClick}
          title="Choisir sur la carte OpenStreetMap"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
        >
          <MapPin size={16} />
        </button>
      </div>
    </div>
  );
}
