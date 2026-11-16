import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';

interface Chantier {
  id: number;
  reference: string;
  adresse: string;
  description?: string;
  statut: string;
  dateDebut?: string;
  dateFin?: string;
  client: {
    prenom?: string;
    nom: string;
  };
  taches: Array<{
    id: number;
    statut: string;
  }>;
  metrics: {
    totalTaches: number;
    tachesTerminees: number;
    tachesEnCours: number;
    tachesAFaire: number;
    tachesBloquees: number;
  };
}

export default function SousTraitantChantiersPage() {
  const navigate = useNavigate();

  const { data: chantiers = [], isLoading, error } = useQuery<Chantier[]>({
    queryKey: ['sous-traitant-chantiers'],
    queryFn: async () => {
      const response = await api.get('/sous-traitant/chantiers');
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
          Erreur lors du chargement des chantiers.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Mes chantiers
        </h1>
        <p className="mt-1 text-slate-500">
          {chantiers.length} chantier(s) assigné(s)
        </p>
      </div>

      {chantiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-stone-400" />
          <p className="text-slate-500">
            Aucun chantier assigné pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {chantiers.map((chantier) => {
            const progressPercent =
              chantier.metrics.totalTaches > 0
                ? Math.round(
                    (chantier.metrics.tachesTerminees /
                      chantier.metrics.totalTaches) *
                      100,
                  )
                : 0;

            return (
              <button
                key={chantier.id}
                onClick={() =>
                  navigate(
                    `/sous-traitant/chantiers/${chantier.id}`,
                  )
                }
                className="block rounded-lg border border-stone-200 bg-white p-6 transition-all hover:shadow-md hover:border-emerald-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">
                        {chantier.reference}
                      </h3>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          chantier.statut === 'TERMINE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : chantier.statut === 'EN_COURS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-stone-100 text-stone-700',
                        )}
                      >
                        {chantier.statut}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{chantier.adresse}</span>
                      </div>
                      {chantier.dateDebut && (
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span>
                            {formatDate(chantier.dateDebut)}
                            {chantier.dateFin &&
                              ` - ${formatDate(chantier.dateFin)}`}
                          </span>
                        </div>
                      )}
                      <div className="text-slate-500">
                        Client: {chantier.client.prenom}{' '}
                        {chantier.client.nom}
                      </div>
                    </div>

                    {/* Task Metrics */}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {chantier.metrics.tachesAFaire > 0 && (
                        <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                          <AlertCircle size={14} />
                          {chantier.metrics.tachesAFaire} à faire
                        </div>
                      )}
                      {chantier.metrics.tachesEnCours > 0 && (
                        <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700">
                          <Clock size={14} />
                          {chantier.metrics.tachesEnCours} en cours
                        </div>
                      )}
                      {chantier.metrics.tachesBloquees > 0 && (
                        <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
                          <AlertCircle size={14} />
                          {chantier.metrics.tachesBloquees} bloquées
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={14} />
                        {chantier.metrics.tachesTerminees} terminées
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">
                          Avancement
                        </span>
                        <span className="font-semibold text-slate-900">
                          {progressPercent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    size={24}
                    className="flex-shrink-0 text-slate-400"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
