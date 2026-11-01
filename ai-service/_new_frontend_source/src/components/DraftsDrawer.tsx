import React from 'react';
import { X, Trash2, ArrowRight, FolderOpen, Calendar, Clock } from 'lucide-react';
import { SavedDraft } from '../types/quote';
import { formatCurrency } from '../utils/calculations';

interface DraftsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: SavedDraft[];
  onLoadDraft: (draft: SavedDraft) => void;
  onDeleteDraft: (draftId: string) => void;
}

export const DraftsDrawer: React.FC<DraftsDrawerProps> = ({
  isOpen,
  onClose,
  drafts,
  onLoadDraft,
  onDeleteDraft,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md h-full bg-white border-l border-stone-200 p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-amber-700" />
              <h3 className="text-base font-bold text-stone-900">
                Brouillons enregistrés ({drafts.length})
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-xs text-stone-500">
            Retrouvez et rechargez les devis sauvegardés en cours de négociation.
          </p>

          <div className="overflow-y-auto max-h-[75vh] space-y-3 pr-1">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2 hover:border-amber-300 transition-colors shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      {draft.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Calendar className="h-3 w-3 text-stone-400" />
                        {draft.date}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-stone-700">Client : {draft.clientInfo.nom || 'Non spécifié'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteDraft(draft.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 transition-colors"
                    title="Supprimer ce brouillon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs">
                  <div>
                    <span className="text-stone-500">Total TTC : </span>
                    <span className="font-mono font-bold text-amber-800">
                      {formatCurrency(draft.totalTTC)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onLoadDraft(draft);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-2xs"
                  >
                    <span>Charger</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {drafts.length === 0 && (
              <div className="py-12 text-center text-xs text-stone-400">
                Aucun brouillon enregistré. Cliquez sur "Enregistrer le brouillon" dans la Zone 3 pour conserver votre travail.
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200 text-center">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            Fermer le panneau
          </button>
        </div>
      </div>
    </div>
  );
};
