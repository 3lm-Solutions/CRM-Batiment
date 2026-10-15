import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEuros, formatNumber, formatPercent, formatUnite } from '@/lib/format';
import { useRemoveLigne, useReorderLignes, useUpdateLigne, type DevisDetail, type LigneDevis } from './api';

/** Number field saved on blur / Enter, only when the value actually changed. */
function InlineNumber({ value, onSave, label, step = '0.01' }: { value: number; onSave: (v: number) => void; label: string; step?: string }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Number(draft);
    if (draft === '' || Number.isNaN(n) || n < 0) return setDraft(String(value));
    if (n !== value) onSave(n);
  };
  return (
    <input
      type="number"
      step={step}
      min={0}
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 dark:border-slate-700 dark:bg-slate-900"
    />
  );
}

const lineMargin = (l: LigneDevis) => (l.totalHT && l.coutTotal !== undefined ? ((l.totalHT - l.coutTotal) / l.totalHT) * 100 : null);

/**
 * Quote lines. Editable (quantity, unit price, delete, reorder) only in BROUILLON / REVISE.
 * Cost and margin columns are internal: hidden on print and for the chef de chantier.
 */
export function LignesTable({ devis, editable, seuilMarge }: { devis: DevisDetail; editable: boolean; seuilMarge?: number }) {
  const update = useUpdateLigne(devis.id);
  const remove = useRemoveLigne(devis.id);
  const reorder = useReorderLignes(devis.id);
  const showPrices = devis.totalHT !== undefined;
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const move = (index: number, delta: number) => {
    const ids = devis.lignes.map((l) => l.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    reorder.mutate(ids, { onError });
  };

  if (devis.lignes.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">Aucune ligne. {editable && 'Ajoutez une prestation du catalogue ou une ligne libre.'}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
            <th scope="col" className="px-4 py-3 text-left">Désignation</th>
            <th scope="col" className="px-4 py-3 text-right">Quantité</th>
            {showPrices && <th scope="col" className="px-4 py-3 text-right">P.U. HT</th>}
            {showPrices && <th scope="col" className="px-4 py-3 text-right">Total HT</th>}
            {showPrices && <th scope="col" className="px-4 py-3 text-right print:hidden">Coût</th>}
            {showPrices && <th scope="col" className="px-4 py-3 text-right print:hidden">Marge</th>}
            {editable && <th scope="col" className="px-2 py-3 print:hidden"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {devis.lignes.map((l, i) => {
            const marge = lineMargin(l);
            return (
              <tr key={l.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                <td className="px-4 py-3">
                  <p className="font-medium">{l.description ?? 'Prestation'}</p>
                  {l.optionsChoisies && l.optionsChoisies.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.optionsChoisies.map((o) => <Badge key={o.choixId} tone="blue">{o.optionNom} : {o.choixNom}</Badge>)}
                    </div>
                  )}
                  {[l.dimension, l.couleur, l.finition].some(Boolean) && (
                    <p className="mt-1 text-xs text-slate-500">{[l.dimension, l.couleur, l.finition].filter(Boolean).join(' · ')}</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                  {editable ? (
                    <span className="inline-flex items-center gap-1">
                      <InlineNumber key={`q-${l.id}-${l.quantite}`} label="Quantité" step="0.001" value={l.quantite} onSave={(quantite) => update.mutate({ ligneId: l.id, quantite }, { onError })} />
                      <span className="text-slate-500">{formatUnite(l.unite)}</span>
                    </span>
                  ) : (
                    `${formatNumber(l.quantite)} ${formatUnite(l.unite)}`
                  )}
                </td>
                {showPrices && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {editable ? (
                      <InlineNumber key={`p-${l.id}-${l.prixUnitaireVente}`} label="Prix unitaire HT" value={l.prixUnitaireVente ?? 0} onSave={(prixUnitaireVente) => update.mutate({ ligneId: l.id, prixUnitaireVente }, { onError })} />
                    ) : (
                      formatEuros(l.prixUnitaireVente)
                    )}
                  </td>
                )}
                {showPrices && <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatEuros(l.totalHT)}</td>}
                {showPrices && <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-500 print:hidden">{formatEuros(l.coutTotal)}</td>}
                {showPrices && (
                  <td className={cn('whitespace-nowrap px-4 py-3 text-right tabular-nums print:hidden', marge !== null && seuilMarge !== undefined && marge < seuilMarge && 'font-semibold text-amber-700')}>
                    {l.coutTotal ? formatPercent(marge) : <span className="text-slate-400" title="Coût inconnu">—</span>}
                  </td>
                )}
                {editable && (
                  <td className="whitespace-nowrap px-2 py-3 text-right print:hidden">
                    <Button variant="ghost" size="sm" aria-label="Monter" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} icon={<ArrowUp className="size-4" />} />
                    <Button variant="ghost" size="sm" aria-label="Descendre" disabled={i === devis.lignes.length - 1 || reorder.isPending} onClick={() => move(i, 1)} icon={<ArrowDown className="size-4" />} />
                    <Button variant="ghost" size="sm" aria-label="Supprimer la ligne" onClick={() => remove.mutate(l.id, { onError })} icon={<Trash2 className="size-4 text-red-600" />} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
