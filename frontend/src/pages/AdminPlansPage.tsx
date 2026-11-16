import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, HardHat, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { ChantierPlansPanel } from '@/components/ChantierPlansPanel';

interface Plan {
  id: number;
  chantier: { id: number; reference: string; adresse: string };
  visibleFor: { id: number; nom: string; prenom: string }[];
}

interface ChantierGroup {
  id: number;
  reference: string;
  adresse: string;
  planCount: number;
}

export default function AdminPlansPage() {
  const [selectedChantier, setSelectedChantier] = useState<ChantierGroup | null>(null);

  const { data: plans = [], isLoading, error } = useQuery<Plan[]>({
    queryKey: ['admin-all-plans'],
    queryFn: async () => {
      const res = await api.get('/chantiers/plans');
      return res.data;
    },
  });

  const chantierGroups = useMemo(() => {
    const map = new Map<number, ChantierGroup>();
    for (const plan of plans) {
      const existing = map.get(plan.chantier.id);
      if (existing) {
        existing.planCount += 1;
      } else {
        map.set(plan.chantier.id, {
          id: plan.chantier.id,
          reference: plan.chantier.reference,
          adresse: plan.chantier.adresse,
          planCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.reference.localeCompare(b.reference));
  }, [plans]);

  if (selectedChantier) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedChantier(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft size={16} /> Retour a la liste des chantiers
        </button>

        <div>
          <h1 className="text-xl font-bold text-slate-900">{selectedChantier.reference}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin size={14} /> {selectedChantier.adresse}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <ChantierPlansPanel chantierId={selectedChantier.id} accentClassName="emerald" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Plans de chantiers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tous les plans/designs importes ou dessines, tous chantiers confondus.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Erreur lors du chargement des plans.
        </div>
      ) : chantierGroups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <FileText size={40} className="mx-auto mb-3 text-slate-400" />
          <p className="text-slate-500">Aucun plan importe ou dessine pour le moment.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {chantierGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedChantier(group)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <HardHat size={18} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{group.reference}</p>
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin size={13} /> {group.adresse}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {group.planCount} plan(s)
                </span>
                <ChevronRight size={18} className="text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
