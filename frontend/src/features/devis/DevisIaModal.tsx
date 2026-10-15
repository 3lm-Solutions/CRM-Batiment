import { ArrowLeft, Lightbulb, SearchX, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Modal, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEuros, formatUnite } from '@/lib/format';
import { useAppliquerIa, useProposerIa, type LigneProposee, type PropositionIa } from './api';

const EXEMPLE = 'Ex. : Rénovation salle de bain 8 m² — dépose de la baignoire, douche à l’italienne, faïence murale sur 2 m de haut, carrelage au sol, remplacement du WC.';

interface Row extends LigneProposee {
  garder: boolean;
  /** Text of the quantity field (kept as typed, e.g. "12," while editing) */
  saisie: string;
}

const toRows = (p: PropositionIa): Row[] => p.lignes.map((l) => ({ ...l, garder: true, saisie: String(l.quantite) }));
const qty = (r: Row) => Number(r.saisie.replace(',', '.'));
const validQty = (r: Row) => Number.isFinite(qty(r)) && qty(r) > 0 && qty(r) <= 10_000;

/**
 * Step 15 — "Proposer avec l’IA": the technician describes the job, reviews the proposed
 * catalogue lines (keep / remove / change quantity), then adds them in one go.
 * Prices shown come from the catalogue, exactly like a line added by hand.
 */
export function DevisIaModal({ devisId, description: initial, onClose }: { devisId: number; description?: string; onClose: () => void }) {
  const [description, setDescription] = useState(initial ?? '');
  const [proposition, setProposition] = useState<PropositionIa | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const proposer = useProposerIa(devisId);
  const appliquer = useAppliquerIa(devisId);

  const kept = rows.filter((r) => r.garder);
  const invalid = kept.some((r) => !validQty(r));
  const total = kept.reduce((sum, r) => sum + (validQty(r) ? r.prixUnitaireHT * qty(r) : 0), 0);
  const update = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submitDescription = () =>
    proposer.mutate(description.trim(), {
      onSuccess: (p) => {
        setProposition(p);
        setRows(toRows(p));
      },
    });

  const apply = () =>
    appliquer.mutate(
      kept.map((r) => ({ prestationId: r.prestationId, quantite: qty(r) })),
      {
        onSuccess: () => {
          toast.success(`${kept.length} ligne(s) ajoutée(s) au devis`);
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  // ── step 1: description ──
  if (!proposition) {
    return (
      <Modal
        open
        onClose={onClose}
        size="lg"
        title="Proposer les lignes avec l’IA"
        description="Décrivez les travaux : l’assistant choisit les prestations de votre catalogue et estime les quantités. Rien n’est ajouté sans votre validation."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button icon={<Sparkles className="size-4" />} loading={proposer.isPending} disabled={description.trim().length < 10} onClick={submitDescription}>
              Proposer les lignes
            </Button>
          </>
        }
      >
        <Textarea
          label="Description des travaux"
          rows={6}
          autoFocus
          placeholder={EXEMPLE}
          hint="Indiquez les surfaces (m²), longueurs (ml) et nombres d’éléments : les quantités seront plus justes."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={3000}
        />
        {proposer.isPending && <p className="mt-3 text-sm text-gray-500" role="status">L’assistant prépare la proposition… (jusqu’à 30 secondes)</p>}
        {proposer.isError && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage(proposer.error)}</p>}
      </Modal>
    );
  }

  // ── step 2: review ──
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Vérifiez la proposition"
      description={
        <span className="flex flex-wrap items-center gap-2">
          {proposition.modeIA ? <Badge tone="violet">Proposé par l’IA</Badge> : <Badge tone="slate">Recherche par mots-clés</Badge>}
          Prix issus de votre catalogue. Décochez ce qui ne convient pas, corrigez les quantités.
        </span>
      }
      footer={
        <>
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setProposition(null)} className="mr-auto">
            Modifier la description
          </Button>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!kept.length || invalid} loading={appliquer.isPending} onClick={apply}>
            Ajouter {kept.length} ligne{kept.length > 1 ? 's' : ''} au devis
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {proposition.avertissement && (
          <p className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {proposition.avertissement}
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-slate-800/60">
                <tr>
                  <th className="w-10 px-3 py-2"><span className="sr-only">Garder</span></th>
                  <th className="px-3 py-2">Prestation</th>
                  <th className="w-36 px-3 py-2">Quantité</th>
                  <th className="px-3 py-2 text-right">P.U. HT</th>
                  <th className="px-3 py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={r.prestationId} className={cn(!r.garder && 'opacity-50')}>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        className="size-4 accent-blue-600"
                        checked={r.garder}
                        onChange={(e) => update(i, { garder: e.target.checked })}
                        aria-label={`Garder ${r.nom}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-gray-800 dark:text-slate-100">{r.nom}</p>
                      <p className="text-xs text-gray-500">{r.categorie}</p>
                      {r.justification && <p className="mt-1 text-xs italic text-gray-500">{r.justification}</p>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <input
                          inputMode="decimal"
                          className={cn(
                            'w-20 rounded-lg border px-2 py-1 text-right text-sm dark:bg-slate-900',
                            r.garder && !validQty(r) ? 'border-red-400' : 'border-gray-300 dark:border-slate-700',
                          )}
                          value={r.saisie}
                          disabled={!r.garder}
                          onChange={(e) => update(i, { saisie: e.target.value })}
                          aria-label={`Quantité ${r.nom}`}
                        />
                        <span className="text-xs text-gray-500">{formatUnite(r.unite)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top">{formatEuros(r.prixUnitaireHT)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top font-medium">{validQty(r) ? formatEuros(r.prixUnitaireHT * qty(r)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold dark:bg-slate-800/60">
                  <td colSpan={4} className="px-3 py-2 text-right">Total HT des lignes retenues</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEuros(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {proposition.hypotheses.length > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              <p className="mb-1 flex items-center gap-1.5 font-semibold"><Lightbulb className="size-4" /> À vérifier</p>
              <ul className="list-disc space-y-0.5 pl-5">{proposition.hypotheses.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          {proposition.nonCouverts.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
              <p className="mb-1 flex items-center gap-1.5 font-semibold"><SearchX className="size-4" /> Absent du catalogue — à ajouter à la main</p>
              <ul className="list-disc space-y-0.5 pl-5">{proposition.nonCouverts.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </div>
        {invalid && <p role="alert" className="text-sm text-red-600">Une quantité retenue est invalide (nombre positif, 10 000 maximum).</p>}
      </div>
    </Modal>
  );
}
