import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useState } from 'react';

interface Tache {
  id: number;
  libelle: string;
  description?: string;
  statut: 'A_FAIRE' | 'EN_COURS' | 'BLOQUEE' | 'TERMINEE';
  dateDebut?: string;
  dateFin?: string;
  avancement: number;
  commentaire?: string;
  isOverdue?: boolean;
  chantier: {
    id: number;
    reference: string;
    adresse: string;
    client: {
      prenom?: string;
      nom: string;
    };
  };
}

const STATUS_OPTIONS = [
  { value: 'A_FAIRE', label: 'À faire', icon: AlertCircle },
  { value: 'EN_COURS', label: 'En cours', icon: Clock },
  { value: 'TERMINEE', label: 'Terminée', icon: CheckCircle2 },
  { value: 'BLOQUEE', label: 'Bloquée', icon: AlertCircle },
];

export default function SousTraitantTachesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStatus = searchParams.get('statut') || '';

  const { data: taches = [], isLoading, error } = useQuery<Tache[]>({
    queryKey: ['sous-traitant-taches', selectedStatus],
    queryFn: async () => {
      const response = await api.get('/sous-traitant/taches');
      let filtered = response.data as Tache[];

      if (selectedStatus) {
        filtered = filtered.filter((t) => t.statut === selectedStatus);
      }

      return filtered;
    },
  });

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'TERMINEE':
        return 'bg-emerald-100 text-emerald-700';
      case 'EN_COURS':
        return 'bg-blue-100 text-blue-700';
      case 'BLOQUEE':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

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
          Erreur lors du chargement des tâches.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Mes tâches
        </h1>
        <p className="mt-1 text-slate-500">
          {taches.length} tâche(s) assignée(s)
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSearchParams({})}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-all',
            selectedStatus === ''
              ? 'bg-emerald-600 text-white'
              : 'bg-stone-100 text-slate-700 hover:bg-stone-200',
          )}
        >
          <Filter size={16} />
          Toutes
        </button>

        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSearchParams({ statut: option.value })}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-all',
              selectedStatus === option.value
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-slate-700 hover:bg-stone-200',
            )}
          >
            <option.icon size={16} />
            {option.label}
          </button>
        ))}
      </div>

      {taches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-stone-400" />
          <p className="text-slate-500">
            Aucune tâche trouvée pour ce filtre.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {taches.map((tache) => (
            <button
              key={tache.id}
              onClick={() =>
                navigate(`/sous-traitant/taches/${tache.id}`)
              }
              className="block rounded-lg border border-stone-200 bg-white p-6 transition-all hover:shadow-md hover:border-emerald-200 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      {tache.libelle}
                    </h3>
                    <span
                      className={cn(
                        'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
                        getStatutColor(tache.statut),
                      )}
                    >
                      {tache.statut}
                    </span>
                  </div>

                  {tache.description && (
                    <p className="mt-2 text-sm text-slate-500">
                      {tache.description}
                    </p>
                  )}

                  <div className="mt-3 space-y-3">
                    {/* Chantier link */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(
                          `/sous-traitant/chantiers/${tache.chantier.id}`,
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <MapPin size={14} />
                      <span>{tache.chantier.reference}</span>
                    </div>

                    {/* Dates */}
                    <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                      {tache.dateDebut && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          <span>{formatDate(tache.dateDebut)}</span>
                        </div>
                      )}
                      {tache.isOverdue && (
                        <div className="flex items-center gap-1.5 text-red-600">
                          <AlertCircle size={14} />
                          <span>Dépassée</span>
                        </div>
                      )}
                    </div>

                    {/* Avancement */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">
                          Avancement
                        </span>
                        <span className="font-semibold text-slate-900">
                          {tache.avancement}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ width: `${tache.avancement}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <ChevronRight
                  size={24}
                  className="flex-shrink-0 text-slate-400"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
