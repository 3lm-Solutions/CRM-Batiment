import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatEuros } from '@/lib/format';
import { SOURCES_PRIX, type PositionPrix, type PrixMarche } from './api';

const fourchette = (m: PrixMarche) => (m.basse === m.haute ? formatEuros(m.basse) : `${formatEuros(m.basse)} – ${formatEuros(m.haute)}`);

/** Explanation shown on hover: where the figures come from. */
export function titrePrixMarche(m: PrixMarche, periodeMois?: number): string {
  const origine = m.source === 'BAREME'
    ? `Barème importé${m.bareme?.source ? ` (${m.bareme.source})` : ''}${m.nombre ? ` — seulement ${m.nombre} prix récent(s) dans vos devis` : ''}`
    : `${m.nombre} ${m.source === 'DEVIS' ? 'devis signé(s)' : 'commande(s) fournisseur'}${periodeMois ? ` sur ${periodeMois} mois` : ''}`;
  const tendance = m.tendancePctAn !== null ? ` · tendance ${m.tendancePctAn > 0 ? '+' : ''}${String(m.tendancePctAn).replace('.', ',')} %/an` : '';
  return `${origine}${m.mediane !== null ? ` · médiane ${formatEuros(m.mediane)}` : ''}${tendance}`;
}

/**
 * « Marché : 40 € – 60 € » under a price; orange when the price is out of the usual range
 * (29/10). Never printed: internal information.
 */
export function PrixMarcheBadge({ marche, position, periodeMois, className }: { marche: PrixMarche | null; position?: PositionPrix | null; periodeMois?: number; className?: string }) {
  if (!marche) return <span className={cn('block text-[11px] text-slate-400 print:hidden', className)}>Marché : pas assez de données</span>;
  const alerte = position === 'BAS' || position === 'HAUT';
  return (
    <span
      title={titrePrixMarche(marche, periodeMois)}
      className={cn('flex items-center justify-end gap-1 text-[11px] print:hidden', alerte ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-500', className)}
    >
      {alerte && (position === 'HAUT' ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />)}
      Marché : {fourchette(marche)}
      {alerte && <span className="sr-only">{position === 'HAUT' ? ' — prix au-dessus du marché' : ' — prix en dessous du marché'}</span>}
      <span className="text-slate-400">· {m(marche)}</span>
    </span>
  );
}

const m = (marche: PrixMarche) => (marche.source === 'BAREME' ? 'barème' : `${marche.nombre} ${marche.source === 'DEVIS' ? 'devis' : 'cmd'}`);

export const libelleSource = (s: PrixMarche['source']) => SOURCES_PRIX[s];
export { fourchette as fourchettePrix };
