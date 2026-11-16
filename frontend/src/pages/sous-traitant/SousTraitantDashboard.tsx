import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface DashboardData {
  chantiersAssignes: number;
  taches: {
    aFaire: number;
    enCours: number;
    terminees: number;
    bloquees: number;
    total: number;
  };
}

export default function SousTraitantDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['sous-traitant-dashboard'],
    queryFn: async () => {
      const response = await api.get('/sous-traitant/dashboard');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Erreur lors du chargement du tableau de bord.
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Chantiers assignés',
      value: data?.chantiersAssignes ?? 0,
      icon: <Building2 size={24} />,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      action: () => navigate('/sous-traitant/chantiers'),
    },
    {
      label: 'Tâches à faire',
      value: data?.taches.aFaire ?? 0,
      icon: <AlertCircle size={24} />,
      color: 'bg-slate-50 text-slate-700 border-slate-200',
      action: () => navigate('/sous-traitant/taches?statut=A_FAIRE'),
    },
    {
      label: 'Tâches en cours',
      value: data?.taches.enCours ?? 0,
      icon: <Clock size={24} />,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      action: () => navigate('/sous-traitant/taches?statut=EN_COURS'),
    },
    {
      label: 'Tâches terminées',
      value: data?.taches.terminees ?? 0,
      icon: <CheckCircle2 size={24} />,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      action: () => navigate('/sous-traitant/taches?statut=TERMINEE'),
    },
  ];

  const totalProgress =
    data?.taches.total ?? 0 > 0
      ? Math.round(
          ((data?.taches.terminees ?? 0) / (data?.taches.total ?? 0)) * 100,
        )
      : 0;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Tableau de bord
        </h1>
        <p className="mt-1 text-slate-500">
          Vue d'ensemble de vos chantiers et tâches assignées
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <button
            key={index}
            onClick={stat.action}
            className={cn(
              'rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer',
              stat.color,
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium opacity-75">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-bold">{stat.value}</p>
              </div>
              <div className="opacity-50">{stat.icon}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Overall Progress */}
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Progression globale
              </h2>
              <span className="text-2xl font-bold text-emerald-600">
                {totalProgress}%
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {data?.taches.terminees ?? 0} sur {data?.taches.total ?? 0}{' '}
              tâches terminées
            </p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => navigate('/sous-traitant/chantiers')}
          className="rounded-lg border border-stone-200 bg-white p-6 transition-all hover:shadow-md hover:border-emerald-200"
        >
          <Building2 size={32} className="mb-3 text-emerald-600" />
          <h3 className="font-semibold text-slate-900">
            Consulter mes chantiers
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Accédez à la liste complète de vos chantiers assignés
          </p>
        </button>

        <button
          onClick={() => navigate('/sous-traitant/taches')}
          className="rounded-lg border border-stone-200 bg-white p-6 transition-all hover:shadow-md hover:border-emerald-200"
        >
          <CheckCircle2 size={32} className="mb-3 text-emerald-600" />
          <h3 className="font-semibold text-slate-900">
            Consulter mes tâches
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Gérez l'avancement de vos tâches et mises à jour
          </p>
        </button>
      </div>
    </div>
  );
}
