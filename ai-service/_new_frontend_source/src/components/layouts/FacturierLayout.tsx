import React, { useState } from 'react';
import { Zone1Input } from '../Zone1Input';
import { AddPrestationModal } from '../AddPrestationModal';
import { MarginGauge } from '../common/MarginGauge';
import {
  QuoteCalculation,
  PrestationOccurrence,
  CalculatedPrestation,
  ClientInfo,
} from '../../types/quote';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import {
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Send,
  Save,
  Eye,
  FileCheck,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Camera,
  Mic,
  PenTool,
} from 'lucide-react';

interface FacturierLayoutProps {
  onGenerateFromText: (prompt: string, surface?: number, piece?: string) => void;
  isLoading: boolean;
  activePrestationsCount: number;
  calculation: QuoteCalculation;
  tauxMarge: number;
  tauxTVA: number;
  clientInfo: ClientInfo;
  onUpdateClientInfo: (info: ClientInfo) => void;
  onUpdateTauxMarge: (marge: number) => void;
  onUpdateQuantite: (id: string, qte: number | null) => void;
  onUpdateCout: (id: string, cout: number | null) => void;
  onToggleOption: (occId: string, optId: string) => void;
  onDeleteOccurrence: (id: string) => void;
  onAddPrestation: (prestationId: number) => void;
  onChangeTauxTVA: (tva: number) => void;
  onSendToClient: () => void;
  onSaveDraft: () => void;
  onOpenPreview: () => void;
  isSavingDraft: boolean;
}

export const FacturierLayout: React.FC<FacturierLayoutProps> = (props) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedOuvrages, setExpandedOuvrages] = useState<Record<string, boolean>>({});
  const [activeSidePanel, setActiveSidePanel] = useState<'capture' | 'client'>('capture');

  const {
    prestationsCalculees,
    totalVenteHT,
    totalCoutHT,
    margeBrute,
    tauxMarqueCalcule,
    statutMarque,
    totalTTC,
    montantTVA,
    peutEnvoyerDevis,
    motifsRefusEnvoi,
  } = props.calculation;

  const toggleExpand = (id: string) => {
    setExpandedOuvrages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full space-y-6">
      {/* En-tête de la vue Facturier d'Artisan */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-amber-800 uppercase font-bold flex items-center gap-1.5">
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
              Le Facturier & Tampon Métreur
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </span>
          <h2 className="text-lg font-bold text-stone-900 mt-1">
            Bordereau Typographique & Inspection : Chiffrage haute précision avec validation en ligne
          </h2>
        </div>

        {/* Action bar rapide */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onSaveDraft}
            disabled={props.isSavingDraft}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:text-stone-950 hover:bg-stone-50 shadow-2xs transition-all"
          >
            <Save className="h-3.5 w-3.5 text-amber-700" />
            <span>Sauvegarder</span>
          </button>

          <button
            type="button"
            onClick={props.onSendToClient}
            disabled={!peutEnvoyerDevis}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm ${
              peutEnvoyerDevis
                ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-amber-600/20'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Envoyer au client</span>
          </button>
        </div>
      </div>

      {/* Disposition principale : Inspecteur à gauche, Grand Livre à droite */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche (4 cols) : Inspecteur multi-modal & Fiche Chantier */}
        <div className="xl:col-span-4 space-y-4">
          {/* Sélecteur de volet inspecteur */}
          <div className="flex items-center rounded-xl bg-stone-100 p-1 border border-stone-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSidePanel('capture')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                activeSidePanel === 'capture'
                  ? 'bg-white text-stone-900 shadow-xs text-amber-800'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              1. Ingestion Multi-modale
            </button>
            <button
              type="button"
              onClick={() => setActiveSidePanel('client')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                activeSidePanel === 'client'
                  ? 'bg-white text-stone-900 shadow-xs text-amber-800'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              2. Fiche Chantier & Client
            </button>
          </div>

          {activeSidePanel === 'capture' ? (
            <Zone1Input
              onGenerateFromText={props.onGenerateFromText}
              isLoading={props.isLoading}
              activePrestationsCount={props.activePrestationsCount}
            />
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
                <Building2 className="h-4 w-4 text-amber-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Détails du chantier contractuel
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                    Client :
                  </label>
                  <input
                    type="text"
                    value={props.clientInfo.nom}
                    onChange={(e) => props.onUpdateClientInfo({ ...props.clientInfo, nom: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:bg-white focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                    Lieu d'intervention :
                  </label>
                  <input
                    type="text"
                    value={props.clientInfo.lieuChantier}
                    onChange={(e) => props.onUpdateClientInfo({ ...props.clientInfo, lieuChantier: e.target.value })}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-800 focus:bg-white focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                      Numéro devis :
                    </label>
                    <span className="font-mono text-xs font-bold text-amber-800 block bg-stone-50 p-2 rounded-lg border border-stone-200">
                      {props.clientInfo.numeroDevis}
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                      Date d'émission :
                    </label>
                    <span className="font-mono text-xs text-stone-700 block bg-stone-50 p-2 rounded-lg border border-stone-200">
                      {props.clientInfo.dateEmission}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Décennale AXA Activer</span>
                  </span>
                  <span>DTU Certifiés</span>
                </div>
              </div>
            </div>
          )}

          {/* Tampon Encreur Officiel Artisanal */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-600/80 bg-amber-50/50 text-amber-800 rotate-[-12deg] shadow-xs">
              <div className="text-center font-mono">
                <span className="text-[8px] font-bold uppercase tracking-wider block">DTU 2026</span>
                <span className="text-[11px] font-black uppercase tracking-tight block">RGE</span>
                <span className="text-[7px] block">CONFORME</span>
              </div>
            </div>
            <div className="text-xs space-y-0.5">
              <h4 className="font-bold text-stone-900">Cachet Numérique de l'Atelier</h4>
              <p className="text-stone-500 text-[11px]">
                Validation des règles de l'art du bâtiment (NF P03-001) et vérification de marge en direct.
              </p>
            </div>
          </div>
        </div>

        {/* Colonne Droite (8 cols) : Grand Livre Typographique des Ouvrages */}
        <div className="xl:col-span-8 space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            {/* Barre de contrôle du Facturier */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50/80 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800">
                  Grand Livre des Prestations & Métré ({prestationsCalculees.length})
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Taux de marge rapide */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-stone-500 font-bold">Marge :</span>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="0.5"
                    value={props.tauxMarge}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      props.onUpdateTauxMarge(isNaN(val) ? 0 : val);
                    }}
                    className="w-14 rounded-lg border border-stone-300 bg-white px-2 py-0.5 text-right font-mono text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                  <span className="text-stone-500 font-bold">%</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ajouter un ouvrage</span>
                </button>
              </div>
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
                    const { occurrence, sousTotalVenteHT, isHorsFourchette, hasQuantiteManquante, ecartFourchette } = calc;
                    const qte = occurrence.quantiteOuvrage;
                    const fourchetteMin = qte && qte > 0 ? occurrence.prixVenteMin * qte : null;
                    const fourchetteMax = qte && qte > 0 ? occurrence.prixVenteMax * qte : null;

                    return (
                      <React.Fragment key={occurrence.id}>
                        <tr className={`hover:bg-amber-50/40 transition-colors ${hasQuantiteManquante ? 'bg-rose-50/40' : ''}`}>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(occurrence.id)}
                              className="text-stone-400 hover:text-stone-800 p-1"
                              title="Déplier la décomposition matériaux / main-d'œuvre"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                              {occurrence.composants.length === 0 && (
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
                                      props.onUpdateCout(occurrence.id, isNaN(val as number) ? null : val);
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
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  props.onUpdateQuantite(occurrence.id, isNaN(val as number) ? null : val);
                                }}
                                placeholder="0"
                                className={`w-18 rounded-lg border px-2 py-1 text-right font-mono text-xs font-bold transition-all ${
                                  hasQuantiteManquante
                                    ? 'border-rose-400 bg-rose-50 text-rose-900 ring-2 ring-rose-300'
                                    : 'border-stone-300 bg-white text-stone-900 focus:border-amber-600'
                                }`}
                              />
                              <span className="font-mono text-[11px] text-stone-500 font-bold">{occurrence.unite}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-[11px] text-stone-500 whitespace-nowrap">
                            {fourchetteMin != null && fourchetteMax != null
                              ? `${formatCurrency(fourchetteMin)} – ${formatCurrency(fourchetteMax)}`
                              : '—'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-sm font-bold text-stone-900 whitespace-nowrap">
                            {formatCurrency(sousTotalVenteHT)}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => props.onDeleteOccurrence(occurrence.id)}
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
                            <td colSpan={6} className="p-4 space-y-3">
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
                                      const puVente = c.prixUnitaireAchat * (1 + props.tauxMarge / 100);
                                      const totalVente = puVente * c.quantiteParUnite * (occurrence.quantiteOuvrage || 0);
                                      return (
                                        <div key={c.id} className="flex justify-between items-center text-[11px] py-0.5 border-b border-stone-100 last:border-0">
                                          <span className="text-stone-700">
                                            {c.nom} ({c.type === 'service' ? 'MO' : 'Matériau'}) · {c.quantiteParUnite} {c.unite}
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
                                              onChange={() => props.onToggleOption(occurrence.id, opt.id)}
                                              className="h-3.5 w-3.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                                            />
                                            <span className="text-stone-800 font-medium">{opt.nom}</span>
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
                      <td colSpan={6} className="py-12 text-center text-xs text-stone-400">
                        Le facturier est vide. Saisissez votre chantier dans l'inspecteur à gauche ou ajoutez un ouvrage depuis le catalogue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pied du Facturier : Synthèse et Baromètre de Marge */}
            <div className="p-5 bg-stone-50 border-t border-stone-200 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <MarginGauge calculation={props.calculation} />
                </div>

                <div className="text-right space-y-1 bg-white p-3.5 rounded-xl border border-stone-200 min-w-56 shadow-2xs">
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>Total HT :</span>
                    <span className="font-mono font-bold text-stone-900">{formatCurrency(totalVenteHT)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>TVA ({props.tauxTVA}%) :</span>
                    <span className="font-mono font-bold text-stone-900">{formatCurrency(montantTVA)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black text-stone-950 pt-1.5 border-t border-stone-200">
                    <span>TOTAL TTC :</span>
                    <span className="font-mono text-xl text-amber-800">{formatCurrency(totalTTC)}</span>
                  </div>
                </div>
              </div>

              {/* Barre de boutons d'action rapide */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={props.onOpenPreview}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-2xs"
                >
                  <Eye className="h-4 w-4" />
                  <span>Aperçu PDF & Signature Tactile</span>
                </button>

                <button
                  type="button"
                  onClick={props.onSendToClient}
                  disabled={!peutEnvoyerDevis}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                    peutEnvoyerDevis
                      ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-amber-600/20'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-200'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  <span>Émettre & Envoyer au client</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddPrestationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddPrestation={props.onAddPrestation}
      />
    </div>
  );
};
