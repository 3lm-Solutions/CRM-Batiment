import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { DevisInvoice } from '@/components/DevisInvoice';
import { DevisManualEditorModal } from '@/components/devis/DevisManualEditorModal';
import { FactureDocument } from '@/components/documents/FactureDocument';
import { BonCommandeDocument } from '@/components/documents/BonCommandeDocument';
import { CommandeFournisseurDocument } from '@/components/documents/CommandeFournisseurDocument';
import {
  buildSupplierPurchaseDocumentData,
  type SupplierPurchaseDocumentData,
} from '@/lib/documentBuilders';
import type { BonCommande, Client, Devis, DevisStatut, Facture } from '@/types';
import { createPortal } from 'react-dom';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Loader2,
  MoreVertical,
  Search,
  Send,
  Trash2,
  X,
  Receipt,
  CheckCircle,
  AlertCircle,
  Pencil,
} from 'lucide-react';

const statutConfig: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  BROUILLON: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', label: 'Brouillon' },
  ENVOYE: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Envoye' },
  ACCEPTE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Accepte' },
  SIGNE: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-600', label: 'Signe' },
  REFUSE: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Refuse' },
  ANNULE: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Annule' },
  REVISE: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Revise' },
  RENVOYE: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500', label: 'Renvoye' },
};

interface DevisForm {
  clientId: string;
  tauxTVA: string;
  notes: string;
}

const emptyForm: DevisForm = {
  clientId: '',
  tauxTVA: '20',
  notes: '',
};

const statutActions: Record<DevisStatut, { label: string; value: DevisStatut; color: string }[]> = {
  BROUILLON: [
    { label: 'Marquer envoye', value: 'ENVOYE', color: 'text-blue-600' },
    { label: 'Marquer signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  ENVOYE: [
    { label: 'Marquer signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Marquer accepte', value: 'ACCEPTE', color: 'text-emerald-600' },
    { label: 'Marquer refuse', value: 'REFUSE', color: 'text-rose-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  ACCEPTE: [
    { label: 'Marquer signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  SIGNE: [],
  REFUSE: [
    { label: 'Passer en revise', value: 'REVISE', color: 'text-violet-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  ANNULE: [],
  REVISE: [
    { label: 'Renvoyer au client', value: 'RENVOYE', color: 'text-cyan-700' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
  RENVOYE: [
    { label: 'Marquer signe', value: 'SIGNE', color: 'text-emerald-700' },
    { label: 'Marquer accepte', value: 'ACCEPTE', color: 'text-emerald-600' },
    { label: 'Marquer refuse', value: 'REFUSE', color: 'text-rose-600' },
    { label: 'Annuler', value: 'ANNULE', color: 'text-amber-600' },
  ],
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

export default function DevisPage() {
  const { user } = useAuth();
  const isAssistante = user?.role === 'ASSISTANTE';
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<DevisForm>(emptyForm);
  const [previewDevisId, setPreviewDevisId] = useState<number | null>(null);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [activeDocumentPreview, setActiveDocumentPreview] =
    useState<ActiveGeneratedDocument>(null);
  const [sendingDevisId, setSendingDevisId] = useState<number | null>(null);
  const [updatingDevisId, setUpdatingDevisId] = useState<number | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['devis', page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      const response = await api.get('/devis', { params });
      return response.data;
    },
  });

  const { data: previewDevis, isLoading: loadingPreview } = useQuery({
    queryKey: ['devis-detail', previewDevisId],
    enabled: previewDevisId !== null,
    queryFn: async () => {
      const response = await api.get(`/devis/${previewDevisId}`);
      return response.data as Devis;
    },
  });

  const { data: clientsList } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const response = await api.get('/clients', { params: { limit: 100 } });
      return (response.data?.data ?? []) as Client[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/devis', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowModal(false);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/devis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setFeedback({ type: 'success', text: 'Devis supprimé avec succès.' });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Erreur lors de la suppression du devis.";
      setFeedback({ type: 'error', text: msg });
    }
  });

  const sendClientMutation = useMutation({
    mutationFn: (id: number) => api.post(`/devis/${id}/send-client`),
    onMutate: (id) => {
      setSendingDevisId(id);
      setFeedback(null);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
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
    mutationFn: (id: number) => api.post(`/devis/${id}/bon-commande/validate-send`),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: async (response, devisId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['devis'] }),
        queryClient.invalidateQueries({ queryKey: ['devis-detail', devisId] }),
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

  const updateStatutMutation = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: DevisStatut }) =>
      api.patch(`/devis/${id}/statut`, { statut }),
    onMutate: ({ id }) => {
      setUpdatingDevisId(id);
      setFeedback(null);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setActionMenuId(null);
      setFeedback({
        type: 'success',
        text: response.data?.message ?? 'Statut du devis mis a jour avec succes.',
      });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Erreur lors de la mise a jour du statut du devis.'),
      });
    },
    onSettled: () => {
      setUpdatingDevisId(null);
    },
  });

  const createFactureFromDevisMutation = useMutation({
    mutationFn: (devisId: number) => api.post(`/factures/from-devis/${devisId}`, {}),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: (response) => {
      setFeedback({
        type: 'success',
        text: 'Facture creee depuis le devis.',
      });
      navigate(`/admin/factures/${response.data.id}`);
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

  function handleSubmit(event: React.FormEvent) {
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

  function handleStatutAction(devisId: number, statut: DevisStatut) {
    updateStatutMutation.mutate({ id: devisId, statut });
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
      queryClient.invalidateQueries({ queryKey: ['devis'] }),
      queryClient.invalidateQueries({ queryKey: ['devis-detail', previewDevisId] }),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileSpreadsheet size={24} className="text-primary-600" />
            Gestion des devis
          </h1>
          <p className="mt-1 text-sm text-slate-500">{meta.total} devis enregistres</p>
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
                  <CheckCircle size={28} />
                ) : (
                  <AlertCircle size={28} />
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

      <div className="max-w-md">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            placeholder="Rechercher un devis..."
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-primary-600" size={32} />
          </div>
        ) : devisList.length === 0 ? (
          <div className="py-24 text-center text-slate-500">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
              <FileSpreadsheet size={32} className="text-slate-300" />
            </div>
            <p className="text-lg font-semibold text-slate-700">Aucun devis trouve</p>
            <p className="mt-1 text-sm text-slate-400">Creez votre premier devis pour commencer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Reference</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Client</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Statut</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">HT</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">TTC</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {devisList.map((devis) => {
                  const status = statutConfig[devis.statut] ?? statutConfig.BROUILLON;
                  const actions = statutActions[devis.statut] ?? [];
                  const clientName = devis.client
                    ? `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim()
                    : 'Client non renseigne';

                  return (
                    <tr key={devis.id} className="group transition hover:bg-primary-50/30">
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-900">{devis.reference}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{clientName}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold', status.bg, status.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(devis.totalHT ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatCurrency(devis.totalTTC ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(devis.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canSendToClient(devis.statut) && !isAssistante && (
                            <button
                              onClick={() => sendClientMutation.mutate(devis.id)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                              title={devis.statut === 'ENVOYE' || devis.statut === 'RENVOYE' ? 'Renvoyer au client' : 'Envoyer au client'}
                            >
                              {sendingDevisId === devis.id && sendClientMutation.isPending ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Send size={15} />
                              )}
                            </button>
                          )}

                          {actions.length > 0 && !isAssistante && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (actionMenuId === devis.id) {
                                    setActionMenuId(null);
                                    setMenuPosition(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenuPosition({
                                      top: rect.bottom + window.scrollY,
                                      left: rect.right - 192 + window.scrollX,
                                    });
                                    setActionMenuId(devis.id);
                                    setUpdatingDevisId(devis.id);
                                  }
                                }}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
                                title="Changer statut"
                              >
                                {updatingDevisId === devis.id && updateStatutMutation.isPending ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <MoreVertical size={15} />
                                )}
                              </button>

                              {actionMenuId === devis.id && menuPosition && createPortal(
                                <>
                                  <div className="fixed inset-0 z-[99998]" onClick={() => { setActionMenuId(null); setMenuPosition(null); }} />
                                  <div 
                                    style={{ position: 'absolute', top: menuPosition.top, left: menuPosition.left }}
                                    className="z-[99999] w-48 rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
                                  >
                                    {actions.map((action) => (
                                      <MenuAction
                                        key={action.value}
                                        label={action.label}
                                        color={action.color}
                                        disabled={updateStatutMutation.isPending}
                                        onClick={() => {
                                          handleStatutAction(devis.id, action.value);
                                          setActionMenuId(null);
                                          setMenuPosition(null);
                                        }}
                                      />
                                    ))}
                                  </div>
                                </>,
                                document.body
                              )}
                            </div>
                          )}

                          {['BROUILLON', 'REVISE'].includes(devis.statut) && !isAssistante && (
                             <button
                               onClick={() => {
                                 setPreviewDevisId(devis.id);
                                 setShowManualEditor(true);
                               }}
                               className="rounded-lg p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                               title="Modifier"
                             >
                               <Pencil size={15} />
                             </button>
                           )}

                           <button
                             onClick={() => {
                               setPreviewDevisId(devis.id);
                               setShowManualEditor(false);
                             }}
                             className="rounded-lg p-2 text-slate-400 transition hover:bg-primary-50 hover:text-primary-600"
                             title="Apercu"
                           >
                             <Eye size={15} />
                           </button>

                          {(() => {
                            const canInvoice = isAdmin && ['ACCEPTE', 'SIGNE'].includes(devis.statut);
                            return (
                              <button
                                onClick={() => createFactureFromDevisMutation.mutate(devis.id)}
                                disabled={createFactureFromDevisMutation.isPending || !canInvoice}
                                className={cn(
                                  "rounded-lg p-2 transition",
                                  canInvoice
                                    ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                    : "text-slate-200 cursor-not-allowed opacity-40"
                                )}
                                title={
                                  !isAdmin 
                                    ? "Non autorisé (réservé à l'Admin)" 
                                    : !canInvoice 
                                      ? "Facturation impossible (Le devis doit être accepté ou signé)" 
                                      : "Transformer en facture"
                                }
                              >
                                {createFactureFromDevisMutation.isPending ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Receipt size={15} />
                                )}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => {
                              setFeedback(null);
                              if (window.confirm("Êtes-vous sûr de vouloir supprimer ce devis ?")) {
                                deleteMutation.mutate(devis.id);
                              }
                            }}
                            disabled={!isAdmin}
                            className={cn(
                              "rounded-lg p-2 transition",
                              isAdmin
                                ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                : "text-slate-200 cursor-not-allowed opacity-40"
                            )}
                            title={isAdmin ? "Supprimer" : "Non autorisé (réservé à l'Admin)"}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <p className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-700">{meta.page}</span> sur{' '}
              <span className="font-semibold text-slate-700">{meta.totalPages}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                disabled={page === meta.totalPages}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-white disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Nouveau devis</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Client *</label>
                <select
                  required
                  value={form.clientId}
                  onChange={(event) => setForm({ ...form, clientId: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
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
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">TVA (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.tauxTVA}
                  onChange={(event) => setForm({ ...form, tauxTVA: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea
                  value={form.notes}
                  rows={4}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-2.5 text-sm transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              {createMutation.error && (
                <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  Erreur lors de la creation du devis.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
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
            <Loader2 size={18} className="animate-spin text-primary-600" />
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
          onManualEdit={isAssistante ? undefined : () => setShowManualEditor(true)}
          onOpenFacture={handleOpenFacture}
          onOpenBonCommande={handleOpenBonCommande}
          onOpenCommandeFournisseur={handleOpenCommandeFournisseur}
          onValidateBonCommandeAndSend={
            !isAssistante &&
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
  disabled,
}: {
  label: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-2 text-left text-sm font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
        color,
      )}
    >
      {label}
    </button>
  );
}
