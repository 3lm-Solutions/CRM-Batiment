import { LoaderCircle, Mic, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { DUREE_MAX_S, formatDuree, useEnregistrement } from './useEnregistrement';

/**
 * « Dicter » (29/10): records the voice, sends it to the server (Whisper), and hands back the text
 * — which stays editable. `transcrire` is the call to the server (it knows the quote).
 */
export function BoutonDictee({
  onTexte,
  transcrire,
  disabled,
  demarrerAuto,
}: {
  onTexte: (texte: string) => void;
  transcrire: { mutate: (audio: Blob, opts: { onSuccess: (r: { texte: string }) => void; onError: (e: unknown) => void }) => void; isPending: boolean };
  disabled?: boolean;
  demarrerAuto?: boolean;
}) {
  /** Error of the server (transcription), shown with the recording's own errors */
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const rec = useEnregistrement((audio) => {
    setErreurServeur(null);
    transcrire.mutate(audio, {
      onSuccess: (r) => onTexte(r.texte),
      onError: (e) => setErreurServeur(errorMessage(e)),
    });
  });

  // Opened with « Dicter le devis »: start recording right away
  useEffect(() => {
    if (!demarrerAuto) return;
    // Deferred: in development React mounts twice, and a mic opened then closed at once stays off
    const t = setTimeout(() => void rec.demarrer(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rec.supporte) {
    return <p className="text-xs text-slate-500">Enregistrement vocal indisponible dans ce navigateur : tapez la description.</p>;
  }
  const enCours = rec.etat === 'enregistre';
  const transcription = transcrire.isPending;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={enCours ? 'danger' : 'outline'}
          icon={transcription ? <LoaderCircle className="size-4 animate-spin" /> : enCours ? <Square className="size-4" /> : <Mic className="size-4 text-red-600" />}
          disabled={disabled || transcription}
          onClick={() => {
            if (enCours) return rec.arreter();
            setErreurServeur(null);
            void rec.demarrer();
          }}
          aria-pressed={enCours}
        >
          {transcription ? 'Transcription…' : enCours ? 'Terminer' : 'Dicter'}
        </Button>
        {enCours && (
          <span className="flex items-center gap-2 text-xs font-medium text-red-600" role="status">
            <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden />
            J’enregistre… {formatDuree(rec.secondes)} / {formatDuree(DUREE_MAX_S)} — parlez normalement, puis « Terminer »
          </span>
        )}
        {transcription && <span className="text-xs text-slate-500" role="status">Le texte arrive dans le champ dans quelques secondes…</span>}
      </div>
      {(rec.erreur ?? erreurServeur) && <p role="alert" className="text-xs text-red-600">{rec.erreur ?? erreurServeur}</p>}
    </div>
  );
}
