import React, { useState } from 'react';
import {
  CalculatedPrestation,
  PrestationOccurrence,
} from '../types/quote';
import { formatCurrency } from '../utils/calculations';
import {
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Percent,
} from 'lucide-react';

interface GrandLivreBordereauProps {
  prestationsCalculees: CalculatedPrestation[];
  tauxMarge: number;
  onUpdateQuantite: (id: string, qte: number | null) => void;
  onUpdateCout?: (id: string, cout: number | null) => void;
  onToggleOption: (occId: string, optId: string) => void;
  onDeleteOccurrence: (id: string) => void;
  onOpenAddModal: () => void;
}

export const GrandLivreBordereau: React.FC<GrandLivreBordereauProps> = ({
  prestationsCalculees,
  tauxMarge,
  onUpdateQuantite,
  onUpdateCout,
  onToggleOption,
  onDeleteOccurrence,
  onOpenAddModal,
}) => {
  const [expandedOuvrages, setExpandedOuvrages] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedOuvrages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Barre de contrôle du Grand Livre */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50/80 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-amber-700" />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
            Grand Livre des Prestations & Métré ({prestationsCalculees.length})
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Ajouter un ouvrage du catalogue</span>
        </button>
      </div>

      {/* Table Typographique du Grand Livre */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-700 font-bold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-3 w-8"></th>
              <th className="py-2.5 px-3">Désignation de l'ouvrage</th>
              <th className="py-2.5 px-3 text-right">Quantité</th>
              <th className="py-2.5 px-3 text-right">Fourchette</th>
              <th className="py-2.5 px-3 text-right">Total HT</th>
              <th className="py-2.5 px-3 w-10 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {prestationsCalculees.map((calc) => {
              const isExpanded = !!expandedOuvrages[calc.occurrence.id];
              const {
                occurrence,
                sousTotalVenteHT,
                isHorsFourchette,
                hasQuantiteManquante,
                ecartFourchette,
              } = calc;
              const qte = occurrence.quantiteOuvrage;
              const fourchetteMin =
                qte && qte > 0 ? occurrence.prixVenteMin * qte : null;
              const fourchetteMax =
                qte && qte > 0 ? occurrence.prixVenteMax * qte : null;

              return (
                <React.Fragment key={occurrence.id}>
                  <tr
                    className={`hover:bg-amber-50/40 transition-colors ${
                      hasQuantiteManquante ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(occurrence.id)}
                        className="text-stone-400 hover:text-stone-800 p-1"
                        title="Déplier la décomposition matériaux / main-d'œuvre"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {occurrence.categorie}
                          </span>
                          <span className="font-bold text-stone-900 text-sm">
                            {occurrence.titre}
                          </span>
                        </div>
                        {occurrence.noteTechnique && (
                          <p className="text-[11px] text-stone-500 italic max-w-md">
                            {occurrence.noteTechnique}
                          </p>
                        )}
                        {occurrence.composants.length === 0 && onUpdateCout && (
                          <div className="inline-flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                              Coût / {occurrence.unite}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={occurrence.coutUnitaireManuel ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                onUpdateCout(occurrence.id, isNaN(val as number) ? null : val);
                              }}
                              placeholder="0,00"
                              className={`w-20 rounded-lg border px-2 py-1 text-right font-mono text-xs font-bold ${
                                occurrence.coutUnitaireManuel == null
                                  ? 'border-rose-400 bg-rose-50 text-rose-900 ring-2 ring-rose-300'
                                  : 'border-stone-300 bg-white text-stone-900 focus:border-amber-600'
                              }`}
                            />
                            <span className="text-[10px] font-bold text-stone-500">€ HT</span>
                          </div>
                        )}
                        {isHorsFourchette && fourchetteMin != null && fourchetteMax != null && (
                          <div className="text-[10px] text-amber-800 font-semibold flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <span>
                              Prix hors fourchette pour {qte} {occurrence.unite} (attendu{' '}
                              {formatCurrency(fourchetteMin)}–{formatCurrency(fourchetteMax)}) · écart{' '}
                              {formatCurrency(ecartFourchette)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Champ Quantité éditable directement dans la cellule */}
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={occurrence.quantiteOuvrage ?? ''}
                          onChange={(e) => {
                            const val =
                              e.target.value === '' ? null : parseFloat(e.target.value);
                            onUpdateQuantite(
                              occurrence.id,
                              isNaN(val as number) ? null : val
                            );
                          }}
                          placeholder="0"
                          className={`w-18 rounded-lg border px-2 py-1 text-right font-mono text-xs font-bold transition-all ${
                            hasQuantiteManquante
                              ? 'border-rose-400 bg-rose-50 text-rose-900 ring-2 ring-rose-300'
                              : 'border-stone-300 bg-white text-stone-900 focus:border-amber-600'
                          }`}
                        />
                        <span className="font-mono text-[11px] text-stone-500 font-bold">
                          {occurrence.unite}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-[11px] text-stone-500 whitespace-nowrap">
                      {formatCurrency(occurrence.prixVenteMin)} – {formatCurrency(occurrence.prixVenteMax)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-stone-800 whitespace-nowrap">
                      {formatCurrency(prixVenteUnitaireHT)} / {occurrence.unite}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-sm font-bold text-stone-900 whitespace-nowrap">
                      {formatCurrency(sousTotalVenteHT)}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onDeleteOccurrence(occurrence.id)}
                        className="text-stone-300 hover:text-rose-600 p-1 transition-colors"
                        title="Supprimer cet ouvrage"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Volet dépliable : Composants & Options techniques */}
                  {isExpanded && (
                    <tr className="bg-stone-50/70">
                      <td colSpan={7} className="p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Composants de base */}
                          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-stone-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                              Décomposition Matériaux & Main-d'œuvre
                            </span>
                            <div className="space-y-1 text-xs">
                              {occurrence.composants.length === 0 ? (
                                <p className="text-[11px] text-stone-600">
                                  Pas de décomposition catalogue. Le total HT = coût saisi × (1 + marge) × quantité.
                                </p>
                              ) : occurrence.composants.map((c) => {
                                const puVente =
                                  c.prixUnitaireAchat * (1 + tauxMarge / 100);
                                const totalVente =
                                  puVente *
                                  c.quantiteParUnite *
                                  (occurrence.quantiteOuvrage || 0);
                                return (
                                  <div
                                    key={c.id}
                                    className="flex justify-between items-center text-[11px] py-0.5 border-b border-stone-100 last:border-0"
                                  >
                                    <span className="text-stone-700">
                                      {c.nom} ({c.type === 'service' ? 'MO' : 'Matériau'}) ·{' '}
                                      {c.quantiteParUnite} {c.unite}
                                    </span>
                                    <span className="font-mono text-stone-900 font-semibold">
                                      {formatCurrency(totalVente)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Options techniques */}
                          <div className="space-y-1.5 bg-white p-3 rounded-xl border border-stone-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                              Options techniques DTU
                            </span>
                            {occurrence.options.length > 0 ? (
                              <div className="space-y-1.5 text-xs">
                                {occurrence.options.map((opt) => (
                                  <label
                                    key={opt.id}
                                    className="flex items-center justify-between text-[11px] cursor-pointer hover:bg-stone-50 p-1 rounded"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={opt.active}
                                        onChange={() =>
                                          onToggleOption(occurrence.id, opt.id)
                                        }
                                        className="h-3.5 w-3.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                                      />
                                      <span className="text-stone-800 font-medium">
                                        {opt.nom}
                                      </span>
                                    </div>
                                    <span className="font-mono text-stone-700 font-bold text-[10px]">
                                      {opt.active ? 'Activée' : 'Optionnelle'}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-stone-400 italic">
                                Aucune option additionnelle requise pour cet ouvrage.
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {prestationsCalculees.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-stone-400">
                  Le facturier est vide. Saisissez votre chantier dans l'inspecteur à gauche ou
                  ajoutez un ouvrage depuis le catalogue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
