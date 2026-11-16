import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MapPin,
  Save,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { useEffect, useState } from 'react';

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

export default function SousTraitantTacheDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const tacheId = parseInt(id || '0');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    statut: '' as 'A_FAIRE' | 'EN_COURS' | 'BLOQUEE' | 'TERMINEE' | '',
    avancement: 0,
    commentaire: '',
  });

  const { data: tache, isLoading, error } = useQuery<Tache>({
    queryKey: ['sous-traitant-tache', tacheId],
    queryFn: async () => {
      const response = await api.get(
        `/sous-traitant/taches/${tacheId}`,
      );
      return response.data;
    },
    enabled: !!id,
  });
  useEffect(() => {
    if (!tache) return;
    setFormData({ statut: tache.statut, avancement: tache.avancement, commentaire: tache.commentaire || '' });
  }, [tache]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.patch(
        `/sous-traitant/taches/${tacheId}/progress`,
        {
          statut: formData.statut,
          avancement: formData.avancement,
          commentaire: formData.commentaire,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['sous-traitant-tache', tacheId],
      });
      queryClient.invalidateQueries({
        queryKey: ['sous-traitant-dashboard'],
      });
      queryClient.invalidateQueries({
        queryKey: ['sous-traitant-taches'],
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !tache) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/sous-traitant/taches')}
          className="mb-4 flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={20} />
          Retour
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Erreur lors du chargement de la tâche.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/sous-traitant/taches')}
          className="mb-4 flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={20} />
          Retour aux tâches
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {tache.libelle}
            </h1>
            {tache.description && (
              <p className="mt-2 text-slate-600">
                {tache.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Update Form */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Mise à jour de la tâche
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="space-y-6"
            >
              {/* Statut */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Statut
                </label>
                <select
                  value={formData.statut}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      statut: e.target.value as 'A_FAIRE' | 'EN_COURS' | 'BLOQUEE' | 'TERMINEE',
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                >
                  <option value="A_FAIRE">À faire</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="TERMINEE">Terminée</option>
                  <option value="BLOQUEE">Bloquée</option>
                </select>
              </div>

              {/* Avancement */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Avancement: {formData.avancement}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.avancement}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      avancement: parseInt(e.target.value),
                    })
                  }
                  className="mt-2 w-full"
                />
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    style={{ width: `${formData.avancement}%` }}
                  />
                </div>
              </div>

              {/* Commentaire */}
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Notes / Commentaires
                </label>
                <textarea
                  value={formData.commentaire}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commentaire: e.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Décrivez l'avancement, les problèmes rencontrés, etc."
                  className="mt-1 w-full rounded-lg border border-stone-200 px-4 py-2 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Enregistrer les modifications
                  </>
                )}
              </button>

              {updateMutation.isSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                  Tâche mise à jour avec succès.
                </div>
              )}

              {updateMutation.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  Erreur lors de la mise à jour de la tâche.
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Status */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">
              État actuel
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Statut
                </p>
                <span
                  className={cn(
                    'mt-1 inline-block rounded-full px-3 py-1.5 text-sm font-semibold',
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

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Avancement
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {tache.avancement}%
                </p>
              </div>
            </div>
          </div>

          {/* Chantier Info */}
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">
              Chantier
            </h3>
            <button
              onClick={() =>
                navigate(
                  `/sous-traitant/chantiers/${tache.chantier.id}`,
                )
              }
              className="mt-3 space-y-2 text-left hover:text-emerald-600 w-full"
            >
              <p className="font-medium text-slate-900">
                {tache.chantier.reference}
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={14} />
                <span>{tache.chantier.adresse}</span>
              </div>
            </button>
          </div>

          {/* Dates */}
          {(tache.dateDebut || tache.dateFin) && (
            <div className="rounded-lg border border-stone-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">
                Dates
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {tache.dateDebut && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>
                      Début: {formatDate(tache.dateDebut)}
                    </span>
                  </div>
                )}
                {tache.dateFin && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>
                      Fin: {formatDate(tache.dateFin)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {tache.isOverdue && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="flex-shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">
                    Tâche dépassée
                  </p>
                  <p className="mt-1 text-sm text-red-800">
                    La date de fin est passée. Veuillez
                    mettre à jour la tâche.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
