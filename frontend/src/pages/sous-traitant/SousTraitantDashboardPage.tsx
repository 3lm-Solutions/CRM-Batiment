import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  ListChecks,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  SousTraitantDashboardData,
  SousTraitantTask,
  SousTraitantTaskStatus,
} from './types';

const statusConfig: Record<
  SousTraitantTaskStatus,
  { label: string; className: string }
> = {
  A_FAIRE: { label: 'À faire', className: 'bg-slate-100 text-slate-700' },
  EN_COURS: { label: 'En cours', className: 'bg-blue-50 text-blue-700' },
  BLOQUEE: { label: 'Bloquée', className: 'bg-red-50 text-red-700' },
  TERMINEE: { label: 'Terminée', className: 'bg-emerald-50 text-emerald-700' },
};

function clientName(task: SousTraitantTask) {
  return `${task.chantier.client.prenom ?? ''} ${task.chantier.client.nom}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) return 'Non définie';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export default function SousTraitantDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sous-traitant-dashboard'],
    queryFn: async () => {
      const response = await api.get<SousTraitantDashboardData>(
        '/sous-traitant/dashboard',
      );
      return response.data;
    },
  });

  const summary = data?.summary ?? {
    totalTaches: 0,
    aFaire: 0,
    enCours: 0,
    bloquees: 0,
    terminees: 0,
    enRetard: 0,
    totalChantiers: 0,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_30%),linear-gradient(135deg,#ffffff_0%,#f5fbfa_55%,#f8fafc_100%)] p-6 shadow-sm ring-1 ring-stone-200 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Espace sous-traitant
        </p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 lg:text-3xl">
              Tableau de bord opérationnel
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Consultez uniquement les chantiers et les tâches qui vous sont affectées.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/sous-traitant/taches"
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              Voir mes tâches <ArrowRight size={16} />
            </Link>
            <Link
              to="/sous-traitant/chantiers"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Mes chantiers
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          Impossible de charger le tableau de bord sous-traitant.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chantiers affectés"
          value={summary.totalChantiers}
          icon={<Building2 size={18} />}
        />
        <KpiCard
          label="Tâches en cours"
          value={summary.enCours}
          icon={<Clock3 size={18} />}
        />
        <KpiCard
          label="Tâches en retard"
          value={summary.enRetard}
          icon={<AlertTriangle size={18} />}
          danger={summary.enRetard > 0}
        />
        <KpiCard
          label="Tâches terminées"
          value={summary.terminees}
          icon={<CheckCircle2 size={18} />}
        />
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-stone-200 lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Dernières tâches</h3>
            <p className="mt-1 text-sm text-slate-500">
              Vos affectations les plus récemment mises à jour.
            </p>
          </div>
          <Link
            to="/sous-traitant/taches"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Tout voir
          </Link>
        </div>

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : !data?.recentTasks.length ? (
          <div className="mt-5 flex min-h-48 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
            <ListChecks size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Aucune tâche affectée</p>
            <p className="mt-1 text-xs text-slate-400">
              Les tâches attribuées par le chef de chantier apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-100">
            {data.recentTasks.map((task) => {
              const cfg = statusConfig[task.statut];
              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {task.libelle}
                      </p>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          cfg.className,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.chantier.reference} · {clientName(task)} · échéance {formatDate(task.dateFin)}
                    </p>
                  </div>
                  <div className="w-full sm:w-36">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Avancement</span>
                      <span>{Math.round(task.avancement)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${Math.min(100, Math.max(0, task.avancement))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-2xl',
          danger ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700',
        )}
      >
        {icon}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
