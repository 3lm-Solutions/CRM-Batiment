import React from 'react';
import {
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckSquare,
  Square,
  Wrench,
  Package,
  Layers,
} from 'lucide-react';
import { CalculatedPrestation } from '../types/quote';
import { formatCurrency } from '../utils/calculations';

interface PrestationCardProps {
  calculated: CalculatedPrestation;
  tauxMarge: number;
  onUpdateQuantite: (occurrenceId: string, quantite: number | null) => void;
  onUpdateCout?: (occurrenceId: string, cout: number | null) => void;
  onToggleOption: (occurrenceId: string, optionId: string) => void;
  onDeleteOccurrence: (occurrenceId: string) => void;
}

export const PrestationCard: React.FC<PrestationCardProps> = ({
  calculated,
  tauxMarge,
  onUpdateQuantite,
  onUpdateCout,
  onToggleOption,
  onDeleteOccurrence,
}) => {
  const { occurrence, hasQuantiteManquante, isHorsFourchette, ecartFourchette, typeEcart, sousTotalVenteHT } = calculated;
  const margeMultiplier = 1 + tauxMarge / 100;

  const handleQuantiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === '') {
      onUpdateQuantite(occurrence.id, null);
    } else {
      const num = parseFloat(val);
      onUpdateQuantite(occurrence.id, isNaN(num) ? null : num);
    }
  };

  const composantsActifs = [...occurrence.composants];
  if (occurrence.options) {
    for (const opt of occurrence.options) {
      if (opt.active && opt.composants) {
        composantsActifs.push(...opt.composants);
      }
    }
  }

  const quantiteActuelle = occurrence.quantiteOuvrage || 0;
  const fourchetteMin = occurrence.prixVenteMin * quantiteActuelle;
  const fourchetteMax = occurrence.prixVenteMax * quantiteActuelle;

  return (
    <article
      className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
        hasQuantiteManquante
          ? 'border-rose-300 bg-rose-50/30 shadow-xs'
          : 'border-stone-200 bg-white shadow-xs hover:border-stone-300 hover:shadow-sm'
      }`}
    >
      {/* 1. Bandeau bloquant : Quantité d'ouvrage manquante (style mémo chantier urgent) */}
      {hasQuantiteManquante && (
        <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-100/80 px-4 py-2 text-xs font-bold text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>
            Métré d'ouvrage manquant — Renseignez la quantité en m²/u pour valider le calcul et débloquer l'envoi client.
          </span>
        </div>
      )}

      {/* 2. Bandeau non-bloquant : Alerte fourchette catalogue DTU */}
      {isHorsFourchette && !hasQuantiteManquante && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Total hors fourchette DTU :</strong> chiffré à{' '}
              <span className="font-mono font-bold">{formatCurrency(sousTotalVenteHT)}</span>{' '}
              pour {quantiteActuelle} {occurrence.unite} (attendu : {formatCurrency(fourchetteMin)} – {formatCurrency(fourchetteMax)})
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
            {typeEcart === 'SUR_EVALUATION' ? `+${formatCurrency(ecartFourchette)}` : `-${formatCurrency(ecartFourchette)}`}
          </span>
        </div>
      )}

      {/* 3. En-tête de la carte : Titre de l'ouvrage + Champ Quantité + Suppression */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 bg-white">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 border border-stone-200 text-amber-700 shadow-2xs">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider font-mono">
                {occurrence.categorie}
              </span>
              {occurrence.noteTechnique && (
                <>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span className="text-[11px] text-stone-500 hidden md:inline">
                    {occurrence.noteTechnique}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-base font-bold text-stone-900 mt-0.5">
              {occurrence.titre}
            </h3>
          </div>
        </div>

        {/* Bloc champ quantité d'ouvrage éditable en direct */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`quantite-${occurrence.id}`}
              className="text-xs font-bold text-stone-700"
            >
              Quantité :
            </label>
            <div
              className={`relative flex items-center rounded-xl border transition-all ${
                hasQuantiteManquante
                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                  : 'border-stone-300 bg-stone-50 focus-within:bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-100 shadow-inner'
              }`}
            >
              <input
                id={`quantite-${occurrence.id}`}
                type="number"
                min="0"
                step="any"
                value={occurrence.quantiteOuvrage ?? ''}
                onChange={handleQuantiteChange}
                placeholder="Ex: 25"
                className="w-20 md:w-24 bg-transparent px-3 py-1.5 text-right font-mono text-sm font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              <span className="pr-3 text-xs font-bold text-stone-500 font-mono">
                {occurrence.unite}
              </span>
            </div>
          </div>
          {occurrence.composants.length === 0 && onUpdateCout && (
            <div className="flex items-center gap-2">
              <label htmlFor={`cout-${occurrence.id}`} className="text-xs font-bold text-stone-700">
                Coût :
              </label>
              <div
                className={`relative flex items-center rounded-xl border ${
                  occurrence.coutUnitaireManuel == null
                    ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                    : 'border-stone-300 bg-stone-50'
                }`}
              >
                <input
                  id={`cout-${occurrence.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={occurrence.coutUnitaireManuel ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    onUpdateCout(occurrence.id, val === '' ? null : parseFloat(val));
                  }}
                  placeholder="0,00"
                  className="w-20 bg-transparent px-3 py-1.5 text-right font-mono text-sm font-bold text-stone-900 focus:outline-none"
                />
                <span className="pr-3 text-xs font-bold text-stone-500 font-mono">€</span>
              </div>
            </div>
          )}

          {/* Bouton pour supprimer l'occurrence */}
          <button
            type="button"
            onClick={() => onDeleteOccurrence(occurrence.id)}
            className="rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Supprimer cette prestation du devis"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 4. Options techniques détectées */}
      {occurrence.options && occurrence.options.length > 0 && (
        <div className="mx-4 md:mx-5 mb-4 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block">
            Options techniques & variantes d'exécution :
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {occurrence.options.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                  opt.active
                    ? 'border-amber-300 bg-white text-stone-900 shadow-xs ring-1 ring-amber-200'
                    : 'border-stone-200 bg-stone-100/60 text-stone-600 hover:bg-white hover:text-stone-900'
                }`}
              >
                <input
                  type="checkbox"
                  checked={opt.active}
                  onChange={() => onToggleOption(occurrence.id, opt.id)}
                  className="hidden"
                />
                <div className="mt-0.5 shrink-0">
                  {opt.active ? (
                    <CheckSquare className="h-4 w-4 text-amber-700" />
                  ) : (
                    <Square className="h-4 w-4 text-stone-400" />
                  )}
                </div>
                <div className="text-xs">
                  <span className="font-bold block">{opt.nom}</span>
                  <span className="text-[11px] text-stone-500 mt-0.5 block">
                    {opt.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 5. Tableau des composants d'ouvrage (Matériau vs Main d'œuvre) */}
      <div className="border-t border-stone-200 px-4 md:px-5 py-3 overflow-x-auto bg-stone-50/40">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-stone-200 text-[10px] text-stone-500 uppercase tracking-widest">
              <th className="pb-2 font-bold">Nature</th>
              <th className="pb-2 font-bold">Composant de fourniture & prestation</th>
              <th className="pb-2 font-bold text-right">Ratio / {occurrence.unite}</th>
              <th className="pb-2 font-bold text-right">Quantité Totale</th>
              <th className="pb-2 font-bold text-right">P.U. Vente HT</th>
              <th className="pb-2 font-bold text-right">Sous-total HT</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-stone-200/80 ${hasQuantiteManquante ? 'opacity-40' : ''}`}>
            {composantsActifs.map((comp) => {
              const compSellingUnitPrice = comp.prixUnitaireAchat * margeMultiplier;
              const compTotalQuantity = hasQuantiteManquante ? 0 : comp.quantiteParUnite * quantiteActuelle;
              const compTotalSellingPrice = hasQuantiteManquante ? 0 : compTotalQuantity * compSellingUnitPrice;

              return (
                <tr key={comp.id} className="hover:bg-white transition-colors">
                  <td className="py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        comp.type === 'service'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {comp.type === 'service' ? (
                        <>
                          <Wrench className="h-3 w-3" />
                          <span>Main d'œuvre</span>
                        </>
                      ) : (
                        <>
                          <Package className="h-3 w-3" />
                          <span>Fourniture</span>
                        </>
                      )}
                    </span>
                  </td>

                  <td className="py-2.5 font-semibold text-stone-800">
                    {comp.nom}
                  </td>

                  <td className="py-2.5 text-right font-mono text-stone-500 tabular-nums">
                    {comp.quantiteParUnite} {comp.unite}
                  </td>

                  <td className="py-2.5 text-right font-mono font-bold text-stone-900 tabular-nums">
                    {compTotalQuantity.toFixed(2)} {comp.unite}
                  </td>

                  <td className="py-2.5 text-right font-mono text-stone-600 tabular-nums">
                    {formatCurrency(compSellingUnitPrice)}
                  </td>

                  <td className="py-2.5 text-right font-mono font-bold text-stone-900 tabular-nums">
                    {formatCurrency(compTotalSellingPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 6. Pied de carte : Sous-total prestation */}
      <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 md:px-5 py-3">
        <div className="text-xs text-stone-600">Montant calculé à partir des composants de l'ouvrage.</div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            Sous-total prestation :
          </span>
          <span
            className={`font-mono text-lg font-black tabular-nums ${
              hasQuantiteManquante ? 'text-stone-400 line-through' : 'text-amber-800'
            }`}
          >
            {formatCurrency(sousTotalVenteHT)}
          </span>
        </div>
      </div>
    </article>
  );
};

