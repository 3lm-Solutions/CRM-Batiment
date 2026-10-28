import { Mic, MicOff } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui';
import { useDictee } from './useDictee';

/**
 * « Dicter » button + live text (Étape 7 of 27/10). Hidden-in-place message when the browser has
 * no speech recognition (Firefox): the user types instead.
 */
export function BoutonDictee({ onTexte, disabled, demarrerAuto }: { onTexte: (texte: string) => void; disabled?: boolean; demarrerAuto?: boolean }) {
  const d = useDictee(onTexte);
  // Opened with « Dicter le devis »: listen right away
  useEffect(() => {
    if (!demarrerAuto) return;
    // Deferred: in development React mounts twice, and a mic opened then closed at once stays off
    const t = setTimeout(d.demarrer, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!d.supporte) {
    return <p className="text-xs text-slate-500">Dictée vocale indisponible dans ce navigateur : utilisez Chrome, Edge ou Safari.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={d.ecoute ? 'danger' : 'outline'}
          icon={d.ecoute ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          disabled={disabled}
          onClick={d.ecoute ? d.arreter : d.demarrer}
          aria-pressed={d.ecoute}
        >
          {d.ecoute ? 'Arrêter la dictée' : 'Dicter'}
        </Button>
        {d.ecoute && (
          <span className="flex items-center gap-2 text-xs font-medium text-red-600" role="status">
            <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden /> J’écoute… parlez normalement
          </span>
        )}
      </div>
      {d.ecoute && d.provisoire && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-500 dark:bg-slate-800/60">{d.provisoire}</p>}
      {d.erreur && <p role="alert" className="text-xs text-red-600">{d.erreur}</p>}
    </div>
  );
}
