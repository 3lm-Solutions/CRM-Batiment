import React, { useState } from 'react';
import {
  QuoteCalculation,
  PrestationOccurrence,
  ClientInfo,
} from '../types/quote';
import { formatCurrency } from '../utils/calculations';
import { InspecteurChantier } from './InspecteurChantier';
import { TamponEncreurMetreur } from './TamponEncreurMetreur';
import { GrandLivreBordereau } from './GrandLivreBordereau';
import { BarometreMargeRuler } from './BarometreMargeRuler';
import { AddPrestationModal } from '../components/AddPrestationModal';
import {
  Send,
  Save,
  Eye,
  Building2,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';

export interface FacturierViewProps {
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
  onToggleOption: (occId: string, optId: string) => void;
  onDeleteOccurrence: (id: string) => void;
  onAddPrestation: (prestation: PrestationOccurrence) => void;
  onChangeTauxTVA: (tva: number) => void;
  onSendToClient: () => void;
  onSaveDraft: () => void;
  onOpenPreview: () => void;
  isSavingDraft: boolean;
}

export const FacturierView: React.FC<FacturierViewProps> = (props) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const {
    prestationsCalculees,
    totalVenteHT,
    totalTTC,
    montantTVA,
    peutEnvoyerDevis,
    statutMarque,
  } = props.calculation;

  return (
    <div className="w-full space-y-6">
      {/* En-tête de la vue Facturier d'Artisan */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-amber-800 uppercase font-bold flex items-center gap-1.5">
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
              Look 3 · Le Facturier & Tampon Métreur
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
        {/* Colonne Gauche (4 cols) : Inspecteur multi-modal + Tampon interactif */}
        <div className="xl:col-span-4 space-y-4">
          <InspecteurChantier
            onGenerateFromText={props.onGenerateFromText}
            isLoading={props.isLoading}
            activePrestationsCount={props.activePrestationsCount}
            clientInfo={props.clientInfo}
            onUpdateClientInfo={props.onUpdateClientInfo}
          />

          {/* Tampon Encreur Métreur Officiel */}
          <TamponEncreurMetreur
            numeroDevis={props.clientInfo.numeroDevis}
            isConforme={statutMarque === 'VALIDE'}
            dateTampon={props.clientInfo.dateEmission}
          />
        </div>

        {/* Colonne Droite (8 cols) : Grand Livre Typographique des Ouvrages */}
        <div className="xl:col-span-8 space-y-4">
          <GrandLivreBordereau
            prestationsCalculees={prestationsCalculees}
            tauxMarge={props.tauxMarge}
            onUpdateQuantite={props.onUpdateQuantite}
            onToggleOption={props.onToggleOption}
            onDeleteOccurrence={props.onDeleteOccurrence}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />

          {/* Règle Baromètre de Marge & Synthèse financière */}
          <BarometreMargeRuler
            calculation={props.calculation}
            tauxMarge={props.tauxMarge}
            onUpdateTauxMarge={props.onUpdateTauxMarge}
            tauxTVA={props.tauxTVA}
          />

          {/* Pied du Facturier : Synthèse et validation finale */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-stone-500 block font-medium">Total Chiffré HT</span>
                <span className="font-mono font-bold text-stone-900 text-sm">
                  {formatCurrency(totalVenteHT)}
                </span>
              </div>
              <div className="h-6 w-px bg-stone-200" />
              <div>
                <span className="text-stone-500 block font-medium">Net à Payer TTC</span>
                <span className="font-mono font-black text-amber-800 text-lg">
                  {formatCurrency(totalTTC)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={props.onOpenPreview}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <Eye className="h-4 w-4" />
                <span>Format A4 / PDF</span>
              </button>

              <button
                type="button"
                onClick={props.onSendToClient}
                disabled={!peutEnvoyerDevis}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm ${
                  peutEnvoyerDevis
                    ? 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-amber-600/20'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
                }`}
              >
                <Send className="h-4 w-4" />
                <span>Émettre & Envoyer</span>
              </button>
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
