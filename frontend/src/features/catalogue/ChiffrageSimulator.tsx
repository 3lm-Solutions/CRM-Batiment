import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Input, Select, Stat } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros, formatNumber, formatPercent, formatUnite } from '@/lib/format';
import { useChiffrage, type PricingResult, type PrestationDetail } from './api';

export interface ChiffrageSelection {
  quantite: number;
  choixIds: number[];
  result: PricingResult | null;
}

/**
 * Quantity + one choice per option → live pricing from the API (cost breakdown, suggested
 * price, margin). Used on the prestation page AND in the quote editor's catalogue picker.
 */
export function ChiffrageSimulator({ prestation, onChange }: { prestation: PrestationDetail; onChange?: (s: ChiffrageSelection) => void }) {
  const { mutate, data: r, error, isError } = useChiffrage();
  const [quantite, setQuantite] = useState(1);
  const [choix, setChoix] = useState<Record<number, number | ''>>({});
  const choixIds = useMemo(() => Object.values(choix).filter((v): v is number => typeof v === 'number'), [choix]);
  const missingRequired = prestation.options.some((o) => o.obligatoire && !choix[o.id]);
  // Latest callback without re-running the pricing effect when the parent re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!(quantite > 0) || missingRequired) {
      onChangeRef.current?.({ quantite, choixIds, result: null });
      return;
    }
    const t = setTimeout(
      () => mutate({ id: prestation.id, quantite, choixIds }, { onSuccess: (result) => onChangeRef.current?.({ quantite, choixIds, result }) }),
      250,
    );
    return () => clearTimeout(t);
  }, [prestation.id, quantite, choixIds, missingRequired, mutate]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={`Quantité (${formatUnite(prestation.unite)})`}
          type="number"
          min={0}
          step="0.01"
          value={quantite}
          onChange={(e) => setQuantite(Number(e.target.value))}
        />
        {prestation.options.map((o) => (
          <Select
            key={o.id}
            label={o.nom}
            required={o.obligatoire}
            placeholder={o.obligatoire ? 'Choisir…' : 'Aucun'}
            value={choix[o.id] ?? ''}
            onChange={(e) => setChoix((c) => ({ ...c, [o.id]: e.target.value ? Number(e.target.value) : '' }))}
            options={o.choix
              .filter((c) => c.actif)
              .map((c) => ({ value: c.id, label: c.impactPrix ? `${c.nom} (${c.impactPrix > 0 ? '+' : ''}${formatEuros(c.impactPrix)})` : c.nom }))}
          />
        ))}
      </div>

      {missingRequired && <p className="text-sm text-slate-500">Choisissez les options obligatoires pour obtenir le chiffrage.</p>}
      {isError && <p role="alert" className="text-sm text-red-600">{errorMessage(error)}</p>}

      {r && !missingRequired && (
        <div className="space-y-3" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Prix de vente suggéré" value={`${formatEuros(r.prixVenteSuggereUnite)} / ${formatUnite(prestation.unite)}`} />
            <Stat label="Coût de revient" value={formatEuros(r.coutTotal)} hint={`${formatEuros(r.coutParUnite)} / ${formatUnite(prestation.unite)}`} />
            <Stat label="Total HT" value={formatEuros(r.totalVenteHT)} />
            <Stat label="Marge" value={formatPercent(r.margePourcent)} tone={r.alerteMarge ? 'warning' : 'success'} hint={`Prix pour la marge cible : ${formatEuros(r.prixCibleMargeUnite)}`} />
          </div>
          {r.avertissements.map((a) => (
            <p key={a} className="flex items-center gap-2 text-sm text-amber-700"><TriangleAlert className="size-4" /> {a}</p>
          ))}
          {r.lignes.length > 0 && (
            <details className="rounded-xl border border-slate-200 dark:border-slate-700">
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                Détail des coûts {r.compositionSource === 'CHOIX' && <Badge tone="violet" className="ml-2">composition « {r.compositionChoix} »</Badge>}
              </summary>
              <table className="w-full text-sm">
                <tbody>
                  {r.lignes.map((l) => (
                    <tr key={`${l.kind}-${l.id}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">{l.nom} <span className="text-xs text-slate-500">{l.kind === 'MAIN_OEUVRE' ? 'main d’œuvre' : 'matériau'}</span></td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatNumber(l.quantiteNecessaire)} {formatUnite(l.unite)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatEuros(l.coutTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
