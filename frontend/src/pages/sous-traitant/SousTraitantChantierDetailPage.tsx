import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  File,
  Loader2,
  MapPin,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
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
  chefChantier?: {
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
  };
  taches: Array<{
    id: number;
    libelle: string;
    description?: string;
    statut: string;
    dateDebut?: string;
    dateFin?: string;
    avancement: number;
    commentaire?: string;
  }>;
  documents: Array<{
    id: number;
    nom: string;
    type: string;
    url: string;
    createdAt: string;
  }>;
  metrics: {
    totalTaches: number;
    tachesTerminees: number;
    tachesEnCours: number;
    tachesAFaire: number;
    tachesBloquees: number;
  };
}

export default function SousTraitantChantierDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const chantierId = parseInt(id || '0');

  const { data: chantier, isLoading, error } = useQuery<Chantier>({
    queryKey: ['sous-traitant-chantier', chantierId],
    queryFn: async () => {
      const response = await api.get(
        `/sous-traitant/chantiers/${chantierId}`,
      );
      return response.data;
    },
    enabled: !!id,
  });

  const progressPercent =
    chantier && chantier.metrics.totalTaches > 0
      ? Math.round(
          (chantier.metrics.tachesTerminees /
            chantier.metrics.totalTaches) *
            100,
        )
      : 0;


  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !chantier) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/sous-traitant/chantiers')}
          className="mb-4 flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={20} />
          Retour
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Erreur lors du chargement du chantier.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/sous-traitant/chantiers')}
          className="mb-4 flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={20} />
          Retour aux chantiers
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">
                {chantier.reference}
              </h1>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-semibold',
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

            <div className="mt-3 space-y-2 text-slate-600">
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
            </div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">
              Progression du chantier
            </h2>
            <span className="text-2xl font-bold text-emerald-600">
              {progressPercent}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-slate-500">
            {chantier.metrics.tachesTerminees} sur{' '}
            {chantier.metrics.totalTaches} tâches terminées
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tâches Section */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Tâches ({chantier.metrics.totalTaches})
            </h2>

            {chantier.taches.length === 0 ? (
              <p className="text-slate-500">Aucune tâche assignée.</p>
            ) : (
              <div className="space-y-3">
                {chantier.taches.map((tache) => (
                  <button
                    key={tache.id}
                    onClick={() =>
                      navigate(
                        `/sous-traitant/taches/${tache.id}`,
                      )
                    }
                    className="block w-full rounded-lg border border-stone-200 p-4 transition-all hover:shadow-md hover:border-emerald-200 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">
                          {tache.libelle}
                        </h3>
                        {tache.description && (
                          <p className="mt-1 text-sm text-slate-500">
                            {tache.description}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs font-semibold',
                              tache.statut === 'TERMINEE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : tache.statut === 'EN_COURS'
                                  ? 'bg-blue-100 text-blue-700'
                                  : tache.statut === 'BLOQUEE'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-stone-100 text-stone-700',
                            )}
                          >
                            {tache.statut}
                          </span>
                        </div>

                        {/* Avancement bar */}
                        <div className="mt-3 space-y-1">
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

                      {tache.statut === 'TERMINEE' ? (
                        <CheckCircle2
                          size={24}
                          className="flex-shrink-0 text-emerald-600"
                        />
                      ) : (
                        <Clock
                          size={24}
                          className="flex-shrink-0 text-amber-600"
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">
              Informations client
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {chantier.client.prenom} {chantier.client.nom}
              </p>
            </div>
          </div>

          {/* Chef de chantier */}
          {chantier.chefChantier && (
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">
                Chef de chantier
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="font-medium text-slate-900">
                  {chantier.chefChantier.prenom}{' '}
                  {chantier.chefChantier.nom}
                </p>
                <p>{chantier.chefChantier.email}</p>
                {chantier.chefChantier.telephone && (
                  <p>{chantier.chefChantier.telephone}</p>
                )}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <File size={18} />
              Documents ({chantier.documents.length})
            </h3>
            {chantier.documents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Aucun document disponible.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {chantier.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    download
                    className="flex items-center gap-2 rounded-lg border border-stone-200 p-2 text-sm hover:bg-stone-50"
                  >
                    <Download size={16} className="text-slate-400" />
                    <span className="flex-1 truncate text-slate-700">
                      {doc.nom}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
