import React, { useState } from 'react';
import { Type, Camera, Mic, Sparkles, Loader2, ArrowRight, BookOpen, PenTool, CheckCircle } from 'lucide-react';
import { PhotoUpload } from './PhotoUpload';
import { VoiceRecorder } from './VoiceRecorder';
import { PhotoAnalysisResult } from '../types/quote';
import { SAMPLE_TEXTS, SampleText } from '../data/samples';

export type InputTab = 'texte' | 'photo' | 'vocal';

interface Zone1InputProps {
  onGenerateFromText: (prompt: string, surface?: number, piece?: string) => void;
  isLoading: boolean;
  activePrestationsCount: number;
}

export const Zone1Input: React.FC<Zone1InputProps> = ({
  onGenerateFromText,
  isLoading,
  activePrestationsCount,
}) => {
  const [activeTab, setActiveTab] = useState<InputTab>('texte');
  const [textContent, setTextContent] = useState('');

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim() || isLoading) return;
    onGenerateFromText(textContent);
  };

  const handleSelectSample = (sample: SampleText) => {
    setTextContent(sample.texte);
  };

  const handlePhotoValidated = (analysis: PhotoAnalysisResult) => {
    const synthesizedPrompt = `Chantier ${analysis.piece}. Surface à traiter : ${analysis.surfaceEstimee} m². Matériaux identifiés : ${analysis.materiaux.join(', ')}. Travaux à chiffrer : ${analysis.travauxSuggere.join(', ')}. Observation : ${analysis.etatDesLieux}`;
    onGenerateFromText(synthesizedPrompt, analysis.surfaceEstimee, analysis.piece);
  };

  const handleVoiceValidated = (transcript: string) => {
    onGenerateFromText(transcript);
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs relative overflow-hidden">
      {/* En-tête style atelier métreur */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-700 block">
            Phase 1 · Saisie Multi-Modale In-Situ
          </span>
          <h2 className="text-base md:text-lg font-black text-stone-900 mt-0.5">
            Ingestion & Relevé du Besoin Chantier
          </h2>
        </div>

        {/* Sélecteur d'onglets (Texte / Photo / Vocal) en blanc cassé et ambre */}
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200 self-stretch sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('texte')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'texte'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80 text-amber-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Type className="h-3.5 w-3.5 text-amber-700" />
            <span>Texte Libre</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'photo'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80 text-amber-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Camera className="h-3.5 w-3.5 text-amber-700" />
            <span>Photo / Plan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vocal')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'vocal'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80 text-amber-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Mic className="h-3.5 w-3.5 text-amber-700" />
            <span>Dictée Vocale</span>
          </button>
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="pt-4">
        {/* Onglet 1: Texte */}
        {activeTab === 'texte' && (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="travaux-description"
                  className="text-xs font-bold text-stone-800"
                >
                  Description des travaux & prestations souhaitées :
                </label>
                <span className="text-[11px] text-stone-500 font-mono">
                  Métrés, pièces, matériaux, contraintes DTU
                </span>
              </div>
              <textarea
                id="travaux-description"
                rows={4}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Décrivez les travaux à réaliser (ex: Rénovation salle de bain 9m², pose de carrelage 60x60 avec plinthes, receveur de douche extra-plat 120x80 et peinture velours)..."
                className="w-full rounded-xl border border-stone-300 bg-stone-50/70 p-4 text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-amber-600 focus:outline-none transition-colors shadow-inner"
              />
            </div>

            {/* Scénarios métiers pré-remplis en pilules claires */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 font-bold mr-1">
                <BookOpen className="h-3 w-3 text-amber-700" />
                Dossiers types :
              </span>
              {SAMPLE_TEXTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className="text-xs rounded-lg border border-stone-200 bg-stone-100/80 px-3 py-1.5 text-stone-700 hover:border-amber-400 hover:bg-white hover:text-stone-900 transition-all font-medium shadow-2xs"
                >
                  {sample.titre}
                </button>
              ))}
            </div>

            {/* Bouton de génération de devis RAG */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <div className="text-xs text-stone-500">
                {activePrestationsCount > 0 ? (
                  <span>
                    Chiffrage actif : <strong className="text-stone-900 font-bold">{activePrestationsCount}</strong> prestation{activePrestationsCount > 1 ? 's' : ''} en cours
                  </span>
                ) : (
                  <span>Alimente le moteur d'estimation RAG et extrait le bordereau</span>
                )}
              </div>

              <button
                type="submit"
                disabled={!textContent.trim() || isLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Extraction du bordereau...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Générer le devis</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Onglet 2: Photo */}
        {activeTab === 'photo' && (
          <PhotoUpload
            onValidateAnalysis={handlePhotoValidated}
            isLoading={isLoading}
          />
        )}

        {/* Onglet 3: Vocal */}
        {activeTab === 'vocal' && (
          <VoiceRecorder
            onValidateTranscript={handleVoiceValidated}
            isLoading={isLoading}
          />
        )}
      </div>
    </section>
  );
};

