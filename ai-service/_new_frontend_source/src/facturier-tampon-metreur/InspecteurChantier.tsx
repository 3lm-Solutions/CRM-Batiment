import React, { useState } from 'react';
import { Zone1Input } from '../components/Zone1Input';
import { ClientInfo } from '../types/quote';
import { Building2, Sparkles, ShieldCheck, MapPin, Calendar, FileText } from 'lucide-react';

interface InspecteurChantierProps {
  onGenerateFromText: (prompt: string, surface?: number, piece?: string) => void;
  isLoading: boolean;
  activePrestationsCount: number;
  clientInfo: ClientInfo;
  onUpdateClientInfo: (info: ClientInfo) => void;
}

export const InspecteurChantier: React.FC<InspecteurChantierProps> = ({
  onGenerateFromText,
  isLoading,
  activePrestationsCount,
  clientInfo,
  onUpdateClientInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'capture' | 'dossier'>('capture');

  return (
    <div className="space-y-4">
      {/* Sélecteur de volet inspecteur */}
      <div className="flex items-center rounded-xl bg-stone-100 p-1 border border-stone-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('capture')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            activeTab === 'capture'
              ? 'bg-white text-stone-900 shadow-xs text-amber-800'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          1. Ingestion Multi-modale
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dossier')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            activeTab === 'dossier'
              ? 'bg-white text-stone-900 shadow-xs text-amber-800'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          2. Fiche Chantier & Client
        </button>
      </div>

      {activeTab === 'capture' ? (
        <Zone1Input
          onGenerateFromText={onGenerateFromText}
          isLoading={isLoading}
          activePrestationsCount={activePrestationsCount}
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
                Client Maître d'Ouvrage :
              </label>
              <input
                type="text"
                value={clientInfo.nom}
                onChange={(e) => onUpdateClientInfo({ ...clientInfo, nom: e.target.value })}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:bg-white focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                Adresse d'exécution des travaux :
              </label>
              <input
                type="text"
                value={clientInfo.lieuChantier}
                onChange={(e) => onUpdateClientInfo({ ...clientInfo, lieuChantier: e.target.value })}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-800 focus:bg-white focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Numéro devis :
                </label>
                <span className="font-mono text-xs font-bold text-amber-800 block bg-stone-50 p-2 rounded-lg border border-stone-200">
                  {clientInfo.numeroDevis}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Date d'émission :
                </label>
                <span className="font-mono text-xs text-stone-700 block bg-stone-50 p-2 rounded-lg border border-stone-200">
                  {clientInfo.dateEmission}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Garantie AXA Décennale</span>
              </span>
              <span>Validité {clientInfo.validiteMois} mois</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
