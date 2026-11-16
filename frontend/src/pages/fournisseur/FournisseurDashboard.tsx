import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  Search,
  Send,
  Truck,
  Warehouse,
} from 'lucide-react';
import api from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  CommandeFournisseur,
  FournisseurCommandeDetail,
  PaginatedResponse,
  PortailFournisseurDashboard,
} from '@/types';

type SupplierOrderStatus = CommandeFournisseur['statutLivraison'];
type StatusFilter = SupplierOrderStatus | 'ALL';

interface StatusFormState {
  statutLivraison: SupplierOrderStatus;
  dateLivraisonPrevue: string;
  notes: string;
}

const emptyStatusForm: StatusFormState = {
  statutLivraison: 'ENVOYEE',
  dateLivraisonPrevue: '',
  notes: '',
};

const statusOptions: StatusFilter[] = [
  'ALL',
  'CREEE',
  'ENVOYEE',
  'EXPEDIEE',
  'PARTIELLE',
  'RECUE',
  'CLOTUREE',
];

const statusMeta: Record<
  SupplierOrderStatus,
  { label: string; badge: string; quickLabel: string }
> = {
  CREEE: { label: 'À confirmer', quickLabel: 'Confirmer', badge: 'bg-slate-200 text-slate-700' },
  ENVOYEE: { label: 'Confirmée', quickLabel: 'Prête', badge: 'bg-sky-100 text-sky-700' },
  EXPEDIEE: { label: 'En livraison', quickLabel: 'Expédier', badge: 'bg-amber-100 text-amber-700' },
  PARTIELLE: { label: 'Partielle', quickLabel: 'Partielle', badge: 'bg-orange-100 text-orange-700' },
  RECUE: { label: 'Reçue', quickLabel: 'Reçue', badge: 'bg-emerald-100 text-emerald-700' },
  CLOTUREE: { label: 'Clôturée', quickLabel: 'Clôturer', badge: 'bg-teal-100 text-blue-600' },
};

const trackingTone: Record<string, string> = {
  A_CONFIRMER: 'border-slate-200 bg-white text-slate-700',
  CONFIRMEE: 'border-sky-200 bg-sky-50 text-sky-700',
  COMPLETE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PARTIELLE: 'border-orange-200 bg-orange-50 text-orange-700',
  PLANIFIEE: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  EN_COURS: 'border-amber-200 bg-amber-50 text-amber-700',
  TERMINEE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  NON_PLANIFIEE: 'border-slate-200 bg-white text-slate-700',
  EN_ATTENTE: 'border-slate-200 bg-white text-slate-700',
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

function toDateInputValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default function FournisseurDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [draftForms, setDraftForms] = useState<Record<number, StatusFormState>>({});

  const dashboardQuery = useQuery({
    queryKey: ['supplier-dashboard'],
    queryFn: async () => {
      const response = await api.get<PortailFournisseurDashboard>('/portail-fournisseur/dashboard');
      return response.data;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['supplier-orders', search, statusFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page: 1, limit: 50 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.statutLivraison = statusFilter;
      const response = await api.get<PaginatedResponse<FournisseurCommandeDetail>>(
        '/portail-fournisseur/orders',
        { params },
      );
      return response.data;
    },
  });

  const orders = useMemo(
    () => ordersQuery.data?.data ?? [],
    [ordersQuery.data?.data],
  );

  const activeOrderId = useMemo(() => {
    if (!orders.length) return null;
    if (selectedOrderId && orders.some((order) => order.id === selectedOrderId)) {
      return selectedOrderId;
    }
    return orders[0].id;
  }, [orders, selectedOrderId]);

  const selectedFromList = useMemo(
    () => orders.find((order) => order.id === activeOrderId) ?? null,
    [activeOrderId, orders],
  );

  const detailQuery = useQuery({
    queryKey: ['supplier-order-detail', activeOrderId],
    enabled: activeOrderId !== null,
    queryFn: async () => {
      const response = await api.get<FournisseurCommandeDetail>(
        `/portail-fournisseur/orders/${activeOrderId}`,
      );
      return response.data;
    },
  });

  const selectedOrder = detailQuery.data ?? selectedFromList;
  const fallbackStatusForm = selectedOrder
    ? {
        statutLivraison: selectedOrder.statutLivraison,
        dateLivraisonPrevue: toDateInputValue(selectedOrder.dateLivraisonPrevue),
        notes: selectedOrder.notes ?? '',
      }
    : emptyStatusForm;
  const statusForm = activeOrderId
    ? draftForms[activeOrderId] ?? fallbackStatusForm
    : emptyStatusForm;

  const updateStatusForm = (patch: Partial<StatusFormState>) => {
    if (!activeOrderId) return;
    setDraftForms((current) => ({
      ...current,
      [activeOrderId]: {
        ...(current[activeOrderId] ?? fallbackStatusForm),
        ...patch,
      },
    }));
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: StatusFormState) => {
      if (!activeOrderId) throw new Error('Aucune commande sélectionnée.');
      const response = await api.patch<FournisseurCommandeDetail>(
        `/portail-fournisseur/orders/${activeOrderId}/status`,
        {
          statutLivraison: payload.statutLivraison,
          dateLivraisonPrevue: payload.dateLivraisonPrevue || undefined,
          notes: payload.notes,
        },
      );
      return response.data;
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(['supplier-order-detail', updatedOrder.id], updatedOrder);
      queryClient.invalidateQueries({ queryKey: ['supplier-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      setDraftForms((current) => ({
        ...current,
        [updatedOrder.id]: {
          statutLivraison: updatedOrder.statutLivraison,
          dateLivraisonPrevue: toDateInputValue(updatedOrder.dateLivraisonPrevue),
          notes: updatedOrder.notes ?? '',
        },
      }));
    },
  });

  const dataError = dashboardQuery.error || ordersQuery.error || detailQuery.error;

  const kpis = dashboardQuery.data
    ? [
        { label: 'Commandes', value: dashboardQuery.data.summary.totalCommandes, icon: <ClipboardList size={18} /> },
        { label: 'À confirmer', value: dashboardQuery.data.summary.aConfirmer, icon: <Warehouse size={18} /> },
        { label: 'En livraison', value: dashboardQuery.data.summary.enCoursLivraison, icon: <Truck size={18} /> },
        { label: 'Reçues', value: dashboardQuery.data.summary.receptionsCompletes, icon: <PackageCheck size={18} /> },
      ]
    : [];

  const submitStatus = (event: React.FormEvent) => {
    event.preventDefault();
    updateStatusMutation.mutate(statusForm);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#eef5ff_100%)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Espace sous-traitant</p>
        <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Suivi des commandes, livraisons et réceptions</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Consultez vos commandes, leur détail, les livraisons prévues et l’avancement des réceptions dans un espace unifié.
            </p>
            {dashboardQuery.data ? (
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-slate-200">
                  Fournisseur: <strong>{dashboardQuery.data.fournisseur.nom}</strong>
                </span>
                {dashboardQuery.data.fournisseur.typesMateriaux ? (
                  <span className="rounded-full bg-white/90 px-4 py-2 ring-1 ring-slate-200">
                    Types: {dashboardQuery.data.fournisseur.typesMateriaux}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-[420px]">
            {dashboardQuery.isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/70 ring-1 ring-slate-200" />
                ))
              : kpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
                      {kpi.icon}
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                    <p className="text-sm text-slate-500">{kpi.label}</p>
                  </div>
                ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par référence, devis, client ou chantier"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-all',
                  statusFilter === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {status === 'ALL' ? 'Tous' : statusMeta[status].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {dataError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="text-lg font-semibold">Le portail ne peut pas charger les commandes.</p>
          <p className="mt-2 text-sm">
            {getApiErrorMessage(
              dataError,
              'Verifiez que le compte SOUS_TRAITANT utilise le meme email que la fiche fournisseur.',
            )}
          </p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Commandes</h2>
              <p className="text-sm text-slate-500">{ordersQuery.data?.meta.total ?? 0} commande(s)</p>
            </div>
            {ordersQuery.isLoading ? <Loader2 size={18} className="animate-spin text-blue-600" /> : null}
          </div>

          <div className="space-y-3">
            {ordersQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              ))
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                Aucune commande dans ce filtre.
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    selectedOrderId === order.id
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
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
                      <p className="mt-1 text-sm text-slate-500">Devis {order.devis.reference}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(order.metrics.totalMontantHT)}</p>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-slate-200">
                      Client: {order.devis.client?.prenom} {order.devis.client?.nom}
                    </div>
                    <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-slate-200">
                      Reception: {order.tracking.reception.label}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {!selectedOrder ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
              Sélectionnez une commande pour voir son detail.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedOrder.reference}</h2>
                    <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusMeta[selectedOrder.statutLivraison].badge)}>
                      {statusMeta[selectedOrder.statutLivraison].label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5">Devis {selectedOrder.devis.reference}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5">Creee le {formatDate(selectedOrder.date)}</span>
                    {selectedOrder.devis.chantier?.reference ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5">Chantier {selectedOrder.devis.chantier.reference}</span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Montant</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(selectedOrder.metrics.totalMontantHT)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedOrder.metrics.totalQuantiteRecue} / {selectedOrder.metrics.totalQuantiteCommandee} unités reçues
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {[
                  { title: 'Disponibilite', value: selectedOrder.tracking.disponibilite.label, detail: selectedOrder.tracking.disponibilite.detail, icon: <Warehouse size={18} />, tone: trackingTone[selectedOrder.tracking.disponibilite.state] },
                  { title: 'Livraison', value: selectedOrder.tracking.livraison.label, detail: selectedOrder.tracking.livraison.detail, icon: <Truck size={18} />, tone: trackingTone[selectedOrder.tracking.livraison.state] },
                  { title: 'Reception', value: selectedOrder.tracking.reception.label, detail: selectedOrder.tracking.reception.detail, icon: <PackageCheck size={18} />, tone: trackingTone[selectedOrder.tracking.reception.state] },
                ].map((card) => (
                  <div key={card.title} className={cn('rounded-2xl border p-4', card.tone)}>
                    <div className="flex items-center gap-2 text-sm font-semibold">{card.icon}{card.title}</div>
                    <p className="mt-3 text-lg font-bold">{card.value}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{card.detail}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Lignes materiaux</h3>
                      <p className="text-sm text-slate-500">Articles a fournir</p>
                    </div>
                    {detailQuery.isLoading ? <Loader2 size={18} className="animate-spin text-blue-600" /> : null}
                  </div>
                  <div className="space-y-3">
                    {selectedOrder.lignes?.map((line) => (
                      <div key={line.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{line.materiauNom}</p>
                            <p className="mt-1 text-sm text-slate-500">Quantite: {line.quantite} {line.unite}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-900">{formatCurrency(line.totalHT)}</p>
                            <p className="text-xs text-slate-500">{formatCurrency(line.prixUnitaire)} / unite</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-bold text-slate-900">Chantier et client</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Client</p>
                        <p className="mt-1 font-medium text-slate-800">{selectedOrder.devis.client?.prenom} {selectedOrder.devis.client?.nom}</p>
                        {selectedOrder.devis.client?.email ? <p className="mt-1">{selectedOrder.devis.client.email}</p> : null}
                        {selectedOrder.devis.client?.telephone ? <p>{selectedOrder.devis.client.telephone}</p> : null}
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Adresse chantier</p>
                        <p className="mt-1 font-medium text-slate-800">{selectedOrder.devis.chantier?.adresse ?? 'Adresse non renseignee'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Date prevue</p>
                        <p className="mt-1 font-medium text-slate-800">{selectedOrder.dateLivraisonPrevue ? formatDate(selectedOrder.dateLivraisonPrevue) : 'A communiquer'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">Historique reception</h3>
                        <p className="text-sm text-slate-500">Suivi chantier</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {selectedOrder.receptions.length} entree(s)
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedOrder.receptions.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          Aucune reception enregistree pour le moment.
                        </div>
                      ) : (
                        selectedOrder.receptions.map((reception) => (
                          <div key={reception.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-800">{formatDate(reception.dateReception)}</p>
                              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', reception.partielle ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700')}>
                                {reception.partielle ? 'Reception partielle' : 'Reception complete'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              Reçu : {reception.quantiteRecue} / Attendu: {reception.quantiteAttendue}
                            </p>
                            {reception.notes ? <p className="mt-2 text-sm text-slate-500">{reception.notes}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={submitStatus} className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-5">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Mettre a jour le suivi</h3>
                    <p className="text-sm text-slate-500">Le fournisseur confirme la disponibilite et fait avancer la commande.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['ENVOYEE', 'EXPEDIEE', 'PARTIELLE', 'RECUE', 'CLOTUREE'] as SupplierOrderStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateStatusForm({ statutLivraison: status })}
                        className={cn(
                          'rounded-full px-3 py-2 text-xs font-semibold transition-colors',
                          statusForm.statutLivraison === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                        )}
                      >
                        {statusMeta[status].quickLabel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_0.8fr_1.3fr]">
                  <label className="space-y-1.5 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Statut</span>
                    <select
                      value={statusForm.statutLivraison}
                      onChange={(event) =>
                        updateStatusForm({
                          statutLivraison: event.target.value as SupplierOrderStatus,
                        })
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      {statusOptions.filter((status): status is SupplierOrderStatus => status !== 'ALL').map((status) => (
                        <option key={status} value={status}>{statusMeta[status].label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Date previsionnelle</span>
                    <div className="relative">
                      <CalendarClock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={statusForm.dateLivraisonPrevue}
                        onChange={(event) =>
                          updateStatusForm({ dateLivraisonPrevue: event.target.value })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </label>

                  <label className="space-y-1.5 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Notes fournisseur</span>
                    <textarea
                      value={statusForm.notes}
                      onChange={(event) =>
                        updateStatusForm({ notes: event.target.value })
                      }
                      rows={4}
                      placeholder="Exemple: materiaux disponibles, expedition prevue mardi matin."
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </label>
                </div>

                {updateStatusMutation.error ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {getApiErrorMessage(updateStatusMutation.error, 'Impossible de mettre a jour le statut.')}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Derniere mise a jour:
                    <span className="ml-1 font-medium text-slate-700">
                      {selectedOrder.updatedAt ? formatDate(selectedOrder.updatedAt) : formatDate(selectedOrder.date)}
                    </span>
                  </p>
                  <button
                    type="submit"
                    disabled={updateStatusMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updateStatusMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                    Enregistrer le suivi
                  </button>
                </div>
              </form>

              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Rappel de liaison
                </div>
                <p className="mt-2 leading-6">
                  Ce portail lie le compte connecte au fournisseur par l email. Creez donc un utilisateur <strong>SOUS_TRAITANT</strong> avec le meme email que la fiche fournisseur.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
