import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Truck,
  Warehouse,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CommandeFournisseurDocument } from '@/components/documents/CommandeFournisseurDocument';
import {
  buildSupplierPurchaseDocumentDataFromOrderDetail,
  type SupplierPurchaseDocumentData,
} from '@/lib/documentBuilders';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { CommandeFournisseur, FournisseurCommandeDetail, PaginatedResponse } from '@/types';

type SupplierOrderStatus = CommandeFournisseur['statutLivraison'];
type StatusFilter = SupplierOrderStatus | 'ALL';

interface ReceptionFormState {
  quantiteRecue: string;
  dateReception: string;
  notes: string;
}

interface OrderLineDraft {
  materiauNom: string;
  quantite: string;
  unite: string;
  prixUnitaire: string;
}

interface OrderEditFormState {
  dateLivraisonPrevue: string;
  notes: string;
  lignes: OrderLineDraft[];
}

const statusOptions: StatusFilter[] = ['ALL', 'CREEE', 'ENVOYEE', 'EXPEDIEE', 'PARTIELLE', 'RECUE', 'CLOTUREE'];
const unitOptions = ['M2', 'ML', 'PIECE', 'JOUR', 'HEURE', 'LITRE', 'KG', 'FORFAIT'] as const;
const emptyReceptionForm = (): ReceptionFormState => ({
  quantiteRecue: '',
  dateReception: new Date().toISOString().slice(0, 10),
  notes: '',
});

const buildOrderEditForm = (order: FournisseurCommandeDetail): OrderEditFormState => ({
  dateLivraisonPrevue: order.dateLivraisonPrevue ? new Date(order.dateLivraisonPrevue).toISOString().slice(0, 10) : '',
  notes: order.notes ?? '',
  lignes: (order.lignes ?? []).map((line) => ({
    materiauNom: line.materiauNom,
    quantite: String(line.quantite),
    unite: line.unite,
    prixUnitaire: String(line.prixUnitaire),
  })),
});

const statusMeta: Record<SupplierOrderStatus, { label: string; badge: string }> = {
  CREEE: { label: 'A confirmer', badge: 'bg-stone-200 text-stone-700' },
  ENVOYEE: { label: 'Confirmee', badge: 'bg-sky-100 text-sky-700' },
  EXPEDIEE: { label: 'En livraison', badge: 'bg-amber-100 text-amber-700' },
  PARTIELLE: { label: 'Partielle', badge: 'bg-orange-100 text-orange-700' },
  RECUE: { label: 'Recue', badge: 'bg-emerald-100 text-emerald-700' },
  CLOTUREE: { label: 'Cloturee', badge: 'bg-teal-100 text-teal-700' },
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default function CommandesFournisseurPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [draftForms, setDraftForms] = useState<Record<number, ReceptionFormState>>({});
  const [editDrafts, setEditDrafts] = useState<Record<number, OrderEditFormState>>({});
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [supplierDocumentPreview, setSupplierDocumentPreview] =
    useState<SupplierPurchaseDocumentData | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['internal-supplier-orders', search, statusFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page: 1, limit: 100 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.statutLivraison = statusFilter;
      const response = await api.get<PaginatedResponse<FournisseurCommandeDetail>>(
        '/commandes-fournisseur',
        { params },
      );
      return response.data;
    },
  });

  const orders = useMemo(() => ordersQuery.data?.data ?? [], [ordersQuery.data?.data]);

  const activeOrderId = useMemo(() => {
    if (!orders.length) return null;
    if (selectedOrderId && orders.some((order) => order.id === selectedOrderId)) {
      return selectedOrderId;
    }
    return orders[0].id;
  }, [orders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) ?? null,
    [activeOrderId, orders],
  );

  const groupedOrders = useMemo(() => {
    const groups = new Map<string, { key: string; chantierRef: string; chantierAdresse: string; orders: FournisseurCommandeDetail[] }>();
    for (const order of orders) {
      const chantierRef = order.devis.chantier?.reference ?? 'Sans chantier';
      const chantierAdresse = order.devis.chantier?.adresse ?? 'Adresse non renseignee';
      const key = `${chantierRef}-${chantierAdresse}`;
      if (!groups.has(key)) {
        groups.set(key, { key, chantierRef, chantierAdresse, orders: [] });
      }
      groups.get(key)?.orders.push(order);
    }
    return Array.from(groups.values());
  }, [orders]);

  const receptionForm = activeOrderId ? draftForms[activeOrderId] ?? emptyReceptionForm() : emptyReceptionForm();
  const editForm = activeOrderId
    ? editDrafts[activeOrderId] ?? (selectedOrder ? buildOrderEditForm(selectedOrder) : null)
    : null;
  const remainingQuantity = selectedOrder
    ? Math.max(0, round2(selectedOrder.metrics.totalQuantiteCommandee - selectedOrder.metrics.totalQuantiteRecue))
    : 0;
  const canEditSelectedOrder =
    selectedOrder?.statutLivraison === 'CREEE' && !selectedOrder.dateEnvoi;
  const canCurrentUserEditManually =
    user?.role === 'ADMIN' || user?.role === 'CHEF_CHANTIER';
  const canCurrentUserValidateDevis =
    user?.role === 'ADMIN' || user?.role === 'CHEF_CHANTIER';
  const canRegisterReception =
    user?.role === 'ADMIN' || user?.role === 'CHEF_CHANTIER';
  const canShowManualEditButton = Boolean(
    selectedOrder && canEditSelectedOrder && canCurrentUserEditManually,
  );
  const isSelectedOrderValidated =
    selectedOrder?.devis.bonCommandeStatut == null ||
    selectedOrder?.devis.bonCommandeStatut === 'VALIDE' ||
    selectedOrder?.devis.bonCommandeStatut === 'ENVOYE';
  const hasPendingOrdersForSelectedDevis = Boolean(
    selectedOrder &&
      orders.some(
        (order) =>
          order.devisId === selectedOrder.devisId &&
          order.statutLivraison === 'CREEE' &&
          !order.dateEnvoi,
      ),
  );
  const canValidateAndSendSelectedDevis =
    Boolean(selectedOrder) &&
    canCurrentUserValidateDevis &&
    hasPendingOrdersForSelectedDevis;

  useEffect(() => {
    if (!selectedOrder) return;
    setEditDrafts((current) => ({
      ...current,
      [selectedOrder.id]: current[selectedOrder.id] ?? buildOrderEditForm(selectedOrder),
    }));
  }, [selectedOrder]);

  const updateReceptionForm = (patch: Partial<ReceptionFormState>) => {
    if (!activeOrderId) return;
    setDraftForms((current) => ({
      ...current,
      [activeOrderId]: {
        ...(current[activeOrderId] ?? emptyReceptionForm()),
        ...patch,
      },
    }));
  };

  const updateEditForm = (patch: Partial<OrderEditFormState>) => {
    if (!activeOrderId || !editForm) return;
    setEditDrafts((current) => ({
      ...current,
      [activeOrderId]: {
        ...editForm,
        ...patch,
      },
    }));
  };

  const updateEditLine = (
    lineIndex: number,
    patch: Partial<OrderLineDraft>,
  ) => {
    if (!activeOrderId || !editForm) return;
    const nextLines = editForm.lignes.map((line, index) =>
      index === lineIndex ? { ...line, ...patch } : line,
    );
    updateEditForm({ lignes: nextLines });
  };

  const addEditLine = () => {
    if (!editForm) return;
    updateEditForm({
      lignes: [
        ...editForm.lignes,
        {
          materiauNom: '',
          quantite: '1',
          unite: 'PIECE',
          prixUnitaire: '0',
        },
      ],
    });
  };

  const removeEditLine = (lineIndex: number) => {
    if (!editForm || editForm.lignes.length <= 1) return;
    updateEditForm({
      lignes: editForm.lignes.filter((_, index) => index !== lineIndex),
    });
  };

  const createReceptionMutation = useMutation({
    mutationFn: async (payload: ReceptionFormState) => {
      if (!activeOrderId) throw new Error('Aucune commande selectionnee.');
      const quantiteRecue = Number(payload.quantiteRecue);
      if (!Number.isFinite(quantiteRecue) || quantiteRecue <= 0) {
        throw new Error('La quantite recue doit etre superieure a zero.');
      }

      const response = await api.post(`/commandes-fournisseur/${activeOrderId}/receptions`, {
        quantiteRecue,
        dateReception: payload.dateReception || undefined,
        notes: payload.notes,
      });

      return response.data as { message: string; order: FournisseurCommandeDetail };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['internal-supplier-orders'] });
      setDraftForms((current) => ({
        ...current,
        [result.order.id]: emptyReceptionForm(),
      }));
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (payload: OrderEditFormState) => {
      if (!activeOrderId) throw new Error('Aucune commande selectionnee.');

      const lignes = payload.lignes.map((line) => {
        const quantite = Number(line.quantite);
        const prixUnitaire = Number(line.prixUnitaire);

        if (!line.materiauNom.trim()) {
          throw new Error('Chaque ligne doit avoir un nom de materiau.');
        }

        if (!Number.isFinite(quantite) || quantite <= 0) {
          throw new Error('Chaque ligne doit avoir une quantite superieure a zero.');
        }

        if (!Number.isFinite(prixUnitaire) || prixUnitaire < 0) {
          throw new Error('Chaque ligne doit avoir un prix unitaire valide.');
        }

        return {
          materiauNom: line.materiauNom.trim(),
          quantite,
          unite: line.unite,
          prixUnitaire,
        };
      });

      const response = await api.patch(`/commandes-fournisseur/${activeOrderId}`, {
        dateLivraisonPrevue: payload.dateLivraisonPrevue || undefined,
        notes: payload.notes,
        lignes,
      });

      return response.data as { message: string; order: FournisseurCommandeDetail };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['internal-supplier-orders'] });
      setEditingOrderId(null);
      setEditDrafts((current) => ({
        ...current,
        [result.order.id]: buildOrderEditForm(result.order),
      }));
    },
  });

  const sendOrderMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrderId) throw new Error('Aucune commande selectionnee.');
      const response = await api.post(`/commandes-fournisseur/${activeOrderId}/send`);
      return response.data as { message: string; order: FournisseurCommandeDetail };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['internal-supplier-orders'] });
      setEditingOrderId(null);
      setEditDrafts((current) => ({
        ...current,
        [result.order.id]: buildOrderEditForm(result.order),
      }));
    },
  });

  const validateOrderBeforeSendMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrderId) throw new Error('Aucune commande selectionnee.');
      const response = await api.post(`/commandes-fournisseur/${activeOrderId}/validate`);
      return response.data as { message: string; order: FournisseurCommandeDetail };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['internal-supplier-orders'] });
      setEditDrafts((current) => ({
        ...current,
        [result.order.id]: buildOrderEditForm(result.order),
      }));
    },
  });

  const validateDevisAndSendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('Aucune commande selectionnee.');
      const response = await api.post(
        `/devis/${selectedOrder.devisId}/bon-commande/validate-send`,
      );
      return response.data as { message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-supplier-orders'] });
      setEditingOrderId(null);
    },
  });

  const kpis = useMemo(
    () => [
      { label: 'Commandes', value: ordersQuery.data?.meta.total ?? 0, icon: <ClipboardList size={18} /> },
      { label: 'En attente', value: orders.filter((order) => order.tracking.reception.state === 'EN_ATTENTE').length, icon: <Warehouse size={18} /> },
      { label: 'Partielles', value: orders.filter((order) => order.tracking.reception.state === 'PARTIELLE').length, icon: <Truck size={18} /> },
      { label: 'Completes', value: orders.filter((order) => order.tracking.reception.state === 'COMPLETE').length, icon: <PackageCheck size={18} /> },
    ],
    [orders, ordersQuery.data?.meta.total],
  );

  const queryError = ordersQuery.error;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_26%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_48%,#eff6ff_100%)] p-6 shadow-sm ring-1 ring-stone-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Reception chantier</p>
        <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bons d achat fournisseur et receptions materiaux</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Toutes les commandes fournisseur generees automatiquement depuis les devis valides apparaissent ici. L admin ou le chef de chantier peut ajuster, valider, puis envoyer automatiquement aux fournisseurs.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-[420px]">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-3xl bg-white/85 p-4 ring-1 ring-stone-200">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                  {kpi.icon}
                </div>
                <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                <p className="text-sm text-slate-500">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par chantier, devis, fournisseur ou client"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-12 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-all',
                  statusFilter === status ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-slate-600 hover:bg-stone-200',
                )}
              >
                {status === 'ALL' ? 'Tous' : statusMeta[status].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {queryError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
          {getApiErrorMessage(queryError, 'Impossible de charger les commandes fournisseur.')}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Par chantier</h2>
              <p className="text-sm text-slate-500">{ordersQuery.data?.meta.total ?? 0} bon(s) d achat</p>
            </div>
            {ordersQuery.isLoading ? <Loader2 size={18} className="animate-spin text-emerald-700" /> : null}
          </div>

          <div className="space-y-4">
            {ordersQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-3xl bg-stone-100" />
              ))
            ) : groupedOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-12 text-center text-sm text-slate-500">
                Aucune commande fournisseur a afficher.
              </div>
            ) : (
              groupedOrders.map((group) => (
                <div key={group.key} className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-slate-900">{group.chantierRef}</p>
                    <p className="text-sm text-slate-500">{group.chantierAdresse}</p>
                  </div>
                  <div className="space-y-3">
                    {group.orders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={cn(
                          'w-full rounded-3xl border p-4 text-left transition-all',
                          activeOrderId === order.id ? 'border-emerald-300 bg-emerald-50/60' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{order.reference}</p>
                              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', statusMeta[order.statutLivraison].badge)}>
                                {statusMeta[order.statutLivraison].label}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">Devis {order.devis.reference} - {order.fournisseur.nom}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-800">{formatCurrency(order.metrics.totalMontantHT)}</p>
                            <p className="text-xs text-slate-500">{order.tracking.reception.label}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200">
          {!selectedOrder ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-stone-300 bg-stone-50 text-center text-sm text-slate-500">
              Selectionnez un bon d achat pour saisir une reception.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedOrder.reference}</h2>
                    <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusMeta[selectedOrder.statutLivraison].badge)}>
                      {statusMeta[selectedOrder.statutLivraison].label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="rounded-full bg-stone-100 px-3 py-1.5">{selectedOrder.fournisseur.nom}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1.5">Devis {selectedOrder.devis.reference}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1.5">Client {selectedOrder.devis.client?.prenom} {selectedOrder.devis.client?.nom}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSupplierDocumentPreview(
                        buildSupplierPurchaseDocumentDataFromOrderDetail(selectedOrder),
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                  >
                    <FileText size={16} />
                    Apercu bon d achat / PDF
                  </button>
                  <div className="rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reste a receptionner</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{remainingQuantity}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedOrder.metrics.totalQuantiteRecue} / {selectedOrder.metrics.totalQuantiteCommandee} deja recus</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {canShowManualEditButton ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOrderId(selectedOrder.id);
                          setEditDrafts((current) => ({
                            ...current,
                            [selectedOrder.id]: buildOrderEditForm(selectedOrder),
                          }));
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                      >
                        <Pencil size={16} />
                        Modifier manuellement
                      </button>
                    ) : null}
                    {selectedOrder.statutLivraison === 'CREEE' ? (
                      <>
                        {canCurrentUserValidateDevis ? (
                          <button
                            type="button"
                            onClick={() => validateOrderBeforeSendMutation.mutate()}
                            disabled={
                              editingOrderId === selectedOrder.id ||
                              validateOrderBeforeSendMutation.isPending ||
                              isSelectedOrderValidated
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {validateOrderBeforeSendMutation.isPending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                            {isSelectedOrderValidated
                              ? 'Commande deja validee'
                              : 'Valider avant envoi'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => sendOrderMutation.mutate()}
                          disabled={
                            editingOrderId === selectedOrder.id ||
                            sendOrderMutation.isPending ||
                            !selectedOrder.fournisseur.email ||
                            !isSelectedOrderValidated
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendOrderMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          Envoyer cette commande
                        </button>
                        {canCurrentUserValidateDevis ? (
                          <button
                            type="button"
                            onClick={() => validateDevisAndSendMutation.mutate()}
                            disabled={
                              editingOrderId === selectedOrder.id ||
                              validateDevisAndSendMutation.isPending ||
                              !canValidateAndSendSelectedDevis
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {validateDevisAndSendMutation.isPending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                            Valider ce devis et envoyer tout
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Commande envoyee {selectedOrder.dateEnvoi ? `le ${formatDate(selectedOrder.dateEnvoi)}` : 'au fournisseur'}.
                      </div>
                    )}
                    {selectedOrder.statutLivraison === 'CREEE' && !selectedOrder.fournisseur.email ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Ajoutez un email au fournisseur avant l envoi.
                      </div>
                    ) : null}
                    {selectedOrder.statutLivraison === 'CREEE' && !isSelectedOrderValidated ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Validez d abord le bon de commande avant d envoyer au fournisseur.
                      </div>
                    ) : null}
                    {sendOrderMutation.error && editingOrderId !== selectedOrder.id ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {getApiErrorMessage(sendOrderMutation.error, 'Impossible d envoyer la commande fournisseur.')}
                      </div>
                    ) : null}
                    {validateOrderBeforeSendMutation.error ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {getApiErrorMessage(validateOrderBeforeSendMutation.error, 'Impossible de valider la commande avant envoi.')}
                      </div>
                    ) : null}
                    {validateDevisAndSendMutation.error ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {getApiErrorMessage(validateDevisAndSendMutation.error, 'Impossible de valider le devis et envoyer automatiquement les fournisseurs.')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-slate-900">Lignes materiaux</h3>
                      {editingOrderId === selectedOrder.id ? (
                        <button
                          type="button"
                          onClick={addEditLine}
                          className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                        >
                          <Plus size={15} />
                          Ajouter ligne
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-3">
                      {editingOrderId === selectedOrder.id && editForm ? (
                        editForm.lignes.map((line, index) => {
                          const lineTotal =
                            (Number(line.quantite) || 0) * (Number(line.prixUnitaire) || 0);
                          return (
                            <div key={`${selectedOrder.id}-${index}`} className="rounded-3xl bg-white p-4 ring-1 ring-stone-200">
                              <div className="grid gap-3 lg:grid-cols-[1.5fr_0.75fr_0.75fr_0.8fr_auto]">
                                <input
                                  type="text"
                                  value={line.materiauNom}
                                  onChange={(event) => updateEditLine(index, { materiauNom: event.target.value })}
                                  placeholder="Nom du materiau"
                                  className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.quantite}
                                  onChange={(event) => updateEditLine(index, { quantite: event.target.value })}
                                  placeholder="Quantite"
                                  className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                                />
                                <select
                                  value={line.unite}
                                  onChange={(event) => updateEditLine(index, { unite: event.target.value })}
                                  className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                                >
                                  {unitOptions.map((unit) => (
                                    <option key={unit} value={unit}>
                                      {unit}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.prixUnitaire}
                                  onChange={(event) => updateEditLine(index, { prixUnitaire: event.target.value })}
                                  placeholder="Prix U."
                                  className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEditLine(index)}
                                  disabled={editForm.lignes.length <= 1}
                                  className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-3 py-3 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <p className="text-sm font-semibold text-slate-700">
                                  Total ligne: {formatCurrency(lineTotal)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        selectedOrder.lignes?.map((line) => (
                          <div key={line.id} className="rounded-3xl bg-white p-4 ring-1 ring-stone-200">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{line.materiauNom}</p>
                                <p className="mt-1 text-sm text-slate-500">Quantite: {line.quantite} {line.unite}</p>
                              </div>
                              <p className="font-semibold text-slate-900">{formatCurrency(line.totalHT)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {editingOrderId === selectedOrder.id && editForm ? (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <label className="space-y-1.5 text-sm text-slate-600">
                            <span className="font-medium text-slate-700">Date livraison prevue</span>
                            <input
                              type="date"
                              value={editForm.dateLivraisonPrevue}
                              onChange={(event) => updateEditForm({ dateLivraisonPrevue: event.target.value })}
                              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                            />
                          </label>
                          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total HT</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">
                              {formatCurrency(
                                editForm.lignes.reduce(
                                  (sum, line) =>
                                    sum +
                                    (Number(line.quantite) || 0) *
                                      (Number(line.prixUnitaire) || 0),
                                  0,
                                ),
                              )}
                            </p>
                          </div>
                        </div>
                        <label className="space-y-1.5 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Notes internes</span>
                          <textarea
                            value={editForm.notes}
                            onChange={(event) => updateEditForm({ notes: event.target.value })}
                            rows={4}
                            placeholder="Informations internes avant envoi fournisseur"
                            className="w-full resize-none rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </label>
                        {updateOrderMutation.error ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {getApiErrorMessage(updateOrderMutation.error, 'Impossible de mettre a jour la commande fournisseur.')}
                          </div>
                        ) : null}
                        {sendOrderMutation.error ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {getApiErrorMessage(sendOrderMutation.error, 'Impossible d envoyer la commande fournisseur.')}
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrderId(null);
                              setEditDrafts((current) => ({
                                ...current,
                                [selectedOrder.id]: buildOrderEditForm(selectedOrder),
                              }));
                            }}
                            className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOrderMutation.mutate(editForm)}
                            disabled={updateOrderMutation.isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updateOrderMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Enregistrer les modifications
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-white p-4">
                    <h3 className="font-bold text-slate-900">Historique reception</h3>
                    <div className="mt-4 space-y-3">
                      {selectedOrder.receptions.length === 0 ? (
                        <div className="rounded-2xl bg-stone-50 px-4 py-6 text-sm text-slate-500">Aucune reception saisie.</div>
                      ) : (
                        selectedOrder.receptions.map((reception) => (
                          <div key={reception.id} className="rounded-2xl bg-stone-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-800">{formatDate(reception.dateReception)}</p>
                              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', reception.partielle ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700')}>
                                {reception.partielle ? 'Reception partielle' : 'Reception complete'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">Recu: {reception.quantiteRecue} / Attendu: {reception.quantiteAttendue}</p>
                            {reception.notes ? <p className="mt-2 text-sm text-slate-500">{reception.notes}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-stone-200 bg-white p-4">
                    <h3 className="font-bold text-slate-900">Coordonnees chantier</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <div className="rounded-2xl bg-stone-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Chantier</p>
                        <p className="mt-1 font-medium text-slate-800">{selectedOrder.devis.chantier?.reference ?? 'Sans chantier'}</p>
                        <p className="mt-1">{selectedOrder.devis.chantier?.adresse ?? 'Adresse non renseignee'}</p>
                      </div>
                      <div className="rounded-2xl bg-stone-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Date livraison prevue</p>
                        <p className="mt-1 font-medium text-slate-800">{selectedOrder.dateLivraisonPrevue ? formatDate(selectedOrder.dateLivraisonPrevue) : 'A communiquer'}</p>
                      </div>
                    </div>
                  </div>

                  {canRegisterReception ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        createReceptionMutation.mutate(receptionForm);
                      }}
                      className="rounded-[28px] border border-stone-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-5"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={16} />
                        Saisie reception chantier
                      </div>

                      <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Quantite restante conseillee: <strong>{remainingQuantity}</strong>
                      </div>

                      <div className="mt-4 grid gap-4">
                        <label className="space-y-1.5 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Quantite recue</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={receptionForm.quantiteRecue}
                            onChange={(event) => updateReceptionForm({ quantiteRecue: event.target.value })}
                            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </label>

                        <label className="space-y-1.5 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Date de reception</span>
                          <div className="relative">
                            <CalendarClock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="date"
                              value={receptionForm.dateReception}
                              onChange={(event) => updateReceptionForm({ dateReception: event.target.value })}
                              className="w-full rounded-2xl border border-stone-200 bg-white px-11 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                            />
                          </div>
                        </label>

                        <label className="space-y-1.5 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Note / anomalie</span>
                          <textarea
                            value={receptionForm.notes}
                            onChange={(event) => updateReceptionForm({ notes: event.target.value })}
                            placeholder="Reserve, colis manque, materiau abime..."
                            rows={3}
                            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 resize-none text-sm placeholder:text-slate-400"
                          />
                        </label>
                      </div>

                      {createReceptionMutation.error ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {getApiErrorMessage(createReceptionMutation.error, 'Impossible d enregistrer la reception.')}
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => updateReceptionForm({ quantiteRecue: String(remainingQuantity) })}
                          disabled={remainingQuantity <= 0}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Warehouse size={16} />
                          Recevoir le restant
                        </button>
                        <button
                          type="submit"
                          disabled={createReceptionMutation.isPending || remainingQuantity <= 0}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {createReceptionMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                          {Number(receptionForm.quantiteRecue || 0) >= remainingQuantity && remainingQuantity > 0 ? 'Reception complete' : 'Enregistrer reception'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-[28px] border border-stone-100 bg-stone-50 p-6 text-center text-sm text-stone-500">
                      <Warehouse size={32} className="mx-auto mb-2 text-stone-400" />
                      Seul le Chef de Chantier ou l'Administrateur peut saisir des réceptions matériaux sur le chantier.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {supplierDocumentPreview && (
        <CommandeFournisseurDocument
          document={supplierDocumentPreview}
          onClose={() => setSupplierDocumentPreview(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  );
}
