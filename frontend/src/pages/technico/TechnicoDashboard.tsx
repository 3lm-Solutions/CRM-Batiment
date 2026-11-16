import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Users,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  Eye,
} from 'lucide-react';
import type { Client, DemandeDevis, Devis } from '@/types';

export default function TechnicoDashboard() {
  const { user } = useAuth();

  // Fetch data
  const { data: clientsData } = useQuery({
    queryKey: ['technico-clients'],
    queryFn: async () => {
      const res = await api.get('/clients', { params: { page: 1, limit: 5 } });
      return res.data;
    },
  });

  const { data: demandesData } = useQuery({
    queryKey: ['technico-demandes'],
    queryFn: async () => {
      const res = await api.get('/demandes-devis', { params: { page: 1, limit: 5 } });
      return res.data;
    },
  });

  const { data: devisData } = useQuery({
    queryKey: ['technico-devis'],
    queryFn: async () => {
      const res = await api.get('/devis', { params: { page: 1, limit: 100 } });
      return res.data;
    },
  });

  const totalClients = clientsData?.meta?.total ?? 0;
  const totalDemandes = demandesData?.meta?.total ?? 0;
  const allDevis: Devis[] = devisData?.data ?? [];
  const totalDevis = devisData?.meta?.total ?? 0;
  const devisAcceptes = allDevis.filter((d) => ['ACCEPTE', 'SIGNE', 'FACTURE'].includes(d.statut)).length;
  const devisBrouillon = allDevis.filter((d) => d.statut === 'BROUILLON').length;
  const devisEnvoyes = allDevis.filter((d) => d.statut === 'ENVOYE').length;
  const chiffreAffaires = allDevis
    .filter((d) => ['ACCEPTE', 'SIGNE', 'FACTURE'].includes(d.statut))
    .reduce((sum, d) => sum + (d.totalHT ?? 0), 0);

  const recentClients: Client[] = (clientsData?.data ?? []).slice(0, 4);
  const recentDemandes: DemandeDevis[] = (demandesData?.data ?? []).slice(0, 4);
  const recentDevis: Devis[] = allDevis.slice(0, 5);

  const statusColors: Record<string, string> = {
    BROUILLON: 'bg-gray-100 text-gray-600',
    ENVOYE: 'bg-blue-100 text-blue-700',
    ACCEPTE: 'bg-emerald-100 text-emerald-700',
    REFUSE: 'bg-red-100 text-red-700',
    ANNULE: 'bg-orange-100 text-orange-700',
    NOUVEAU: 'bg-sky-100 text-sky-700',
    EN_COURS: 'bg-blue-100 text-blue-700',
    CONVERTI: 'bg-emerald-100 text-emerald-700',
    PERDU: 'bg-rose-100 text-rose-700',
  };

  function getDisplayDemandeStatut(statut: string) {
    return statut === 'QUALIFIE' ? 'EN_COURS' : statut;
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#c0b4fa] via-[#d6c8fa] to-[#b4e0fa] rounded-2xl p-6 sm:p-8 text-blue-900">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <p className="text-violet-800 text-sm font-medium">Bonjour,</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            {user?.prenom} {user?.nom} 👋
          </h1>
          <p className="text-violet-700/80 mt-2 text-sm max-w-lg">
            Voici le résumé de votre activité commerciale. Gérez vos clients, suivez vos devis et
            consultez le catalogue.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              to="/technico/clients"
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Nouveau client
            </Link>
            <Link
              to="/technico/devis"
              className="inline-flex items-center gap-2 bg-white text-teal-700 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-teal-900/20"
            >
              <FileSpreadsheet size={16} />
              Créer un devis
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<Users size={22} />}
          label="Mes Clients"
          value={totalClients}
          accent="from-blue-500 to-blue-600"
          bgAccent="bg-blue-50"
          link="/technico/clients"
        />
        <KPICard
          icon={<FileText size={22} />}
          label="Demandes"
          value={totalDemandes}
          accent="from-amber-500 to-orange-500"
          bgAccent="bg-amber-50"
          link="/technico/demandes"
        />
        <KPICard
          icon={<FileSpreadsheet size={22} />}
          label="Devis"
          value={totalDevis}
          accent="from-emerald-500 to-teal-500"
          bgAccent="bg-emerald-50"
          link="/technico/devis"
        />
        <KPICard
          icon={<TrendingUp size={22} />}
          label="CA Accepté"
          value={formatCurrency(chiffreAffaires)}
          accent="from-purple-500 to-violet-600"
          bgAccent="bg-purple-50"
        />
      </div>

      {/* Devis Pipeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Pipeline Devis</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PipelineStep
            icon={<Clock size={18} />}
            label="Brouillon"
            count={devisBrouillon}
            color="bg-gray-100 text-gray-600"
            bar="bg-gray-400"
          />
          <PipelineStep
            icon={<Send size={18} />}
            label="Envoyé"
            count={devisEnvoyes}
            color="bg-blue-50 text-blue-600"
            bar="bg-blue-500"
          />
          <PipelineStep
            icon={<CheckCircle2 size={18} />}
            label="Accepté"
            count={devisAcceptes}
            color="bg-emerald-50 text-emerald-600"
            bar="bg-emerald-500"
          />
          <PipelineStep
            icon={<AlertTriangle size={18} />}
            label="Refusé"
            count={allDevis.filter((d) => d.statut === 'REFUSE').length}
            color="bg-red-50 text-red-600"
            bar="bg-red-400"
          />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Derniers devis - 3 cols */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Derniers devis</h2>
            <Link
              to="/technico/devis"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Voir tout <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentDevis.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">Aucun devis</p>
            ) : (
              recentDevis.map((devis) => (
                <div key={devis.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-lg flex items-center justify-center text-teal-600 font-bold text-xs">
                    {devis.reference?.slice(-3) ?? '#'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{devis.reference}</p>
                    <p className="text-xs text-gray-400">{devis.client?.nom ?? 'Client'} • {formatDate(devis.createdAt)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColors[devis.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                    {devis.statut}
                  </span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">
                    {formatCurrency(devis.totalTTC)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Derniers clients - 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Clients récents</h2>
            <Link
              to="/technico/clients"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Voir tout <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentClients.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-400 text-sm">Aucun client</p>
            ) : (
              recentClients.map((client) => (
                <div key={client.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                    {(client.prenom?.charAt(0) ?? '') + (client.nom?.charAt(0) ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {client.prenom} {client.nom}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{client.email ?? client.telephone ?? '—'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Demandes récentes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Dernières demandes de devis</h2>
          <Link
            to="/technico/demandes"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            Voir tout <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentDemandes.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Aucune demande</p>
          ) : (
            recentDemandes.map((d) => (
              <div key={d.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center text-amber-600">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.description}</p>
                  <p className="text-xs text-gray-400">
                    {d.client?.nom ?? 'Client'} • {formatDate(d.createdAt)}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColors[getDisplayDemandeStatut(d.statut)] ?? 'bg-gray-100 text-gray-600'}`}>
                  {getDisplayDemandeStatut(d.statut)}
                </span>
                <Link
                  to="/technico/demandes"
                  className="text-gray-400 hover:text-teal-600 transition-colors"
                >
                  <Eye size={16} />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------- Sub-components ------------- */

function KPICard({
  icon,
  label,
  value,
  accent,
  bgAccent,
  link,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent: string;
  bgAccent: string;
  link?: string;
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow group cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bgAccent}`}>
          <div className={`bg-gradient-to-br ${accent} bg-clip-text`}>{icon}</div>
        </div>
        {link && (
          <ArrowUpRight size={16} className="text-gray-300 group-hover:text-teal-500 transition-colors" />
        )}
      </div>
      <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
    </div>
  );

  return link ? <Link to={link}>{inner}</Link> : inner;
}

function PipelineStep({
  icon,
  label,
  count,
  color,
  bar,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  color: string;
  bar: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-extrabold">{count}</p>
      <div className="mt-2 h-1 bg-black/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: count > 0 ? '100%' : '0%' }} />
      </div>
    </div>
  );
}
