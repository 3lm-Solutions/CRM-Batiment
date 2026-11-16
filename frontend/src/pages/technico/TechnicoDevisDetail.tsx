import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { DevisManualEditorModal } from '@/components/devis/DevisManualEditorModal';
import { DevisInvoice } from '@/components/DevisInvoice';
import type { Devis } from '@/types';
import { formatCurrency } from '@/lib/utils';

export default function TechnicoDevisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const devisId = Number(id);

  const [showEditor, setShowEditor] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const { data: devis, isLoading, isError } = useQuery({
    queryKey: ['technico-devis-detail-page', devisId],
    enabled: Number.isFinite(devisId),
    queryFn: async () => {
      const res = await api.get(`/devis/${devisId}`);
      return res.data as Devis;
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['technico-devis-detail-page', devisId] });
    await queryClient.invalidateQueries({ queryKey: ['technico-devis'] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={30} className="animate-spin text-teal-500" />
      </div>
    );
  }

  if (isError || !devis) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        Impossible de charger ce devis.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate('/technico/devis')}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={15} />
            Retour aux devis
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Devis {devis.reference}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Client : {devis.client ? `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim() : '—'} •
            Total TTC : {formatCurrency(devis.totalTTC ?? 0)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Aperçu devis
          </button>
          <button
            onClick={() => setShowEditor(true)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Éditer les lignes
          </button>
        </div>
      </div>

      {/* Quick info card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Statut</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{devis.statut}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lignes</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{devis.lignes?.length ?? 0} ligne(s)</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total HT</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(devis.totalHT ?? 0)}</p>
          </div>
        </div>
        {devis.notes && (
          <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {devis.notes}
          </p>
        )}
      </div>

      {/* Manual editor modal — opened by default on this page */}
      {showEditor && (
        <DevisManualEditorModal
          devis={devis}
          open={showEditor}
          onClose={() => setShowEditor(false)}
          onSaved={refresh}
        />
      )}

      {/* Preview modal */}
      {showPreview && (
        <DevisInvoice
          devis={devis}
          onClose={() => setShowPreview(false)}
          onPrint={() => window.print()}
          onManualEdit={() => {
            setShowPreview(false);
            setShowEditor(true);
          }}
        />
      )}
    </div>
  );
}
