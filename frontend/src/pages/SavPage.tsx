import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { Client, DevisCreateur, Role, User } from '@/types';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  LifeBuoy,
  Loader2,
  Moon,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';

type SavTicketStatut = 'OUVERT' | 'EN_COURS' | 'EN_ATTENTE_CLIENT' | 'RESOLU' | 'CLOTURE';
type SavTicketPriorite = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';
type SavTicketCategorie =
  | 'DEFAUT_TRAVAUX'
  | 'RETARD'
  | 'FACTURATION'
  | 'QUALITE'
  | 'SAV_TECHNIQUE'
  | 'AUTRE';

type RelatedType = 'devis' | 'facture' | 'chantier';

interface LightUser {
  id: number;
  nom: string;
  prenom?: string;
  email?: string;
  role?: Role;
}

interface SavTicketNote {
  id: number;
  ticketId: number;
  contenu: string;
  createdAt: string;
  user?: LightUser;
}

interface SavTicket {
  id: number;
  reference: string;
  titre: string;
  description: string;
  statut: SavTicketStatut;
  priorite: SavTicketPriorite;
  categorie: SavTicketCategorie;
  clientId: number;
  devisId?: number;
  factureId?: number;
  chantierId?: number;
  createurId: number;
  assignedToId?: number;
  dateEcheance?: string;
  dateResolution?: string;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, 'id' | 'nom' | 'prenom' | 'email' | 'telephone'>;
  devis?: { id: number; reference: string; statut?: string; totalTTC?: number };
  facture?: { id: number; reference: string; statut?: string; montantTTC?: number };
  chantier?: { id: number; reference: string; adresse?: string; statut?: string };
  createur?: LightUser;
  assignedTo?: LightUser;
  notes?: SavTicketNote[];
  _count?: { notes?: number };
}

interface SavSummary {
  total: number;
  ouverts: number;
  enCours: number;
  urgents: number;
  resolus: number;
  enAttenteClient: number;
}

interface PaginatedResponse<T> {
  data: T[];
  summary?: SavSummary;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface DevisOption {
  id: number;
  reference: string;
  statut?: string;
  totalTTC?: number;
  client?: Pick<Client, 'id' | 'nom' | 'prenom'>;
  createur?: DevisCreateur;
}

interface FactureOption {
  id: number;
  reference: string;
  statut?: string;
  montantTTC?: number;
  devis?: DevisOption;
}

interface ChantierOption {
  id: number;
  reference: string;
  adresse?: string;
  statut?: string;
  client?: Pick<Client, 'id' | 'nom' | 'prenom'>;
}

interface TicketFormState {
  clientId: string;
  relatedType: RelatedType;
  relatedId: string;
  assignedToId: string;
  titre: string;
  description: string;
  statut: SavTicketStatut;
  priorite: SavTicketPriorite;
  categorie: SavTicketCategorie;
  dateEcheance: string;
}

const emptyForm: TicketFormState = {
  clientId: '',
  relatedType: 'chantier',
  relatedId: '',
  assignedToId: '',
  titre: '',
  description: '',
  statut: 'OUVERT',
  priorite: 'NORMALE',
  categorie: 'AUTRE',
  dateEcheance: '',
};

const statusOptions: { value: SavTicketStatut; label: string }[] = [
  { value: 'OUVERT', label: 'Ouvert' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_ATTENTE_CLIENT', label: 'En attente client' },
  { value: 'RESOLU', label: 'Résolu' },
  { value: 'CLOTURE', label: 'Clôturé' },
];

const priorityOptions: { value: SavTicketPriorite; label: string }[] = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
];

const categoryOptions: { value: SavTicketCategorie; label: string }[] = [
  { value: 'DEFAUT_TRAVAUX', label: 'Défaut travaux' },
  { value: 'RETARD', label: 'Retard' },
  { value: 'FACTURATION', label: 'Facturation' },
  { value: 'QUALITE', label: 'Qualité' },
  { value: 'SAV_TECHNIQUE', label: 'SAV technique' },
  { value: 'AUTRE', label: 'Autre' },
];

const statusConfig: Record<SavTicketStatut, { label: string; className: string }> = {
  OUVERT: { label: 'Ouvert', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  EN_COURS: { label: 'En cours', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  EN_ATTENTE_CLIENT: {
    label: 'En attente client',
    className: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  RESOLU: { label: 'Résolu', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  CLOTURE: { label: 'Clôturé', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const priorityConfig: Record<SavTicketPriorite, { label: string; className: string }> = {
  BASSE: { label: 'Basse', className: 'bg-slate-50 text-slate-600 ring-slate-200' },
  NORMALE: { label: 'Normale', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  HAUTE: { label: 'Haute', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  URGENTE: { label: 'Urgente', className: 'bg-red-50 text-red-700 ring-red-100' },
};

const categoryLabels: Record<SavTicketCategorie, string> = {
  DEFAUT_TRAVAUX: 'Défaut travaux',
  RETARD: 'Retard',
  FACTURATION: 'Facturation',
  QUALITE: 'Qualité',
  SAV_TECHNIQUE: 'SAV technique',
  AUTRE: 'Autre',
};

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  return 'Une erreur est survenue.';
}

function getPersonName(user?: LightUser | null) {
  if (!user) return 'Non assigné';
  return `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || user.email || `Utilisateur #${user.id}`;
}

function getClientName(client?: Pick<Client, 'id' | 'nom' | 'prenom'>) {
  if (!client) return 'Client non renseigné';
  return `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() || `Client #${client.id}`;
}

function formatRelativeDate(value?: string) {
  if (!value) return 'Non définie';
  return formatDate(value);
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1', className)}>
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#185FA5] dark:bg-blue-950/50 dark:text-blue-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none transition focus:ring-2 focus:ring-[#185FA5] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
        className,
      )}
    >
      {children}
    </select>
  );
}

export default function SavPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [priorite, setPriorite] = useState('');
  const [categorie, setCategorie] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<TicketFormState>(emptyForm);
  const [noteContent, setNoteContent] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : document.documentElement.classList.contains('dark');
  });
  const limit = 8;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const ticketsQuery = useQuery({
    queryKey: ['sav-tickets', page, search, statut, priorite, categorie],
    queryFn: async () => {
      const response = await api.get('/sav/tickets', {
        params: {
          page,
          limit,
          search: search || undefined,
          statut: statut || undefined,
          priorite: priorite || undefined,
          categorie: categorie || undefined,
        },
      });
      return response.data as PaginatedResponse<SavTicket>;
    },
  });

  const selectedTicketQuery = useQuery({
    queryKey: ['sav-ticket-detail', selectedTicketId],
    enabled: selectedTicketId !== null,
    queryFn: async () => {
      const response = await api.get(`/sav/tickets/${selectedTicketId}`);
      return response.data as SavTicket;
    },
  });

  const clientsQuery = useQuery({
    queryKey: ['sav-clients-options'],
    queryFn: async () => {
      const response = await api.get('/clients', { params: { limit: 100 } });
      return asArray<Client>(response.data);
    },
  });

  const usersQuery = useQuery({
    queryKey: ['sav-users-options'],
    queryFn: async () => {
      try {
        const response = await api.get('/users');
        return asArray<User>(response.data).filter((user) =>
          ['ADMIN', 'ASSISTANTE', 'TECHNICO', 'CHEF_CHANTIER'].includes(user.role),
        );
      } catch {
        return [] as User[];
      }
    },
  });

  const devisQuery = useQuery({
    queryKey: ['sav-devis-options'],
    queryFn: async () => {
      const response = await api.get('/devis', { params: { limit: 100 } });
      return asArray<DevisOption>(response.data);
    },
  });

  const facturesQuery = useQuery({
    queryKey: ['sav-factures-options'],
    queryFn: async () => {
      const response = await api.get('/factures', { params: { limit: 100 } });
      return asArray<FactureOption>(response.data);
    },
  });

  const chantiersQuery = useQuery({
    queryKey: ['sav-chantiers-options'],
    queryFn: async () => {
      const response = await api.get('/chantiers', { params: { limit: 100 } });
      return asArray<ChantierOption>(response.data);
    },
  });

  const tickets = ticketsQuery.data?.data ?? [];
  const summary = ticketsQuery.data?.summary ?? {
    total: 0,
    ouverts: 0,
    enCours: 0,
    urgents: 0,
    resolus: 0,
    enAttenteClient: 0,
  };
  const meta = ticketsQuery.data?.meta;
  const selectedTicket = selectedTicketQuery.data;

  const relatedOptions = useMemo(() => {
    if (form.relatedType === 'devis') return devisQuery.data ?? [];
    if (form.relatedType === 'facture') return facturesQuery.data ?? [];
    return chantiersQuery.data ?? [];
  }, [chantiersQuery.data, devisQuery.data, facturesQuery.data, form.relatedType]);

  const createMutation = useMutation({
    mutationFn: async (body: TicketFormState) => {
      const relatedId = Number(body.relatedId);
      const payload = {
        clientId: Number(body.clientId),
        assignedToId: body.assignedToId ? Number(body.assignedToId) : undefined,
        titre: body.titre.trim(),
        description: body.description.trim(),
        statut: body.statut,
        priorite: body.priorite,
        categorie: body.categorie,
        dateEcheance: body.dateEcheance || undefined,
        devisId: body.relatedType === 'devis' ? relatedId : undefined,
        factureId: body.relatedType === 'facture' ? relatedId : undefined,
        chantierId: body.relatedType === 'chantier' ? relatedId : undefined,
      };
      const response = await api.post('/sav/tickets', payload);
      return response.data as SavTicket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['sav-tickets'] });
      setSelectedTicketId(ticket.id);
      setShowCreateModal(false);
      setForm(emptyForm);
      setFeedback({ type: 'success', text: `Ticket ${ticket.reference} créé avec succès.` });
    },
    onError: (error) => setFeedback({ type: 'error', text: getErrorMessage(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TicketFormState> }) => {
      const response = await api.patch(`/sav/tickets/${id}`, data);
      return response.data as SavTicket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['sav-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['sav-ticket-detail', ticket.id] });
      setFeedback({ type: 'success', text: `Ticket ${ticket.reference} mis à jour.` });
    },
    onError: (error) => setFeedback({ type: 'error', text: getErrorMessage(error) }),
  });

  const noteMutation = useMutation({
    mutationFn: async ({ id, contenu }: { id: number; contenu: string }) => {
      const response = await api.post(`/sav/tickets/${id}/notes`, { contenu });
      return response.data as SavTicketNote;
    },
    onSuccess: () => {
      if (selectedTicketId) {
        queryClient.invalidateQueries({ queryKey: ['sav-ticket-detail', selectedTicketId] });
        queryClient.invalidateQueries({ queryKey: ['sav-tickets'] });
      }
      setNoteContent('');
      setFeedback({ type: 'success', text: 'Note interne ajoutée.' });
    },
    onError: (error) => setFeedback({ type: 'error', text: getErrorMessage(error) }),
  });

  const resetFilters = () => {
    setSearch('');
    setStatut('');
    setPriorite('');
    setCategorie('');
    setPage(1);
  };

  const getRelatedLabel = (option: DevisOption | FactureOption | ChantierOption) => {
    if ('montantTTC' in option) return `${option.reference} • ${option.statut ?? 'Facture'}`;
    if ('adresse' in option) return `${option.reference} • ${option.adresse ?? option.statut ?? 'Chantier'}`;
    return `${option.reference} • ${option.statut ?? 'Devis'}`;
  };

  const openCreateModal = () => {
    setFeedback(null);
    setForm(emptyForm);
    setShowCreateModal(true);
  };

  return (
    <div className="p-4 sm:p-6 text-gray-900 dark:text-gray-100">
      <div className="mb-4 sm:mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy size={22} className="text-[#185FA5] dark:text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Service après-vente</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Suivez les réclamations clients, les priorités et l’avancement des interventions SAV.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setDarkMode((current: boolean) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 sm:px-4 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
          >
            {darkMode ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-gray-600" />}
            <span className="hidden sm:inline">{darkMode ? 'Mode clair' : 'Mode sombre'}</span>
          </button>

          <button
            type="button"
            onClick={() => ticketsQuery.refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 sm:px-4 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw size={16} className={ticketsQuery.isFetching ? 'animate-spin' : ''} />
            Actualiser
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#185FA5] px-3 py-2 sm:px-4 text-sm text-white transition hover:bg-[#0F4780]"
          >
            <Plus size={18} />
            Nouveau ticket
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-3xl border px-4 py-3 text-sm font-medium',
            feedback.type === 'success'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-red-100 bg-red-50 text-red-700',
          )}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total" value={summary.total} hint="Tickets enregistrés" icon={<ClipboardList size={20} />} />
        <SummaryCard label="Ouverts" value={summary.ouverts} hint="À prendre en charge" icon={<LifeBuoy size={20} />} />
        <SummaryCard label="En cours" value={summary.enCours} hint="Traitement actif" icon={<Clock3 size={20} />} />
        <SummaryCard label="Urgents" value={summary.urgents} hint="Priorité élevée" icon={<AlertCircle size={20} />} />
        <SummaryCard label="Résolus" value={summary.resolus} hint="Clôture possible" icon={<ShieldCheck size={20} />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-4 sm:p-5 dark:border-gray-700">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Rechercher par référence, titre, client, devis..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-[#185FA5] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3 xl:flex">
                <SelectField value={statut} onChange={(value) => { setStatut(value); setPage(1); }}>
                  <option value="">Tous statuts</option>
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
                <SelectField value={priorite} onChange={(value) => { setPriorite(value); setPage(1); }}>
                  <option value="">Toutes priorités</option>
                  {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
                <SelectField value={categorie} onChange={(value) => { setCategorie(value); setPage(1); }}>
                  <option value="">Toutes catégories</option>
                  {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
              </div>
            </div>

            {(search || statut || priorite || categorie) && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-blue-600"
              >
                <X size={14} />
                Réinitialiser les filtres
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <tr>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Priorité</th>
                  <th className="px-5 py-3">Assigné</th>
                  <th className="px-5 py-3">Échéance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ticketsQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-500 dark:text-gray-400">
                      <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={24} />
                      Chargement des tickets SAV...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                        <Sparkles size={24} />
                      </div>
                      <p className="mt-3 font-semibold text-slate-800">Aucun ticket SAV trouvé</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Créez un premier ticket pour suivre une réclamation client.</p>
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => {
                    const isSelected = selectedTicketId === ticket.id;

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={cn(
                          'cursor-pointer transition hover:bg-blue-50/70 dark:hover:bg-gray-700/70',
                          isSelected && 'bg-blue-50 dark:bg-blue-950/30',
                        )}
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 dark:text-white">{ticket.reference}</p>
                          <p className="mt-1 max-w-[260px] truncate text-xs text-gray-500 dark:text-gray-400">{ticket.titre}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-700 dark:text-gray-300">{getClientName(ticket.client)}</p>
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{categoryLabels[ticket.categorie]}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={statusConfig[ticket.statut].className}>{statusConfig[ticket.statut].label}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={priorityConfig[ticket.priorite].className}>{priorityConfig[ticket.priorite].label}</Badge>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{getPersonName(ticket.assignedTo)}</td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{formatRelativeDate(ticket.dateEcheance)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {meta?.page ?? page} / {meta?.totalPages ?? 1} • {meta?.total ?? tickets.length} ticket(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= (meta?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {!selectedTicketId ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.7rem] bg-blue-50 text-blue-600">
                <MessageSquarePlus size={28} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Détail du ticket</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500 dark:text-gray-400">
                Sélectionnez un ticket dans la liste pour modifier son statut, sa priorité ou ajouter une note interne.
              </p>
            </div>
          ) : selectedTicketQuery.isLoading ? (
            <div className="flex min-h-[520px] items-center justify-center text-gray-500 dark:text-gray-400">
              <Loader2 className="mr-2 animate-spin text-blue-600" size={20} />
              Chargement du détail...
            </div>
          ) : selectedTicket ? (
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{selectedTicket.reference}</p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{selectedTicket.titre}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{selectedTicket.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(null)}
                  className="rounded-2xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Client</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{getClientName(selectedTicket.client)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Assigné à</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{getPersonName(selectedTicket.assignedTo)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Catégorie</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{categoryLabels[selectedTicket.categorie]}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Échéance</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{formatRelativeDate(selectedTicket.dateEcheance)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Statut</span>
                  <SelectField
                    value={selectedTicket.statut}
                    onChange={(value) => updateMutation.mutate({ id: selectedTicket.id, data: { statut: value as SavTicketStatut } })}
                    className="w-full"
                  >
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectField>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Priorité</span>
                  <SelectField
                    value={selectedTicket.priorite}
                    onChange={(value) => updateMutation.mutate({ id: selectedTicket.id, data: { priorite: value as SavTicketPriorite } })}
                    className="w-full"
                  >
                    {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectField>
                </label>
              </div>

              <div className="mt-5 rounded-3xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <FileText size={17} className="text-blue-600" />
                  Élément lié
                </div>
                <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  {selectedTicket.devis && <p>Devis : <span className="font-semibold">{selectedTicket.devis.reference}</span></p>}
                  {selectedTicket.facture && <p>Facture : <span className="font-semibold">{selectedTicket.facture.reference}</span></p>}
                  {selectedTicket.chantier && <p>Chantier : <span className="font-semibold">{selectedTicket.chantier.reference}</span></p>}
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notes internes</h3>
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{selectedTicket.notes?.length ?? 0} note(s)</span>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="Ajouter une note interne..."
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[#185FA5]"
                  />
                  <button
                    type="button"
                    disabled={!noteContent.trim() || noteMutation.isPending}
                    onClick={() => noteMutation.mutate({ id: selectedTicket.id, contenu: noteContent.trim() })}
                    className="inline-flex items-center justify-center rounded-lg bg-[#185FA5] px-3 text-white transition hover:bg-[#0F4780] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {noteMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(selectedTicket.notes ?? []).length === 0 ? (
                    <p className="rounded-3xl bg-slate-50 p-4 text-sm text-gray-500 dark:text-gray-400">Aucune note interne pour ce ticket.</p>
                  ) : (
                    selectedTicket.notes?.map((note) => (
                      <div key={note.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{getPersonName(note.user)}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(note.createdAt)}</p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{note.contenu}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-red-600">Ticket introuvable.</div>
          )}
        </aside>
      </section>

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Nouveau ticket SAV</p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">Créer une réclamation client</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-2xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Client *</span>
                <SelectField value={form.clientId} onChange={(value) => setForm((current) => ({ ...current, clientId: value }))} className="w-full">
                  <option value="">Choisir un client</option>
                  {(clientsQuery.data ?? []).map((client) => (
                    <option key={client.id} value={client.id}>{getClientName(client)}</option>
                  ))}
                </SelectField>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Assigné à</span>
                <SelectField value={form.assignedToId} onChange={(value) => setForm((current) => ({ ...current, assignedToId: value }))} className="w-full">
                  <option value="">Non assigné</option>
                  {(usersQuery.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>{getPersonName(user)} • {user.role}</option>
                  ))}
                </SelectField>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Élément lié *</span>
                <SelectField
                  value={form.relatedType}
                  onChange={(value) => setForm((current) => ({ ...current, relatedType: value as RelatedType, relatedId: '' }))}
                  className="w-full"
                >
                  <option value="chantier">Chantier</option>
                  <option value="devis">Devis</option>
                  <option value="facture">Facture</option>
                </SelectField>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Référence liée *</span>
                <SelectField value={form.relatedId} onChange={(value) => setForm((current) => ({ ...current, relatedId: value }))} className="w-full">
                  <option value="">Choisir une référence</option>
                  {relatedOptions.map((option) => (
                    <option key={option.id} value={option.id}>{getRelatedLabel(option)}</option>
                  ))}
                </SelectField>
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Titre *</span>
                <input
                  value={form.titre}
                  onChange={(event) => setForm((current) => ({ ...current, titre: event.target.value }))}
                  placeholder="Ex. Retouche peinture après réception"
                  className="w-full rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[#185FA5]"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Description *</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Décrivez la réclamation, le contexte client et l’action attendue."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[#185FA5]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Statut</span>
                <SelectField value={form.statut} onChange={(value) => setForm((current) => ({ ...current, statut: value as SavTicketStatut }))} className="w-full">
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Priorité</span>
                <SelectField value={form.priorite} onChange={(value) => setForm((current) => ({ ...current, priorite: value as SavTicketPriorite }))} className="w-full">
                  {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Catégorie</span>
                <SelectField value={form.categorie} onChange={(value) => setForm((current) => ({ ...current, categorie: value as SavTicketCategorie }))} className="w-full">
                  {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Date d’échéance</span>
                <input
                  type="date"
                  value={form.dateEcheance}
                  onChange={(event) => setForm((current) => ({ ...current, dateEcheance: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[#185FA5]"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 p-5 sm:flex-row sm:justify-end dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!form.clientId || !form.relatedId || !form.titre.trim() || !form.description.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F4780] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Créer le ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
