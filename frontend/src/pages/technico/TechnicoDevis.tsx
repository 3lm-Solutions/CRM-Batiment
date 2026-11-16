import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { DevisInvoice } from '@/components/DevisInvoice';
import { DevisManualEditorModal } from '@/components/devis/DevisManualEditorModal';
import { SignatureCanvas } from '@/components/signature/SignatureCanvas';
import type { SignatureCanvasHandle } from '@/components/signature/SignatureCanvas';
import { FactureDocument } from '@/components/documents/FactureDocument';
import { BonCommandeDocument } from '@/components/documents/BonCommandeDocument';
import { CommandeFournisseurDocument } from '@/components/documents/CommandeFournisseurDocument';
import {
  buildSupplierPurchaseDocumentData,
  type SupplierPurchaseDocumentData,
} from '@/lib/documentBuilders';
import type {
  BonCommande,
  Client,
  Devis,
  DevisStatut,
  Facture,
} from '@/types';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileSpreadsheet,
  Loader2,
  MoreVertical,
  Search,
  Send,
  X,
  XCircle,
  Receipt,
} from 'lucide-react';

const statutConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  BROUILLON: { label: 'Brouillon', color: 'text-slate-700', bg: 'bg-slate-100', icon: <Clock size={14} /> },
  ENVOYE: { label: 'Envoye', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Send size={14} /> },
  ACCEPTE: { label: 'Accepte', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle2 size={14} /> },
  SIGNE: { label: 'Signe conseiller', color: 'text-emerald-800', bg: 'bg-emerald-200', icon: <CheckCircle2 size={14} /> },
  REFUSE: { label: 'Refuse', color: 'text-rose-700', bg: 'bg-rose-100', icon: <XCircle size={14} /> },
  ANNULE: { label: 'Annule', color: 'text-amber-700', bg: 'bg-amber-100', icon: <XCircle size={14} /> },
  REVISE: { label: 'Revise', color: 'text-violet-700', bg: 'bg-violet-100', icon: <MoreVertical size={14} /> },
  RENVOYE: { label: 'Renvoye', color: 'text-cyan-700', bg: 'bg-cyan-100', icon: <Send size={14} /> },
};

const statutActions: Record<DevisStatut, { label: string; value: DevisStatut; color: string }[]> = {
  BROUILLON: [
    { label: 'Marquer Envoye', value: 'ENVOYE', color: 'text-blue-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  ENVOYE: [
    { label: 'Marquer Signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Marquer Accepte', value: 'ACCEPTE', color: 'text-emerald-600' },
    { label: 'Marquer Refuse', value: 'REFUSE', color: 'text-rose-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  ACCEPTE: [
    { label: 'Marquer Signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  SIGNE: [],
  REFUSE: [
    { label: 'Passer en Revise', value: 'REVISE', color: 'text-violet-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  ANNULE: [],
  REVISE: [
    { label: 'Renvoyer au client', value: 'RENVOYE', color: 'text-cyan-700' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  RENVOYE: [
    { label: 'Marquer Signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Marquer Accepte', value: 'ACCEPTE', color: 'text-emerald-600' },
    { label: 'Marquer Refuse', value: 'REFUSE', color: 'text-rose-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
};

interface CreateDevisForm {
  clientId: string;
  tauxTVA: string;
  notes: string;
}

const emptyForm: CreateDevisForm = {
  clientId: '',
  tauxTVA: '20',
  notes: '',
};

type ActiveGeneratedDocument =
  | { kind: 'facture'; devis: Devis; facture: Facture }
  | { kind: 'bonCommande'; devis: Devis; bonCommande: BonCommande }
  | { kind: 'commandeFournisseur'; document: SupplierPurchaseDocumentData }
  | null;

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
    if (typeof apiMessage === 'string') return apiMessage;
    if (Array.isArray(apiMessage)) {
      return apiMessage.filter((item): item is string => typeof item === 'string').join(' | ');
    }
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function buildPurchaseOrderFeedback(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const message =
    'message' in data && typeof data.message === 'string'
      ? data.message
      : fallback;
  const warnings =
    'warnings' in data && Array.isArray(data.warnings)
      ? data.warnings.filter(
          (warning): warning is string => typeof warning === 'string',
        )
      : [];

  return warnings.length > 0
    ? `${message} Avertissements: ${warnings.join(' | ')}`
    : message;
}

export default function TechnicoDevis() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingDevisId, setPendingDevisId] = useState<number | null>(null);
  const signatureCanvasRef = useRef<SignatureCanvasHandle | null>(null);
  const [previewDevisId, setPreviewDevisId] = useState<number | null>(null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [activeDocumentPreview, setActiveDocumentPreview] =
    useState<ActiveGeneratedDocument>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [sendingDevisId, setSendingDevisId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [form, setForm] = useState<CreateDevisForm>(emptyForm);
  const limit = 10;

  const { data: profileSignature } = useQuery({
    queryKey: ['conseiller-signature-profile'],
    queryFn: async () => {
      const response = await api.get('/conseiller/signature');
      return response.data;
    },
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['technico-devis', page, search, statutFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      if (statutFilter) params.statut = statutFilter;
      const response = await api.get('/devis', { params });
      return response.data;
    },
  });

  const { data: previewDevis, isLoading: loadingPreview } = useQuery({
    queryKey: ['technico-devis-detail', previewDevisId],
    enabled: previewDevisId !== null,
    queryFn: async () => {
      const response = await api.get(`/devis/${previewDevisId}`);
      return response.data as Devis;
    },
  });

  const { data: clientsList } = useQuery({
    queryKey: ['technico-clients-select'],
    queryFn: async () => {
      const response = await api.get('/clients', { params: { limit: 200 } });
      return (response.data?.data ?? response.data) as Client[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/devis', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technico-devis'] });
      setShowCreate(false);
      setForm(emptyForm);
    },
  });

  const updateStatut = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: DevisStatut }) =>
      api.patch(`/devis/${id}/statut`, { statut }),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technico-devis'] });
      queryClient.invalidateQueries({ queryKey: ['technico-devis-brouillon'] });
      closeActionMenu();
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Erreur lors de la mise a jour du statut du devis.'),
      });
    },
  });

  const sendClientMutation = useMutation({
    mutationFn: (id: number) => api.post(`/devis/${id}/send-client`),
    onMutate: (id) => {
      setSendingDevisId(id);
      setFeedback(null);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['technico-devis'] });
      queryClient.invalidateQueries({ queryKey: ['technico-devis-brouillon'] });
      setFeedback({
        type: 'success',
        text: response.data?.message ?? 'Devis envoye au client avec succes.',
      });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Erreur lors de l envoi du devis au client.'),
      });
    },
    onSettled: () => {
      setSendingDevisId(null);
    },
  });

  const validateBonCommandeAndSendMutation = useMutation({
    mutationFn: (devisId: number) =>
      api.post(`/devis/${devisId}/bon-commande/validate-send`),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: async (response, devisId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['technico-devis'] }),
        queryClient.invalidateQueries({
          queryKey: ['technico-devis-brouillon'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['technico-devis-detail', devisId],
        }),
      ]);
      setActionMenuId(null);
      setFeedback({
        type: 'success',
        text: buildPurchaseOrderFeedback(
          response.data,
          'Bon de commande valide et commandes fournisseur traitees.',
        ),
      });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(
          error,
          'Erreur lors de la validation du bon de commande fournisseur.',
        ),
      });
    },
  });

  const createFactureFromDevisMutation = useMutation({
    mutationFn: (devisId: number) => api.post(`/factures/from-devis/${devisId}`, {}),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: (response) => {
      setFeedback({ type: 'success', text: 'Facture creee depuis le devis.' });
      navigate(`/technico/factures/${response.data.id}`);
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible de transformer ce devis en facture.'),
      });
    },
  });

  const devisList: Devis[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };
  const allStatuts: DevisStatut[] = ['BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE', 'REVISE', 'RENVOYE', 'SIGNE'];
  const listErrorText = isError
    ? getApiErrorMessage(error, 'Erreur lors du chargement des devis.')
    : null;

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    const body: Record<string, unknown> = {
      clientId: Number(form.clientId),
      tauxTVA: Number(form.tauxTVA),
      modeValidation: 'VERBAL',
    };

    if (form.notes.trim()) body.notes = form.notes.trim();

    createMutation.mutate(body);
  }

  function canSendToClient(statut: string) {
    return ['BROUILLON', 'REVISE', 'ENVOYE', 'RENVOYE'].includes(statut);
  }

  function toggleActionMenu(devisId: number) {
    setActionMenuId((current) => (current === devisId ? null : devisId));
  }

  function closeActionMenu() {
    setActionMenuId(null);
  }

  function handleOpenFacture(factureId: number) {
    if (!previewDevis) return;
    const facture = previewDevis.factures?.find((item) => item.id === factureId);
    if (!facture) return;
    setActiveDocumentPreview({ kind: 'facture', devis: previewDevis, facture });
  }

  function handleOpenBonCommande() {
    if (!previewDevis?.bonCommande) return;
    setActiveDocumentPreview({
      kind: 'bonCommande',
      devis: previewDevis,
      bonCommande: previewDevis.bonCommande,
    });
  }

  function handleOpenCommandeFournisseur(commandeId: number) {
    if (!previewDevis) return;
    const commande = previewDevis.commandesFournisseur?.find((item) => item.id === commandeId);
    if (!commande) return;
    setActiveDocumentPreview({
      kind: 'commandeFournisseur',
      document: buildSupplierPurchaseDocumentData(previewDevis, commande),
    });
  }

  async function refreshPreviewDevis() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['technico-devis'] }),
      queryClient.invalidateQueries({ queryKey: ['technico-devis-detail', previewDevisId] }),
    ]);
  }

  async function applyConseillerSignature(devisId: number) {
    await api.post(`/devis/${devisId}/signature/appose-conseiller`);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['technico-devis'] }),
      queryClient.invalidateQueries({ queryKey: ['technico-devis-brouillon'] }),
      queryClient.invalidateQueries({ queryKey: ['technico-devis-detail', devisId] }),
    ]);

    closeActionMenu();
    setPreviewDevisId(devisId);
    setFeedback({
      type: 'success',
      text: 'Signature apposee. Statut dossier: signe_conseiller.',
    });
  }

  function handleStatutAction(
    devisId: number,
    statut: DevisStatut,
    modeValidation?: Devis['modeValidation'],
  ) {
    closeActionMenu();

    if (statut !== 'SIGNE') {
      updateStatut.mutate({ id: devisId, statut });
      return;
    }

    const conseillerSignature = profileSignature?.signatureBase64;
    if (!conseillerSignature) {
      setPendingDevisId(devisId);
      setShowSignatureModal(true);
      return;
    }

    (async () => {
      if (modeValidation !== 'VERBAL') {
        await api.patch(`/devis/${devisId}`, { modeValidation: 'VERBAL' });
      }
      await applyConseillerSignature(devisId);
    })().catch((err: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(err, 'Erreur lors de la signature du devis.'),
      });
    });
  }

  async function handleSaveSignatureAndSign() {
    if (!pendingDevisId) return;

    const signatureBase64 = signatureCanvasRef.current?.exportAsDataUrl();
    if (!signatureBase64) return;

    try {
      await api.post('/conseiller/signature', { signatureBase64 });
      await queryClient.invalidateQueries({ queryKey: ['conseiller-signature-profile'] });
      await api.patch(`/devis/${pendingDevisId}`, { modeValidation: 'VERBAL' });
      await applyConseillerSignature(pendingDevisId);
      setShowSignatureModal(false);
      setPendingDevisId(null);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(err, 'Erreur lors de la sauvegarde de la signature.'),
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Mes devis</h2>
          <p className="mt-0.5 text-sm text-slate-400">{meta.total} devis au total</p>
        </div>
      </div>

      {feedback && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setFeedback(null)}>
          <div 
            className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
                feedback.type === 'success' 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "bg-red-50 text-red-600"
              )}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 size={28} />
                ) : (
                  <XCircle size={28} />
                )}
              </div>
              
              <h3 className="text-lg font-bold text-slate-900">
                {feedback.type === 'success' ? "Succès" : "Action bloquée"}
              </h3>
              
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {feedback.text}
              </p>
              
              <button
                onClick={() => setFeedback(null)}
                className={cn(
                  "mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                  feedback.type === 'success'
                    ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                    : "bg-red-600 hover:bg-red-700 active:bg-red-800"
                )}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setStatutFilter('');
            setPage(1);
          }}
          className={cn(
            'whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium transition-all',
            !statutFilter
              ? 'border-teal-200 bg-teal-50 text-teal-700'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
          )}
        >
          Tous ({meta.total})
        </button>
        {allStatuts.map((statut) => {
          const config = statutConfig[statut];

          return (
            <button
              key={statut}
              onClick={() => {
                setStatutFilter(statutFilter === statut ? '' : statut);
                setPage(1);
              }}
              className={cn(
                'inline-flex whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium transition-all',
                statutFilter === statut
                  ? cn(config.bg, config.color, 'border-transparent')
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
              )}
            >
              <span className="mr-1.5">{config.icon}</span>
              {config.label}
            </button>
          );
        })}
      </div>

      <div className="flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100">
        <Search size={18} className="text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par reference..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-300 transition hover:text-slate-500">
            <X size={16} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-teal-500" size={32} />
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {listErrorText}
        </div>
      ) : devisList.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
            <FileSpreadsheet size={28} className="text-teal-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Aucun devis</h3>
          <p className="mt-1 text-sm text-slate-400">Creez votre premier devis.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devisList.map((devis) => {
            const config = statutConfig[devis.statut] ?? statutConfig.BROUILLON;
            const actions = statutActions[devis.statut] ?? [];
            const clientName = devis.client
              ? `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim()
              : 'Client';

            return (
              <div
                key={devis.id}
                className="rounded-3xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-4 p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 text-sm font-bold text-teal-600">
                    {devis.reference?.slice(-4) ?? '#'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{devis.reference}</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', config.bg, config.color)}>
                        {config.icon}
                        {config.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {clientName} • {formatDate(devis.createdAt)}
                    </p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-base font-extrabold tabular-nums text-slate-900">
                      {formatCurrency(devis.totalTTC ?? 0)}
                    </p>
                    <p className="text-[11px] text-slate-400">HT: {formatCurrency(devis.totalHT ?? 0)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {canSendToClient(devis.statut) && (
                      <button
                        onClick={() => sendClientMutation.mutate(devis.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                        title={
                          devis.statut === 'ENVOYE' || devis.statut === 'RENVOYE'
                            ? 'Renvoyer au client'
                            : 'Envoyer au client'
                        }
                      >
                        {sendingDevisId === devis.id && sendClientMutation.isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setPreviewDevisId(devis.id)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-600"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => createFactureFromDevisMutation.mutate(devis.id)}
                      disabled={createFactureFromDevisMutation.isPending || !isAdmin}
                      className={cn(
                        "rounded-lg p-2 transition",
                        isAdmin
                          ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                          : "text-slate-200 cursor-not-allowed opacity-40"
                      )}
                      title={isAdmin ? "Transformer en facture" : "Non autorisé (réservé à l'Admin)"}
                    >
                      {createFactureFromDevisMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Receipt size={16} />
                      )}
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => toggleActionMenu(devis.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
                      >
                        <ChevronRight size={16} />
                      </button>

                      {actionMenuId === devis.id && actions.length > 0 && (
                        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                          {actions.map((action) => (
                            <MenuAction
                              key={action.value}
                              label={action.label}
                              color={action.color}
                              onClick={() =>
                                handleStatutAction(devis.id, action.value, devis.modeValidation)
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-3 text-sm font-medium text-slate-600">
            Page {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            disabled={page >= meta.totalPages}
            className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Creer votre signature</h3>
            <SignatureCanvas ref={signatureCanvasRef} className="mb-4 h-40 w-full rounded-xl border" />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                onClick={() => {
                  setShowSignatureModal(false);
                  setPendingDevisId(null);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-emerald-700"
                onClick={handleSaveSignatureAndSign}
              >
                Enregistrer et signer
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-bold text-slate-900">Nouveau devis</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Client *</label>
                <select
                  required
                  value={form.clientId}
                  onChange={(event) => setForm({ ...form, clientId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">Selectionner un client</option>
                  {(clientsList ?? []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {`${client.prenom ?? ''} ${client.nom}`.trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">TVA (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.tauxTVA}
                  onChange={(event) => setForm({ ...form, tauxTVA: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {createMutation.error && (
                <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  Erreur lors de la creation.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Creer le devis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loadingPreview && previewDevisId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl">
            <Loader2 size={18} className="animate-spin text-teal-600" />
            <span className="text-sm font-medium text-slate-700">Chargement du devis...</span>
          </div>
        </div>
      )}

      {previewDevis && previewDevisId !== null && (
        <DevisInvoice
          devis={previewDevis}
          onClose={() => setPreviewDevisId(null)}
          onPrint={() => window.print()}
          showGeneratedDocuments={false}
          onManualEdit={() => setShowManualEditor(true)}
          onOpenFacture={handleOpenFacture}
          onOpenBonCommande={handleOpenBonCommande}
          onOpenCommandeFournisseur={handleOpenCommandeFournisseur}
          onValidateBonCommandeAndSend={
            previewDevis.bonCommande &&
            ['ACCEPTE', 'SIGNE'].includes(previewDevis.statut) &&
            (previewDevis.bonCommande.statut !== 'ENVOYE' ||
              (previewDevis.commandesFournisseur ?? []).some(
                (commande) => commande.statutLivraison === 'CREEE',
              ))
              ? async () => {
                  await validateBonCommandeAndSendMutation.mutateAsync(
                    previewDevis.id,
                  );
                }
              : undefined
          }
          validateBonCommandeLabel={
            previewDevis.bonCommande?.statut === 'BROUILLON'
              ? 'Valider BC et envoyer fournisseurs'
              : 'Envoyer commandes fournisseur'
          }
          validateBonCommandeConfirmMessage="Confirmez-vous la validation du bon de commande et l envoi des commandes fournisseur ?"
          validateBonCommandeLoadingLabel="Envoi en cours..."
        />
      )}

      {previewDevis && showManualEditor && (
        <DevisManualEditorModal
          devis={previewDevis}
          open={showManualEditor}
          onClose={() => setShowManualEditor(false)}
          onSaved={refreshPreviewDevis}
        />
      )}

      {activeDocumentPreview?.kind === 'facture' && (
        <FactureDocument
          devis={activeDocumentPreview.devis}
          facture={activeDocumentPreview.facture}
          onClose={() => setActiveDocumentPreview(null)}
          onPrint={() => window.print()}
        />
      )}

      {activeDocumentPreview?.kind === 'bonCommande' && (
        <BonCommandeDocument
          devis={activeDocumentPreview.devis}
          bonCommande={activeDocumentPreview.bonCommande}
          onClose={() => setActiveDocumentPreview(null)}
          onPrint={() => window.print()}
        />
      )}

      {activeDocumentPreview?.kind === 'commandeFournisseur' && (
        <CommandeFournisseurDocument
          document={activeDocumentPreview.document}
          onClose={() => setActiveDocumentPreview(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  );
}

function MenuAction({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('w-full px-4 py-2 text-left text-sm font-medium transition hover:bg-slate-50', color)}
    >
      {label}
    </button>
  );
}

