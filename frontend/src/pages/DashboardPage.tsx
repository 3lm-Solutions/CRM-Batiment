import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  FileSpreadsheet,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowRight,
  Building2,
  BookOpen,
  Truck,
  HardHat,
  Euro,
  Target,
  Zap,
  BarChart3,
} from 'lucide-react';

interface ModuleCard {
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  bgLight: string;
  iconColor: string;
  stats: { label: string; value: number | string }[];
  href: string;
  comingSoon?: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: clients } = useQuery({
    queryKey: ['clients-count'],
    queryFn: async () => {
      const res = await api.get('/clients', { params: { page: 1, limit: 1 } });
      return res.data;
    },
  });

  const { data: demandes } = useQuery({
    queryKey: ['demandes-count'],
    queryFn: async () => {
      const res = await api.get('/demandes-devis', { params: { page: 1, limit: 1000 } });
      return res.data;
    },
  });

  const { data: devis } = useQuery({
    queryKey: ['devis-count'],
    queryFn: async () => {
      const res = await api.get('/devis', { params: { page: 1, limit: 1 } });
      return res.data;
    },
  });

  const { data: devisSignes } = useQuery({
    queryKey: ['devis-signes-sum'],
    queryFn: async () => {
      const res = await api.get('/devis', { params: { page: 1, limit: 1000, statut: 'SIGNE' } });
      return res.data;
    },
  });

  const { data: prestations } = useQuery({
    queryKey: ['prestations-count'],
    queryFn: async () => {
      const res = await api.get('/prestations');
      const arr = res.data?.data ?? res.data ?? [];
      return { total: Array.isArray(arr) ? arr.length : 0 };
    },
  });

  const { data: fournisseurs } = useQuery({
    queryKey: ['fournisseurs-count'],
    queryFn: async () => {
      const res = await api.get('/fournisseurs');
      const arr = res.data?.data ?? res.data ?? [];
      return { total: Array.isArray(arr) ? arr.length : 0 };
    },
  });

  const { data: chantiers } = useQuery({
    queryKey: ['chantiers-count'],
    queryFn: async () => {
      const res = await api.get('/chantiers', { params: { page: 1, limit: 1 } });
      return res.data;
    },
  });

  const totalClients = clients?.meta?.total ?? 0;
  const totalAllDemandes = demandes?.meta?.total ?? 0;
  const totalPendingDemandes = (demandes?.data ?? []).filter((d: any) =>
    ['NOUVEAU', 'QUALIFIE', 'EN_COURS'].includes(d.statut)
  ).length;
  const totalDevis = devis?.meta?.total ?? 0;
  const totalPrestations = prestations?.total ?? 0;
  const totalFournisseurs = fournisseurs?.total ?? 0;
  const totalChantiers = chantiers?.meta?.total ?? 0;

  const ca = (devisSignes?.data ?? []).reduce((acc: number, d: any) => acc + (d.totalHT ?? 0), 0);
  const totalSignedDevis = devisSignes?.meta?.total ?? 0;
  const totalDevisEnCours = Math.max(0, totalDevis - totalSignedDevis);

  // Module cards
  const modules: ModuleCard[] = [
    {
      title: 'Clients & Devis',
      description: 'Gérez vos clients, demandes et devis commerciaux',
      icon: <Building2 size={28} />,
      gradient: 'from-blue-500 to-blue-700',
      bgLight: 'bg-blue-50',
      iconColor: 'text-blue-600',
      stats: [
        { label: 'Clients', value: totalClients },
        { label: 'Demandes', value: totalAllDemandes },
        { label: 'Devis', value: totalDevis },
      ],
      href: '/admin/clients',
    },
    {
      title: 'Bibliothèque Prix',
      description: 'Catalogue de prestations, matériaux et main d\'œuvre',
      icon: <BookOpen size={28} />,
      gradient: 'from-emerald-500 to-emerald-700',
      bgLight: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      stats: [
        { label: 'Prestations', value: totalPrestations },
        { label: 'Catégories', value: '10+' },
      ],
      href: '/admin/prestations',
    },
    {
      title: 'Fournisseurs',
      description: 'Gestion des fournisseurs et commandes',
      icon: <Truck size={28} />,
      gradient: 'from-violet-500 to-violet-700',
      bgLight: 'bg-violet-50',
      iconColor: 'text-violet-600',
      stats: [
        { label: 'Fournisseurs', value: totalFournisseurs },
        { label: 'Commandes', value: 0 },
      ],
      href: '/admin/fournisseurs',
    },
    {
      title: 'Chantier & Planning',
      description: 'Suivi des chantiers, tâches et planning',
      icon: <HardHat size={28} />,
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50',
      iconColor: 'text-amber-600',
      stats: [
        { label: 'Chantiers', value: totalChantiers },
        { label: 'En cours', value: 0 },
      ],
      href: '/admin/chantiers',
    },
  ];

  const kpiCards = [
    {
      label: 'Total Clients',
      value: totalClients,
      icon: <Users size={20} />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: '+12%',
    },
    {
      label: 'Demandes en cours',
      value: totalPendingDemandes,
      icon: <FileText size={20} />,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      trend: '+8%',
    },
    {
      label: 'Devis émis',
      value: totalDevis,
      icon: <FileSpreadsheet size={20} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: '+15%',
    },
    {
      label: 'Chiffre d\'affaires',
      value: formatCurrency(ca),
      icon: <Euro size={20} />,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: '+22%',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="batiflow-gradient rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 right-32 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-blue-600" />
            <span className="text-blue-700 text-sm font-medium">BÂTIFLOW Dashboard</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-2 text-blue-900">
            Bonjour, {user?.prenom} 👋
          </h1>
          <p className="text-blue-800 text-sm lg:text-base max-w-lg">
            Voici un aperçu de votre activité. Gérez vos projets de construction efficacement.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl border border-gray-100 p-5 card-hover group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-0.5">
                {card.trend} <ArrowUpRight size={12} />
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-[13px] text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Module Cards */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Modules</h2>
            <p className="text-sm text-gray-500">Accédez rapidement aux différentes sections</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {modules.map((mod) => (
            <button
              key={mod.title}
              onClick={() => !mod.comingSoon && navigate(mod.href)}
              disabled={mod.comingSoon}
              className="module-card bg-white rounded-2xl border border-gray-100 p-6 text-left group relative overflow-hidden disabled:cursor-not-allowed"
            >
              {/* Gradient accent top */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${mod.gradient}`} />

              {mod.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    Bientôt
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 ${mod.bgLight} rounded-2xl flex items-center justify-center ${mod.iconColor} shrink-0`}>
                  {mod.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-primary-700 transition-colors flex items-center gap-2">
                    {mod.title}
                    {!mod.comingSoon && (
                      <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    )}
                  </h3>
                  <p className="text-[13px] text-gray-500 mt-0.5">{mod.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    {mod.stats.map((stat) => (
                      <div key={stat.label} className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                        <span className="text-[11px] text-gray-400 font-medium">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Actions + Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Actions rapides */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target size={18} className="text-primary-600" />
            Actions rapides
          </h2>
          <div className="space-y-2">
            <ActionButton icon={<Users size={17} />} label="Ajouter un client" onClick={() => navigate('/admin/clients')} color="blue" />
            <ActionButton icon={<FileText size={17} />} label="Nouvelle demande" onClick={() => navigate('/admin/demandes-devis')} color="orange" />
            <ActionButton icon={<FileSpreadsheet size={17} />} label="Créer un devis" onClick={() => navigate('/admin/devis')} color="emerald" />
            <ActionButton icon={<Truck size={17} />} label="Gérer fournisseurs" onClick={() => navigate('/admin/fournisseurs')} color="violet" />
          </div>
        </div>

        {/* Statut pipeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-primary-600" />
            Pipeline d'activité
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <PipelineCard
              icon={<Clock size={20} />}
              label="En attente"
              count={totalPendingDemandes}
              color="amber"
              description="Demandes à traiter"
            />
            <PipelineCard
              icon={<FileSpreadsheet size={20} />}
              label="Devis en cours"
              count={totalDevisEnCours}
              color="blue"
              description="Devis non validés"
            />
            <PipelineCard
              icon={<CheckCircle size={20} />}
              label="Acceptés"
              count={totalSignedDevis}
              color="emerald"
              description="Devis signés"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: ReactNode; label: string; onClick: () => void; color: string }) {
  const colors: Record<string, string> = {
    blue: 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700',
    orange: 'hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700',
    emerald: 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700',
    violet: 'hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 text-gray-600 transition-all text-left ${colors[color] ?? colors.blue}`}
    >
      {icon}
      <span className="text-[13px] font-medium">{label}</span>
      <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function PipelineCard({ icon, label, count, color, description }: { icon: ReactNode; label: string; count: number; color: string; description: string }) {
  const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
    amber: { bg: 'border-amber-100', iconBg: 'bg-amber-50 text-amber-600', text: 'text-amber-700' },
    blue: { bg: 'border-blue-100', iconBg: 'bg-blue-50 text-blue-600', text: 'text-blue-700' },
    emerald: { bg: 'border-emerald-100', iconBg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-700' },
  };
  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div className={`rounded-xl border ${c.bg} p-4`}>
      <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{count}</p>
      <p className={`text-sm font-semibold ${c.text}`}>{label}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
    </div>
  );
}
