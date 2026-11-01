import React, { useState } from 'react';
import { Plus, Percent, SlidersHorizontal, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { PrestationCard } from './PrestationCard';
import { AddPrestationModal } from './AddPrestationModal';
import { PrestationOccurrence, CalculatedPrestation } from '../types/quote';

interface Zone2ValidationProps {
  prestationsCalculees: CalculatedPrestation[];
  tauxMarge: number;
  onUpdateTauxMarge: (nouveauTaux: number) => void;
  onUpdateQuantite: (occurrenceId: string, quantite: number | null) => void;
  onToggleOption: (occurrenceId: string, optionId: string) => void;
  onDeleteOccurrence: (occurrenceId: string) => void;
  onAddPrestation: (prestationId: number) => void;
  isLoading: boolean;
}

export const Zone2Validation: React.FC<Zone2ValidationProps> = ({
  prestationsCalculees,
  tauxMarge,
  onUpdateTauxMarge,
  onUpdateQuantite,
  onToggleOption,
  onDeleteOccurrence,
  onAddPrestation,
  isLoading,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showMarginTooltip, setShowMarginTooltip] = useState(false);

  const marginPresets = [18, 24, 28, 32, 38];

  const handleTauxMargeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onUpdateTauxMarge(isNaN(val) ? 0 : val);
  };

  const hasMissingQuantities = prestationsCalculees.some((p) => p.hasQuantiteManquante);

  return (
    <section className="space-y-4">
      {/* En-tête de la Zone 2 : Validation Humaine & Champ Taux de Marge */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                Zone 2 — Validation Humaine
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-xs font-medium text-stone-500">
                {prestationsCalculees.length} ouvrage{prestationsCalculees.length > 1 ? 's' : ''} chiffré{prestationsCalculees.length > 1 ? 's' : ''}
              </span>
            </div>
            <h2 className="text-base md:text-lg font-bold text-stone-900 mt-1">
              Ajustement des prestations, quantités et marge
            </h2>
          </div>

          {/* Champ unique Taux de Marge avec recalcul instantané */}
          <div className="flex flex-wrap items-center gap-3 bg-stone-50 p-2 rounded-xl border border-stone-200">
            <div className="flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-amber-700" />
              <label htmlFor="taux-marge-input" className="text-xs font-bold text-stone-700">
                Taux de marge :
              </label>
              <button
                type="button"
                onClick={() => setShowMarginTooltip(!showMarginTooltip)}
                className="text-stone-400 hover:text-stone-700 transition-colors"
                title="Comprendre le Taux de Marge vs Taux de Marque"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                id="taux-marge-input"
                type="number"
                min="0"
                max="200"
                step="0.5"
                value={tauxMarge}
                onChange={handleTauxMargeInput}
                className="w-20 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-right font-mono text-sm font-bold text-stone-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-xs"
              />
              <span className="ml-1.5 text-xs font-bold text-stone-500">%</span>
            </div>

            {/* Presets rapides de marge */}
            <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
              {marginPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdateTauxMarge(preset)}
                  className={`rounded-md px-2 py-0.5 text-xs font-mono font-medium transition-colors ${
                    tauxMarge === preset
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-white text-stone-600 border border-stone-200 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info-bulle pédagogique Marge vs Marque si demandée */}
        {showMarginTooltip && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-stone-800 space-y-1.5 shadow-xs">
            <p className="font-bold text-amber-900">
              Rappel de gestion BTP : Taux de Marge vs Taux de Marque
            </p>
            <p className="text-stone-600">
              • <strong>Taux de Marge (saisi ici)</strong> : calculé par rapport au coût de revient d'achat : <span className="font-mono text-stone-800 bg-amber-100/60 px-1 py-0.5 rounded">Prix Vente = Coût × (1 + Marge %)</span>.
            </p>
            <p className="text-stone-600">
              • <strong>Taux de Marque (calculé en Zone 3)</strong> : part de la marge brute dans le chiffre d'affaires : <span className="font-mono text-stone-800 bg-amber-100/60 px-1 py-0.5 rounded">Marque = Marge Brute / CA HT</span>. Doit se situer entre 15% et 40% pour être validé.
            </p>
          </div>
        )}
      </div>

      {/* Squelette de chargement si le pipeline RAG tourne */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6 space-y-4 shadow-xs"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-48 bg-stone-200 rounded" />
                <div className="h-8 w-24 bg-stone-200 rounded" />
              </div>
              <div className="h-20 bg-stone-100 rounded-xl" />
              <div className="h-6 w-32 bg-stone-200 rounded self-end ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Liste des cartes de prestations empilées verticalement */}
      {!isLoading && prestationsCalculees.length > 0 && (
        <div className="space-y-4">
          {prestationsCalculees.map((calc) => (
            <PrestationCard
              key={calc.occurrence.id}
              calculated={calc}
              tauxMarge={tauxMarge}
              onUpdateQuantite={onUpdateQuantite}
              onToggleOption={onToggleOption}
              onDeleteOccurrence={onDeleteOccurrence}
            />
          ))}

          {/* Bouton "+ Ajouter une prestation" en bas de la liste */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-600 bg-white hover:bg-stone-50 px-5 py-3 text-xs font-bold text-stone-700 hover:text-amber-800 transition-all shadow-xs w-full justify-center group"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 group-hover:bg-amber-100 text-amber-700">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <span>Ajouter manuellement une prestation au devis</span>
            </button>
          </div>
        </div>
      )}

      {/* État vide si aucune prestation */}
      {!isLoading && prestationsCalculees.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white p-12 text-center space-y-3 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Aucune prestation pour le moment
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
              Décrivez votre chantier dans la Zone 1 ci-dessus (par texte, photo ou mémo vocal) ou ajoutez directement une prestation du catalogue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter depuis le catalogue</span>
          </button>
        </div>
      )}

      {/* Modal d'ajout de prestation */}
      <AddPrestationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddPrestation={onAddPrestation}
      />
    </section>
  );
};
