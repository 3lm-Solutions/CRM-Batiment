import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import type { Devis, LigneDevis, Materiau } from '@/types';
import {
  composeStructuredDevisNotes,
  parseStructuredDevisNotes,
  type StructuredDevisNotes,
} from '@/lib/devisStructuredNotes';

interface DevisManualEditorModalProps {
  devis: Devis;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface LineFormState {
  id: number | null;
  description: string;
  quantite: string;
  unite: string;
  prixUnitaireVente: string;
  prixAchat: string;
  mainOeuvre: string;
  materiauId: string;
}

const emptyLineForm: LineFormState = {
  id: null,
  description: '',
  quantite: '1',
  unite: 'M2',
  prixUnitaireVente: '0',
  prixAchat: '0',
  mainOeuvre: '0',
  materiauId: '',
};

function toLineForm(line: LigneDevis): LineFormState {
  return {
    id: line.id,
    description: line.description ?? line.prestation?.nom ?? '',
    quantite: String(line.quantite ?? 1),
    unite: line.unite ?? 'M2',
    prixUnitaireVente: String(line.prixUnitaireVente ?? 0),
    prixAchat: String(line.prixAchat ?? 0),
    mainOeuvre: String(line.mainOeuvre ?? 0),
    materiauId: line.materiauId ? String(line.materiauId) : '',
  };
}

export function DevisManualEditorModal({ devis, open, onClose, onSaved }: DevisManualEditorModalProps) {
  const [lineForm, setLineForm] = useState<LineFormState>(emptyLineForm);
  const [notesForm, setNotesForm] = useState<StructuredDevisNotes>(() =>
    parseStructuredDevisNotes(devis.notes),
  );

  const lignes = useMemo(
    () => [...(devis.lignes ?? [])].sort((a, b) => a.ordre - b.ordre),
    [devis.lignes],
  );

  const { data: materiaux = [] } = useQuery({
    queryKey: ['devis-manual-editor-materiaux'],
    enabled: open,
    queryFn: async () => {
      const response = await api.get('/materiaux', { params: { limit: 300 } });
      return (response.data?.data ?? response.data) as Materiau[];
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      const notes = composeStructuredDevisNotes(notesForm);
      await api.patch(`/devis/${devis.id}`, { notes });
    },
    onSuccess: async () => {
      if (onSaved) await onSaved();
    },
  });

  const addLineMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await api.post(`/devis/${devis.id}/lignes`, payload);
    },
    onSuccess: async () => {
      setLineForm(emptyLineForm);
      if (onSaved) await onSaved();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'ajout.";
      alert(msg);
    }
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ lineId, payload }: { lineId: number; payload: Record<string, unknown> }) => {
      await api.patch(`/devis/${devis.id}/lignes/${lineId}`, payload);
    },
    onSuccess: async () => {
      setLineForm(emptyLineForm);
      if (onSaved) await onSaved();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Erreur lors de la modification.";
      alert(msg);
    }
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: number) => {
      await api.delete(`/devis/${devis.id}/lignes/${lineId}`);
    },
    onSuccess: async () => {
      if (lineForm.id) {
        const deletedCurrentLine = !lignes.some((line) => line.id === lineForm.id);
        if (deletedCurrentLine) setLineForm(emptyLineForm);
      }
      if (onSaved) await onSaved();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Erreur lors de la suppression de la ligne.";
      alert(msg);
    }
  });

  function buildPayload() {
    return {
      description: lineForm.description || undefined,
      quantite: Number(lineForm.quantite || 0),
      unite: lineForm.unite || undefined,
      prixUnitaireVente: Number(lineForm.prixUnitaireVente || 0),
      prixAchat: Number(lineForm.prixAchat || 0),
      mainOeuvre: Number(lineForm.mainOeuvre || 0),
      materiauId: lineForm.materiauId ? Number(lineForm.materiauId) : undefined,
    };
  }

  function submitLine() {
    const payload = buildPayload();
    if (!payload.quantite || payload.quantite <= 0) {
      alert("La quantité doit être supérieure à 0.");
      return;
    }

    if (lineForm.id) {
      updateLineMutation.mutate({ lineId: lineForm.id, payload });
      return;
    }

    addLineMutation.mutate(payload);
  }

  if (!open) return null;

  const isLineSubmitting = addLineMutation.isPending || updateLineMutation.isPending;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-lg font-bold text-slate-900">Edition manuelle du devis</p>
            <p className="text-sm text-slate-500">Ajouter, modifier ou supprimer les lignes et les conditions.</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-72px)] gap-0 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border-r border-slate-100 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Lignes devis</h3>
              <button
                onClick={() => setLineForm(emptyLineForm)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus size={14} /> Nouvelle ligne
              </button>
            </div>

            <div className="space-y-2">
              {lignes.map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {line.description || line.prestation?.nom || `Ligne #${line.id}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {line.quantite} {line.unite} • {line.prixUnitaireVente} €/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setLineForm(toLineForm(line))}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-blue-600"
                      title="Modifier"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette ligne ?")) {
                          deleteLineMutation.mutate(line.id);
                        }
                      }}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-rose-600"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {lignes.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  Aucune ligne. Ajoutez une ligne manuellement.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-6 p-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Formulaire ligne</h3>
              <div className="mt-3 grid gap-3">
                <input
                  value={lineForm.description}
                  onChange={(e) => setLineForm((current) => ({ ...current, description: e.target.value }))}
                  placeholder="Description / tache"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lineForm.quantite}
                    onChange={(e) => setLineForm((current) => ({ ...current, quantite: e.target.value }))}
                    placeholder="Quantite"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                  <input
                    value={lineForm.unite}
                    onChange={(e) => setLineForm((current) => ({ ...current, unite: e.target.value }))}
                    placeholder="Unite"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    step="0.01"
                    value={lineForm.prixUnitaireVente}
                    onChange={(e) =>
                      setLineForm((current) => ({ ...current, prixUnitaireVente: e.target.value }))
                    }
                    placeholder="PU vente"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={lineForm.prixAchat}
                    onChange={(e) =>
                      setLineForm((current) => ({ ...current, prixAchat: e.target.value }))
                    }
                    placeholder="Prix achat"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={lineForm.mainOeuvre}
                    onChange={(e) =>
                      setLineForm((current) => ({ ...current, mainOeuvre: e.target.value }))
                    }
                    placeholder="Main d'oeuvre"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                  />
                </div>

                <select
                  value={lineForm.materiauId}
                  onChange={(e) => setLineForm((current) => ({ ...current, materiauId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                >
                  <option value="">Materiau lie (optionnel)</option>
                  {materiaux.map((materiau) => (
                    <option key={materiau.id} value={materiau.id}>
                      {materiau.nom}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={submitLine}
                    disabled={isLineSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isLineSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {lineForm.id ? 'Mettre a jour la ligne' : 'Ajouter la ligne'}
                  </button>
                  {lineForm.id ? (
                    <button
                      onClick={() => setLineForm(emptyLineForm)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Annuler edition
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Conditions</h3>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Conditions de paiement</label>
                <textarea
                  value={notesForm.paymentTerms}
                  rows={4}
                  onChange={(e) =>
                    setNotesForm((current) => ({ ...current, paymentTerms: e.target.value }))
                  }
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Conditions generales</label>
                <textarea
                  value={notesForm.generalConditions}
                  rows={4}
                  onChange={(e) =>
                    setNotesForm((current) => ({ ...current, generalConditions: e.target.value }))
                  }
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Communication structuree (facture)</label>
                <input
                  value={notesForm.communication}
                  onChange={(e) =>
                    setNotesForm((current) => ({ ...current, communication: e.target.value }))
                  }
                  placeholder="Ex: +++123/4567/89+++"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Notes complementaires</label>
                <textarea
                  value={notesForm.extraNotes}
                  rows={3}
                  onChange={(e) =>
                    setNotesForm((current) => ({ ...current, extraNotes: e.target.value }))
                  }
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>

              <button
                onClick={() => saveNotesMutation.mutate()}
                disabled={saveNotesMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {saveNotesMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Enregistrer les conditions
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
