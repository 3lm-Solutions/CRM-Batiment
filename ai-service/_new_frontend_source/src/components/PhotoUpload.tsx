import React, { useState, useRef } from 'react';
import { Upload, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Sparkles, Image as ImageIcon, MapPin, Layers, Ruler } from 'lucide-react';
import { PhotoAnalysisResult } from '../types/quote';
import { SAMPLE_PHOTOS, SamplePhoto } from '../data/samples';

interface PhotoUploadProps {
  onValidateAnalysis: (analysis: PhotoAnalysisResult) => void;
  isLoading: boolean;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onValidateAnalysis,
  isLoading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customSurface, setCustomSurface] = useState<number | null>(null);
  const [gradioMeasurementUrl, setGradioMeasurementUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openGradioMeasurement = async (file: File) => {
    // La fenêtre est ouverte pendant le geste utilisateur afin d'éviter le blocage par le navigateur.
    const measurementWindow = window.open('', 'devis-ia-photo-metre');
    if (measurementWindow) {
      measurementWindow.document.title = 'Chargement de la mesure photographique...';
      measurementWindow.document.body.innerHTML = '<p style="font-family:system-ui;padding:2rem">Chargement de la photo dans Gradio...</p>';
    }

    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/photo/mesure-gradio/session', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== 'string') {
        throw new Error(payload.detail || 'Impossible d’ouvrir la mesure photographique Gradio.');
      }
      const url = new URL(payload.url, window.location.origin).toString();
      setGradioMeasurementUrl(url);
      if (measurementWindow) {
        measurementWindow.location.replace(url);
      } else {
      }
    } catch (reason) {
      measurementWindow?.close();
      console.warn('Ouverture Gradio impossible :', reason);
    }
  };

  // Validation client-side stricte (image/jpeg, image/png, max 10 Mo)
  const validateAndProcessFile = (file: File) => {
    setErrorMessage(null);
    setGradioMeasurementUrl(null);
    setAnalysisResult(null);

    const allowedTypes = ['image/jpeg', 'image/png'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 Mo

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(
        `Format de fichier invalide ("${file.type || 'inconnu'}"). Formats acceptés : JPEG ou PNG uniquement.`
      );
      return;
    }

    if (file.size > maxSizeBytes) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        `Fichier trop volumineux (${sizeMB} Mo). La taille maximale autorisée est de 10 Mo.`
      );
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // La mesure avec le rectangle noir ne dépend pas du fournisseur Vision.
    // Cette fiche minimale permet donc de continuer même si l'API Vision échoue.
    setAnalysisResult({
      imageUrl: objectUrl,
      fileName: file.name,
      fileSize: file.size,
      piece: 'Photo de chantier à préciser',
      surfaceEstimee: 0,
      surfaceConfidence: 0,
      materiaux: [],
      etatDesLieux: 'Mesure photographique disponible ; analyse Vision en cours.',
      travauxSuggere: [],
    });
    setCustomSurface(0);

    void openGradioMeasurement(file);
    // Déclencher l'analyse vision
    runVisionAnalysis(file, objectUrl);
  };

  const runVisionAnalysis = async (file: File, objectUrl: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const form = new FormData();
      form.append('file', file);
      try {
          const res = await fetch('/api/photo/analyser', { method: 'POST', body: form });

          if (!res.ok) {
            throw new Error('Erreur lors du traitement vision');
          }

          const data = await res.json();
          const result: PhotoAnalysisResult = {
            imageUrl: objectUrl,
            fileName: file.name,
            fileSize: file.size,
            piece: data.type_piece || 'Pièce non identifiée',
            surfaceEstimee: data.surface_estimee_m2 ?? 0,
            surfaceConfidence: data.confidence_surface ?? 0,
            materiaux: data.materiaux_identifies || [],
            etatDesLieux: data.reference_visible ? 'Référence visuelle détectée.' : '',
            travauxSuggere: data.materiaux_identifies || [],
          };

          setAnalysisResult(result);
          setCustomSurface(result.surfaceEstimee);
      } catch (apiErr) {
        console.warn('Analyse Vision indisponible :', apiErr);
      } finally { setIsAnalyzing(false); }
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      console.warn('Analyse Vision indisponible :', err);
    }
  };

  const handleSelectSample = (sample: SamplePhoto) => {
    setErrorMessage(null);
    setSelectedFile(null);
    setPreviewUrl(sample.imagePath);

    const result: PhotoAnalysisResult = {
      imageUrl: sample.imagePath,
      fileName: `${sample.id}.jpg`,
      fileSize: 1024 * 750,
      piece: sample.piece,
      surfaceEstimee: sample.surfaceEstimee,
      surfaceConfidence: sample.surfaceConfidence,
      materiaux: sample.materiaux,
      etatDesLieux: sample.etatDesLieux,
      travauxSuggere: sample.travauxSuggere,
    };

    setAnalysisResult(result);
    setCustomSurface(result.surfaceEstimee);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleValidate = () => {
    if (!analysisResult) return;
    const finalResult = {
      ...analysisResult,
      surfaceEstimee: customSurface !== null ? customSurface : analysisResult.surfaceEstimee,
    };
    onValidateAnalysis(finalResult);
  };

  return (
    <div className="space-y-4">
      {/* Zone de glisser-déposer style table lumineuse */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all ${
          isDragging
            ? 'border-amber-500 bg-amber-50/80 shadow-md'
            : 'border-stone-300 bg-white hover:border-amber-400 hover:bg-stone-50/60 shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              validateAndProcessFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center text-center gap-2 max-w-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 shadow-xs">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900">
              Déposez la photo ou le plan du chantier ici, ou{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-amber-700 hover:text-amber-800 font-bold underline underline-offset-2"
              >
                parcourez vos fichiers
              </button>
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Contraintes : formats <strong className="text-stone-700">JPEG</strong> ou <strong className="text-stone-700">PNG</strong>, taille max <strong className="text-stone-700">10 Mo</strong>
            </p>
          </div>
        </div>

        {/* Échantillons rapides pour test direct sans upload */}
        <div className="mt-4 pt-3 border-t border-stone-100 w-full flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-[11px] text-stone-500 font-medium">Chantiers témoins :</span>
          {SAMPLE_PHOTOS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 border border-stone-200 text-xs font-medium transition-colors"
            >
              <ImageIcon className="h-3 w-3 text-amber-600" />
              <span>{sample.titre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Message d'erreur immédiat côté client */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-bold text-rose-900">Validation du fichier échouée</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {previewUrl && selectedFile && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-700">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Mesure photographique dans Gradio</h3>
              <p className="mt-0.5 text-xs text-stone-600">La photo est ouverte dans l'interface de mesure du notebook : rectangle noir, quatre clics et aperçu du contour.</p>
            </div>
          </div>
          {gradioMeasurementUrl && (
            <a href={gradioMeasurementUrl} target="devis-ia-photo-metre" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800">
              <Ruler className="h-3.5 w-3.5" /> Ouvrir Gradio
            </a>
          )}
        </section>
      )}

      {/* Indicateur de chargement de l'analyse vision */}
      {isAnalyzing && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-sm text-stone-800 shadow-xs">
          <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
          <span className="font-medium">Analyse métrique et détection des matériaux en cours...</span>
        </div>
      )}

      {/* Aperçu immédiat et Zone d'analyse d'architecte */}
      {previewUrl && !isAnalyzing && analysisResult && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Aperçu de la photo de chantier avec pins interactifs */}
            <div className="relative w-full md:w-60 h-44 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-inner group">
              <img
                src={previewUrl}
                alt="Chantier uploadé"
                className="w-full h-full object-cover transition-transform group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-stone-900/80 text-[10px] font-mono text-white backdrop-blur-xs">
                Photo Chantier
              </div>
              {/* Tag visuel superposé */}
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-amber-700/90 text-[10px] font-bold text-white shadow-xs">
                {analysisResult.piece}
              </div>
            </div>

            {/* Détails détectés par l'analyse vision */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
                    Corps d'état identifié
                  </span>
                  <div className="inline-flex items-center gap-2 mt-0.5 text-base font-bold text-stone-900">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                    {analysisResult.piece}
                  </div>
                </div>

                {/* Surface estimée avec avertissement si confidence < 0.7 */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <span className="font-medium">Surface métrée</span>
                    {analysisResult.surfaceConfidence < 0.7 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold" title={`Confiance faible (${Math.round(analysisResult.surfaceConfidence * 100)}%)`}>
                        <AlertTriangle className="h-3 w-3 text-amber-700" />
                        <span>Confiance &lt; 70%</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{Math.round(analysisResult.surfaceConfidence * 100)}%</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={customSurface !== null ? customSurface : analysisResult.surfaceEstimee}
                      onChange={(e) => setCustomSurface(parseFloat(e.target.value) || 0)}
                      className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm font-mono font-bold text-stone-900 focus:border-amber-600 focus:outline-none shadow-inner"
                    />
                    <span className="text-xs font-bold text-stone-500 font-mono">m² d'ouvrage</span>
                  </div>
                </div>
              </div>

              {/* Matériaux identifiés sous forme d'échantillons visuels */}
              <div>
                <span className="text-[11px] font-bold text-stone-600 block mb-1.5">
                  Éléments & Matériaux reconnus sur site :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.materiaux.map((mat, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-lg bg-stone-100 border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-800"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-600 mr-1.5" />
                      {mat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Constat technique */}
              {analysisResult.etatDesLieux && (
                <p className="text-xs text-stone-600 italic bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                  Note d'expertise : {analysisResult.etatDesLieux}
                </p>
              )}
            </div>
          </div>

          {/* Bouton Valider -> Edit Devis */}
          <div className="flex justify-end pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={handleValidate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Calcul des bordereaux...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Valider → Générer les lignes de devis</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

