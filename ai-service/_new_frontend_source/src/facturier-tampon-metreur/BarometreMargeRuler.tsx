import React from 'react';
import { QuoteCalculation } from '../types/quote';
import { formatPercent } from '../utils/calculations';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BarometreMargeRulerProps {
  calculation: QuoteCalculation;
  tauxMarge: number;
  onUpdateTauxMarge: (marge: number) => void;
  tauxTVA: number;
}

export const BarometreMargeRuler: React.FC<BarometreMargeRulerProps> = ({
  calculation,
  tauxMarge,
  onUpdateTauxMarge,
  tauxTVA,
}) => {
  const {
    tauxMarqueCalcule,
    statutMarque,
    totalVenteHT,
  } = calculation;

  const isHealthy = statutMarque === 'VALIDE' && totalVenteHT > 0;
  const clampedMarque = Math.min(Math.max(tauxMarqueCalcule, 0), 60);
  const pointerPositionPercent = (clampedMarque / 60) * 100;

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-4 md:p-5 shadow-xs space-y-3.5">
      {/* En-tête avec curseur de saisie rapide du Taux de Marge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
              Réglet Baromètre & Taux de Marque
            </h4>
            <span className="text-[10px] text-stone-500 font-medium">
              Plage saine certifiée BTP : [15% à 40%] · TVA active {tauxTVA}%
            </span>
          </div>
        </div>

        {/* Input Taux de Marge en ligne */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200">
            <label htmlFor="reglet-marge-input" className="text-xs font-bold text-stone-700">
              Taux Marge :
            </label>
            <input
              id="reglet-marge-input"
              type="number"
              min="0"
              max="200"
              step="0.5"
              value={tauxMarge}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateTauxMarge(isNaN(val) ? 0 : val);
              }}
              className="w-16 rounded-md border border-stone-300 bg-white px-2 py-0.5 text-right font-mono text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none shadow-2xs"
            />
            <span className="text-xs font-bold text-stone-500">%</span>
          </div>

          <div className="flex items-center gap-1">
            {[20, 25, 28, 32].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onUpdateTauxMarge(p)}
                className={`rounded-lg px-2 py-1 text-xs font-mono font-bold transition-all ${
                  tauxMarge === p
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Règle graduée style Laiton & Bois d'architecte */}
      <div className="relative pt-6 pb-2 px-1">
        {/* Curseur mobile triangulaire en laiton */}
        <div
          className="absolute top-0 transition-all duration-300 -translate-x-1/2 flex flex-col items-center z-10"
          style={{ left: `${pointerPositionPercent}%` }}
        >
          <div
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shadow-xs whitespace-nowrap ${
              isHealthy
                ? 'bg-emerald-700 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {formatPercent(tauxMarqueCalcule)}
          </div>
          <div
            className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] ${
              isHealthy ? 'border-t-emerald-700' : 'border-t-rose-600'
            }`}
          />
        </div>

        {/* Barre de règle à trois zones */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-stone-100 border border-stone-300 shadow-inner">
          {/* Zone basse < 15% (Danger) */}
          <div className="w-[25%] bg-rose-200/80 border-r border-rose-300" title="Zone sous-évaluée (<15%)" />
          {/* Zone saine 15% - 40% (Optimale) */}
          <div className="w-[41.66%] bg-emerald-200 border-r border-emerald-300" title="Zone saine métier [15% - 40%]" />
          {/* Zone haute > 40% (Sur-évaluation) */}
          <div className="w-[33.34%] bg-amber-200/90" title="Zone sur-évaluée (>40%)" />
        </div>

        {/* Graduations millimétriques */}
        <div className="flex justify-between text-[9px] font-mono text-stone-500 pt-1.5 px-0.5">
          <span>0%</span>
          <span className="text-rose-700 font-semibold">15% min</span>
          <span className="text-emerald-800 font-bold">28% idéal</span>
          <span className="text-amber-800 font-semibold">40% max</span>
          <span>60%+</span>
        </div>
      </div>

      {/* État de conformité explicatif */}
      <div className="flex items-center justify-between text-xs pt-1">
        {totalVenteHT === 0 ? (
          <span className="text-stone-400 italic text-[11px]">
            Renseignez des métrés d'ouvrages pour étalonner la marque
          </span>
        ) : isHealthy ? (
          <div className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Marge équilibrée [15% – 40%] : Rentabilité et compétitivité assurées</span>
          </div>
        ) : statutMarque === 'MARGE_INSUFFISANTE' ? (
          <div className="inline-flex items-center gap-1.5 text-rose-700 font-bold text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            <span>Alerte : Taux de marque insuffisant (&lt; 15%), risque de perte financière sur chantier</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Attention : Taux de marque élevé (&gt; 40%), risque de refus client</span>
          </div>
        )}
      </div>
    </div>
  );
};
