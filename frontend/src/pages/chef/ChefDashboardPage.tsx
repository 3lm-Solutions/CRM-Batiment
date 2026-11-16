import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  HardHat,
  Loader2,
  MapPin,
  PackageSearch,
  TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { Chantier, FournisseurCommandeDetail, PaginatedResponse } from '@/types';

const chantierStatusLabel: Record<Chantier['statut'], string> = {
  VISITE_TECHNIQUE: 'Visite technique',
  DEVIS_EN_PREPARATION: 'Devis en préparation',
  DEVIS_ENVOYE: 'Devis envoyé',
  NEGOCIATION_EN_COURS: 'Négociation',
  DEVIS_VALIDE: 'Devis validé',
  COMMANDES_GENEREES: 'Commandes générées',
  MATERIAUX_EN_LIVRAISON: 'Matériaux en livraison',
  MATERIAUX_RECEPTIONNES: 'Matériaux réceptionnés',
  PLANIFIE: 'Planifié',
  DEMARRE: 'Démarré',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  CLOTURE: 'Clôturé',
};

export default function ChefDashboardPage() {
  const navigate = useNavigate();

  const chantiersQuery = useQuery({
    queryKey: ['chef-dashboard-chantiers'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Chantier>>('/chantiers', {
        params: { page: 1, limit: 5 },
      });
      return res.data;
    },
  });

  const chantiersEnCoursQuery = useQuery({
    queryKey: ['chef-dashboard-chantiers-en-cours'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Chantier>>('/chantiers', {
        params: { page: 1, limit: 1, statut: 'EN_COURS' },
      });
      return res.data;
    },
  });

  const commandesQuery = useQuery({
    queryKey: ['chef-dashboard-commandes'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<FournisseurCommandeDetail>>(
        '/commandes-fournisseur',
        { params: { page: 1, limit: 100 } },
      );
      return res.data;
    },
  });

  const commandes = useMemo(
    () => commandesQuery.data?.data ?? [],
    [commandesQuery.data?.data],
  );
  const receptionsEnAttente = useMemo(
    () =>
      commandes.filter(
        (commande) =>
          commande.tracking.reception.state === 'EN_ATTENTE' ||
          commande.tracking.reception.state === 'PARTIELLE',
      ).length,
    [commandes],
  );

  const receptionsCompletes = useMemo(
    () =>
      commandes.filter((commande) => commande.tracking.reception.state === 'COMPLETE').length,
    [commandes],
  );

  const kpis = [
    {
      label: 'Chantiers total',
      value: chantiersQuery.data?.meta.total ?? 0,
      icon: <HardHat size={18} />,
      accent: 'bg-amber-100 text-amber-700 ring-amber-200',
    },
    {
      label: 'Chantiers en cours',
      value: chantiersEnCoursQuery.data?.meta.total ?? 0,
      icon: <TrendingUp size={18} />,
      accent: 'bg-sky-100 text-sky-700 ring-sky-200',
    },
    {
      label: 'Réceptions en attente',
      value: receptionsEnAttente,
      icon: <PackageSearch size={18} />,
      accent: 'bg-orange-100 text-orange-700 ring-orange-200',
    },
    {
      label: 'Réceptions complètes',
      value: receptionsCompletes,
      icon: <ClipboardCheck size={18} />,
      accent: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    },
  ];

  const isLoading =
    chantiersQuery.isLoading || chantiersEnCoursQuery.isLoading || commandesQuery.isLoading;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="bg-[radial-gradient(circle_at_0%_0%,rgba(245,158,11,0.2),transparent_30%),linear-gradient(135deg,#ffffff_0%,#fff7ed_55%,#ecfeff_100%)] p-5 lg:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Chef de chantier
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 lg:text-3xl">
              Tableau de bord terrain
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Priorisez les chantiers, suivez les tâches critiques et contrôlez les réceptions
              fournisseurs depuis un espace terrain compact.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                onClick={() => navigate('/chef-chantier/chantiers')}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Voir les chantiers <ArrowRight size={16} />
              </button>

              <button
                onClick={() => navigate('/chef-chantier/taches-chantier')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CheckSquare size={16} />
                Tâches chantier
              </button>

              <button
                onClick={() => navigate('/chef-chantier/receptions')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <ClipboardCheck size={16} />
                Réceptions
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0 lg:p-6">
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Point rapide
                </p>
                <p className="mt-3 text-4xl font-bold">{receptionsEnAttente}</p>
                <p className="mt-1 text-sm text-slate-300">réception(s) à vérifier</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock size={16} className="text-emerald-300" />
                  Tournée du jour
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-300">
                  Contrôlez les chantiers en cours puis traitez les réceptions partielles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"
          >
            <div
              className={cn(
                'mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1',
                kpi.accent,
              )}
            >
              {kpi.icon}
            </div>
            <p className="text-2xl font-bold text-slate-950">{kpi.value}</p>
            <p className="text-sm text-slate-500">{kpi.label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Derniers chantiers</h2>
            <p className="text-sm text-slate-500">Vue rapide des dossiers récents</p>
          </div>

          <button
            onClick={() => navigate('/chef-chantier/chantiers')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Tout voir
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Chargement du dashboard...
            </span>
          </div>
        ) : (chantiersQuery.data?.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
            Aucun chantier trouvé.
          </div>
        ) : (
          <div className="space-y-2.5">
            {(chantiersQuery.data?.data ?? []).map((chantier) => (
              <div
                key={chantier.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-950">{chantier.reference}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin size={13} />
                      {chantier.adresse}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                      chantier.statut === 'EN_COURS'
                        ? 'bg-amber-100 text-amber-700'
                        : chantier.statut === 'TERMINE' || chantier.statut === 'CLOTURE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-100 text-sky-700',
                    )}
                  >
                    {chantierStatusLabel[chantier.statut]}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Mis à jour le {formatDate(chantier.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
