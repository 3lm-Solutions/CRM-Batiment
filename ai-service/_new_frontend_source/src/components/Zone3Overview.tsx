import React, { useState } from 'react';
import {
  Send,
  Save,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { QuoteCalculation } from '../types/quote';
import { formatCurrency, formatPercent } from '../utils/calculations';

interface Zone3OverviewProps {
  calculation: QuoteCalculation;
  tauxTVA: number;
  onChangeTauxTVA: (nouveauTaux: number) => void;
  onSendToClient: () => void;
  onSaveDraft: () => void;
  onOpenPreview: () => void;
  isSavingDraft: boolean;
}

export const Zone3Overview: React.FC<Zone3OverviewProps> = ({
  calculation,
  tauxTVA,
  onChangeTauxTVA,
  onSendToClient,
  onSaveDraft,
  onOpenPreview,
  isSavingDraft,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const {
    totalVenteHT,
    totalCoutHT,
    margeBrute,
    tauxMarqueCalcule,
    statutMarque,
    montantTVA,
    totalTTC,
    peutEnvoyerDevis,
    motifsRefusEnvoi,
    quantitesManquantesCount,
    prestationCount,
  } = calculation;

  return (
    <aside className="sticky top-20 rounded-2xl border border-stone-200/90 bg-white p-5 md:p-6 shadow-sm space-y-5">
      {/* En-tête de la Zone 3 */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 inline-block">
            Zone 3 — Aperçu & Actions
          </span>
          <h3 className="text-base font-bold text-stone-900 mt-1">
            Synthèse financière
          </h3>
        </div>

        {/* Sélecteur de TVA BTP (10% habitat rénovation / 20% standard) */}
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200 text-xs">
          <button
            type="button"
            onClick={() => onChangeTauxTVA(10)}
            className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
              tauxTVA === 10
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 text-amber-800'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Taux intermédiaire rénovation logements > 2 ans (art. 279-0 bis CGI)"
          >
            10%
          </button>
          <button
            type="button"
            onClick={() => onChangeTauxTVA(20)}
            className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
              tauxTVA === 20
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 text-amber-800'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Taux normal travaux neufs ou locaux professionnels"
          >
            20%
          </button>
        </div>
      </div>

      {/* Résumé chiffré mis à jour en direct */}
      <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
        {/* Total HT */}
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span className="font-medium">Total Vente HT</span>
          <span className="font-mono text-sm font-bold text-stone-900 tabular-nums">
            {formatCurrency(totalVenteHT)}
          </span>
        </div>

        {/* Coût de revient & Marge Brute */}
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Coût de revient HT</span>
          <span className="font-mono tabular-nums text-stone-600">
            {formatCurrency(totalCoutHT)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200">
          <span>Marge brute générée</span>
          <span className="font-mono font-semibold text-stone-700 tabular-nums">
            {formatCurrency(margeBrute)}
          </span>
        </div>

        {/* TVA */}
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span>TVA ({tauxTVA}%)</span>
          <span className="font-mono text-sm font-semibold text-stone-800 tabular-nums">
            {formatCurrency(montantTVA)}
          </span>
        </div>

        {/* Total TTC */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-200">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-900 block">
              Total TTC
            </span>
            <span className="text-[10px] text-stone-500 font-medium">Net à payer client</span>
          </div>
          <span className="font-mono text-2xl font-black text-amber-800 tabular-nums">
            {formatCurrency(totalTTC)}
          </span>
        </div>
      </div>

      {/* Taux de marque calculé avec code couleur CDC */}
      <div
        className={`rounded-xl border p-3.5 space-y-1.5 transition-colors ${
          statutMarque === 'VALIDE' && totalVenteHT > 0
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
            : 'border-rose-200 bg-rose-50/70 text-rose-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp
              className={`h-4 w-4 ${
                statutMarque === 'VALIDE' && totalVenteHT > 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            />
            <span className="text-xs font-bold">
              Taux de marque calculé
            </span>
          </div>

          <span
            className={`font-mono text-base font-extrabold tabular-nums ${
              statutMarque === 'VALIDE' && totalVenteHT > 0
                ? 'text-emerald-800'
                : 'text-rose-800'
            }`}
          >
            {formatPercent(tauxMarqueCalcule)}
          </span>
        </div>

        {/* Message d'état précis */}
        <div className="text-xs">
          {totalVenteHT === 0 ? (
            <p className="text-stone-500">En attente de chiffrage des ouvrages</p>
          ) : statutMarque === 'VALIDE' ? (
            <p className="text-emerald-800 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>Marge conforme aux seuils métiers [15% – 40%]</span>
            </p>
          ) : statutMarque === 'MARGE_INSUFFISANTE' ? (
            <div className="text-rose-800 space-y-0.5">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span>MARGE_INSUFFISANTE (&lt; 15%)</span>
              </p>
              <p className="text-[11px] text-rose-700">
                La rentabilité du chantier est insuffisante pour couvrir les frais généraux.
              </p>
            </div>
          ) : (
            <div className="text-rose-800 space-y-0.5">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span>MARGE_EXCESSIVE (&gt; 40%)</span>
              </p>
              <p className="text-[11px] text-rose-700">
                Tarif excessif risquant d'entraîner le refus du client.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Boutons d'action principaux */}
      <div className="space-y-2 pt-1">
        {/* Bouton d'action principal : Envoyer au client */}
        <div className="relative">
          <button
            type="button"
            onClick={onSendToClient}
            disabled={!peutEnvoyerDevis}
            onMouseEnter={() => !peutEnvoyerDevis && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold transition-all shadow-sm ${
              peutEnvoyerDevis
                ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-amber-600/20'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Envoyer au client</span>
          </button>

          {/* Info-bulle détaillée expliquant pourquoi l'envoi est bloqué */}
          {showTooltip && !peutEnvoyerDevis && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-40 rounded-xl border border-rose-300 bg-white p-3 text-xs text-rose-900 shadow-xl space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Envoi bloqué : conditions non remplies</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-600">
                {motifsRefusEnvoi.map((motif, i) => (
                  <li key={i}>{motif}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Bouton Enregistrer le brouillon (toujours actif) */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSavingDraft}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
        >
          <Save className="h-4 w-4 text-amber-700" />
          <span>{isSavingDraft ? 'Sauvegarde...' : 'Enregistrer le brouillon'}</span>
        </button>

        {/* Bouton Voir l'aperçu détaillé (esprit Pronergy) */}
        <button
          type="button"
          onClick={onOpenPreview}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-2 text-xs font-semibold text-stone-600 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Voir l'aperçu détaillé / PDF</span>
        </button>
      </div>

      {/* Badges de garanties & mentions légales */}
      <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500 font-medium">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          <span>Garantie Décennale AXA</span>
        </span>
        <span>Validité 30j</span>
      </div>
    </aside>
  );
};
