import React from 'react';
import { QuoteCalculation } from '../../types/quote';
import { formatPercent } from '../../utils/calculations';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MarginGaugeProps {
  calculation: QuoteCalculation;
  compact?: boolean;
}

export const MarginGauge: React.FC<MarginGaugeProps> = ({ calculation, compact = false }) => {
  const { tauxMarqueCalcule, statutMarque, totalVenteHT } = calculation;
  // Plage visuelle 0% à 50%
  const clampedVal = Math.min(Math.max(tauxMarqueCalcule, 0), 50);
  const percentPos = (clampedVal / 50) * 100;

  const minZonePercent = (15 / 50) * 100; // 30%
  const maxZonePercent = (40 / 50) * 100; // 80%

  return (
    <div className={`space-y-1.5 ${compact ? 'text-xs' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-stone-700 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
          <span>Taux de marque effectif</span>
        </span>
        <div className="flex items-center gap-1.5">
          {statutMarque === 'VALIDE' && totalVenteHT > 0 ? (
            <span className="stamp-badge border-emerald-600/40 text-emerald-800 bg-emerald-50">
              Conforme DTU
            </span>
          ) : totalVenteHT > 0 ? (
            <span className="stamp-badge border-rose-600/40 text-rose-800 bg-rose-50">
              Alerte Rentabilité
            </span>
          ) : null}
          <span
            className={`font-mono font-bold text-sm tabular-nums ${
              statutMarque === 'VALIDE' && totalVenteHT > 0
                ? 'text-emerald-700'
                : totalVenteHT === 0
                ? 'text-stone-400'
                : 'text-rose-600'
            }`}
          >
            {formatPercent(tauxMarqueCalcule)}
          </span>
        </div>
      </div>

      {/* Règle graduée de métreur en bois clair / laiton */}
      <div className="relative h-3 w-full rounded-md bg-stone-100 border border-stone-300 shadow-inner overflow-hidden">
        {/* Ticks millimétriques de la règle */}
        <div className="absolute inset-0 flex justify-between px-1 opacity-25 pointer-events-none">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className={`w-[1px] bg-stone-500 ${i % 5 === 0 ? 'h-full' : 'h-1.5 self-start'}`} />
          ))}
        </div>

        {/* Zone cible 15% - 40% (Zone verte saine) */}
        <div
          style={{ left: `${minZonePercent}%`, width: `${maxZonePercent - minZonePercent}%` }}
          className="absolute top-0 bottom-0 bg-emerald-500/15 border-x border-emerald-600/50"
          title="Intervalle de marge conforme [15% - 40%]"
        />

        {/* Curseur de marque - aiguille de précision */}
        {totalVenteHT > 0 && (
          <div
            style={{ left: `${percentPos}%` }}
            className={`absolute top-0 bottom-0 w-1.5 -ml-[3px] rounded transition-all duration-300 shadow-md ${
              statutMarque === 'VALIDE'
                ? 'bg-emerald-600 ring-2 ring-emerald-300'
                : 'bg-rose-600 ring-2 ring-rose-300'
            }`}
          />
        )}
      </div>

      {/* Repères chiffrés */}
      <div className="flex justify-between text-[10px] font-mono text-stone-500 select-none">
        <span>0%</span>
        <span className="text-emerald-700 font-semibold">15% min</span>
        <span className="text-emerald-700 font-semibold">40% max</span>
        <span>50%</span>
      </div>
    </div>
  );
};

