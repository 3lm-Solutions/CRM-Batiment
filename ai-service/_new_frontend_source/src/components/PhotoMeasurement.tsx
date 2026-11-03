import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, MousePointer2, RotateCcw, Ruler } from 'lucide-react';

interface MeasurementResult {
  width_cm: number;
  height_cm: number;
  surface_m2: number;
  reference_detection: {
    threshold: number;
    rectangularity: number;
    ratio: number;
  };
}

interface PhotoMeasurementProps {
  file: File;
  previewUrl: string;
  onUseSurface: (surfaceM2: number) => void;
}

export const PhotoMeasurement: React.FC<PhotoMeasurementProps> = ({
  file,
  previewUrl,
  onUseSurface,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [referenceWidth, setReferenceWidth] = useState(22);
  const [referenceHeight, setReferenceHeight] = useState(17.8);
  const [points, setPoints] = useState<number[][]>([]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [result, setResult] = useState<MeasurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const selectPoint = (event: React.MouseEvent<HTMLImageElement>) => {
    if (points.length >= 4 || !imageRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) * imageRef.current.naturalWidth) / bounds.width;
    const y = ((event.clientY - bounds.top) * imageRef.current.naturalHeight) / bounds.height;
    setPoints((previous) => [...previous, [Math.round(x), Math.round(y)]]);
    setResult(null);
    setError(null);
  };

  const reset = () => {
    setPoints([]);
    setResult(null);
    setError(null);
  };

  const calculate = async () => {
    if (points.length !== 4) {
      setError('Sélectionnez les quatre coins de l’élément : haut gauche, haut droit, bas droit, bas gauche.');
      return;
    }
    if (referenceWidth <= 0 || referenceHeight <= 0) {
      setError('Les dimensions du rectangle noir doivent être strictement positives.');
      return;
    }

    setIsCalculating(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('reference_width_cm', String(referenceWidth));
      form.append('reference_height_cm', String(referenceHeight));
      form.append('target_points_json', JSON.stringify(points));
      const response = await fetch('/api/photo/mesurer', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Calcul de mesure impossible.');
      }
      setResult(payload as MeasurementResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Calcul de mesure impossible.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-700">
          <Ruler className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-stone-900">Métré avec rectangle de référence</h3>
          <p className="mt-0.5 text-xs text-stone-600">
            Posez le rectangle noir sur le même plan que l’élément, saisissez ses dimensions réelles puis cliquez les quatre coins de l’élément à mesurer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-sky-100 bg-white p-3">
        <label className="text-xs font-bold text-stone-700">
          Largeur du rectangle noir (cm)
          <input type="number" min="0.01" step="0.1" value={referenceWidth}
            onChange={(event) => setReferenceWidth(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:border-sky-600 focus:outline-none" />
        </label>
        <label className="text-xs font-bold text-stone-700">
          Hauteur du rectangle noir (cm)
          <input type="number" min="0.01" step="0.1" value={referenceHeight}
            onChange={(event) => setReferenceHeight(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:border-sky-600 focus:outline-none" />
        </label>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-stone-300 bg-stone-100">
        <img ref={imageRef} src={previewUrl} alt="Photo à mesurer" onClick={selectPoint}
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          className="block max-h-[440px] w-full cursor-crosshair object-contain" />
        {imageSize.width > 0 && points.length >= 2 && (
          <svg
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <polyline
              points={(points.length === 4 ? [...points, points[0]] : points)
                .map(([x, y]) => `${x},${y}`)
                .join(' ')}
              fill={points.length === 4 ? 'rgba(14, 165, 233, 0.15)' : 'none'}
              stroke="#0284c7"
              strokeWidth={Math.max(imageSize.width, imageSize.height) / 350}
              strokeLinejoin="round"
            />
          </svg>
        )}
        {imageSize.width > 0 && points.map(([x, y], index) => (
          <span key={`${x}-${y}-${index}`} style={{ left: `${(x / imageSize.width) * 100}%`, top: `${(y / imageSize.height) * 100}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-sky-600 text-xs font-black text-white shadow-md">
            {index + 1}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
          <MousePointer2 className="h-4 w-4 text-sky-700" />
          {points.length}/4 coins sélectionnés — ordre : HG, HD, BD, BG.
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2 font-bold text-stone-700 hover:bg-stone-100">
            <RotateCcw className="h-3.5 w-3.5" /> Recommencer
          </button>
          <button type="button" onClick={calculate} disabled={isCalculating}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-3 py-2 font-bold text-white hover:bg-sky-800 disabled:opacity-50">
            {isCalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ruler className="h-3.5 w-3.5" />}
            Calculer les dimensions
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-emerald-950">
            <p className="font-bold">Mesure calculée : {result.width_cm} cm × {result.height_cm} cm</p>
            <p className="mt-0.5">Surface : <strong>{result.surface_m2} m²</strong> · Rectangle de référence détecté.</p>
          </div>
          <button type="button" onClick={() => onUseSurface(result.surface_m2)}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Utiliser comme surface du devis
          </button>
        </div>
      )}
    </section>
  );
};
