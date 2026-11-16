import { useQuery } from '@tanstack/react-query';
import { FileText, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';

interface Plan {
  id: number;
  nom: string;
  type: string;
  url: string;
  createdAt: string;
  chantier: {
    id: number;
    reference: string;
    adresse: string;
  };
  visibleFor: { id: number; nom: string; prenom: string }[];
}

function isImage(url: string) {
  return /\.(png|jpe?g|webp)$/i.test(url);
}

export default function ChefPlansPage() {
  const { data: plans = [], isLoading, error } = useQuery<Plan[]>({
    queryKey: ['chef-mes-plans'],
    queryFn: async () => {
      const response = await api.get('/chantiers/plans');
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Mes plans</h1>
        <p className="mt-1 text-sm text-slate-500">
          {plans.length} plan(s) importe(s) ou dessine(s) sur vos chantiers
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Erreur lors du chargement des plans.
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/50 px-6 py-12 text-center">
          <FileText size={40} className="mx-auto mb-3 text-amber-400" />
          <p className="text-slate-600">Aucun plan pour le moment.</p>
          <Link
            to="/admin/profil-chef"
            className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Importer ou dessiner un plan
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <a
              key={plan.id}
              href={plan.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:shadow-md"
            >
              {isImage(plan.url) ? (
                <img src={plan.url} alt={plan.nom} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-amber-50">
                  <FileText size={40} className="text-amber-400" />
                </div>
              )}
              <div className="p-4">
                <p className="font-semibold text-slate-900">{plan.nom}</p>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                  <MapPin size={14} />
                  <span>{plan.chantier.reference} - {plan.chantier.adresse}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <Users size={13} />
                  {plan.visibleFor.length === 0
                    ? 'Partage avec aucun sous-traitant'
                    : `Partage avec ${plan.visibleFor.map((u) => `${u.prenom} ${u.nom}`).join(', ')}`}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
