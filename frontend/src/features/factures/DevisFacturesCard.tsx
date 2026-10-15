import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, CardHeader, ConfirmDialog, Input, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros, formatPercent } from '@/lib/format';
import { factureLabel, useCreerFacture, useFactures } from './api';

/**
 * Invoicing of a signed quote, shown in the quote editor: the invoices already made,
 * and the next progress (situation) or final invoice.
 */
export function DevisFacturesCard({ devisId, canWrite }: { devisId: number; canWrite: boolean }) {
  const navigate = useNavigate();
  const factures = useFactures({ page: 1, devisId });
  const creer = useCreerFacture(devisId);
  const [situation, setSituation] = useState(false);
  const [avancement, setAvancement] = useState('');
  const rows = factures.data?.data ?? [];
  const active = rows.filter((f) => f.statut !== 'ANNULEE' && f.typeFacture !== 'AVOIR');
  const billedTTC = active.reduce((s, f) => s + f.montantTTC, 0);
  const hasFinale = active.some((f) => f.typeFacture === 'FINALE');

  const create = (input: Parameters<typeof creer.mutate>[0]) =>
    creer.mutate(input, {
      onSuccess: (f) => {
        toast.success('Brouillon de facture créé');
        navigate(`/factures/${f.id}`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const n = Number(avancement);
  const validAvancement = avancement !== '' && n > 0 && n < 100;

  return (
    <Card className="print:hidden">
      <CardHeader title="Facturation" description={`Facturé : ${formatEuros(billedTTC)} TTC`} />
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {rows.length === 0 && <li className="px-5 py-3 text-slate-500">Aucune facture.</li>}
        {rows.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
            <Link to={`/factures/${f.id}`} className="font-medium hover:underline">{factureLabel(f)}</Link>
            <span className="flex items-center gap-2">
              <StatusBadge kind="factureType" value={f.typeFacture} />
              <StatusBadge kind="facture" value={f.statut} />
              <span className="w-24 text-right tabular-nums">{formatEuros(f.montantTTC)}</span>
            </span>
          </li>
        ))}
      </ul>
      {canWrite && !hasFinale && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setSituation(true)}>Situation de travaux</Button>
          <Button size="sm" icon={<Plus className="size-4" />} loading={creer.isPending && creer.variables?.type === 'finale'} onClick={() => create({ type: 'finale' })}>Facture finale</Button>
        </div>
      )}
      <ConfirmDialog
        open={situation}
        onClose={() => setSituation(false)}
        title="Nouvelle situation de travaux"
        message="Indiquez l’avancement CUMULÉ des travaux : la situation facture la différence avec ce qui a déjà été facturé (acompte déduit à la finale)."
        confirmLabel="Créer le brouillon"
        loading={creer.isPending}
        onConfirm={() => {
          if (!validAvancement) return void toast.error('Avancement entre 0 et 100 % (exclus).');
          setSituation(false);
          create({ type: 'situation', avancementCumule: n });
        }}
      >
        <Input
          label="Avancement cumulé (%)"
          type="number"
          min={1}
          max={99.99}
          step="0.01"
          value={avancement}
          onChange={(e) => setAvancement(e.target.value)}
          hint={validAvancement ? `Soit ${formatPercent(n)} du devis` : 'Strictement inférieur à 100 % (au-delà : facture finale)'}
        />
      </ConfirmDialog>
    </Card>
  );
}
