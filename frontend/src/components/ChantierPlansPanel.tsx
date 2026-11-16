import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Plus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

interface Plan {
  id: number;
  nom: string;
  type: string;
  url: string;
  createdAt: string;
  visibleFor: { id: number; nom: string; prenom: string }[];
}

interface ChantierPlansPanelProps {
  chantierId: number;
  accentClassName?: string;
}

export function ChantierPlansPanel({ chantierId }: ChantierPlansPanelProps) {
  const navigate = useNavigate();

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['chantier-plans', chantierId],
    queryFn: async () => {
      const res = await api.get(`/chantiers/${chantierId}/plans`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Plans 2D & Designs</h3>
        <button
          onClick={() => navigate(`/admin/chantiers/${chantierId}/plan-2d`)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
        >
          <Plus size={14} /> Dessiner un plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-xs text-slate-500">Aucun plan dessiné pour ce chantier.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">{plan.nom}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(plan.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => navigate(`/admin/chantiers/${chantierId}/plan-2d?planId=${plan.id}`)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
