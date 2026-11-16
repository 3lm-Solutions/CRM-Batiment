import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Select } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros, formatPercent, formatUnite } from '@/lib/format';
import { useCompanySettings } from '../devis/api';
import { useMateriaux, useSaveCompositions, useServicesMo, type ChoixOption, type PrestationDetail } from './api';

type Kind = 'MATERIAU' | 'MAIN_OEUVRE';
interface Row {
  key: number;
  kind: Kind;
  itemId: number | '';
  quantite: string;
}

let nextKey = 1;
const KIND_OPTIONS = [
  { value: 'MATERIAU', label: 'Matériau' },
  { value: 'MAIN_OEUVRE', label: 'Main d’œuvre' },
];

/**
 * Composition editor (ADMIN): what ONE unit of the prestation consumes — the base composition,
 * or (`choix`) the composition of one choice, which replaces the base one when that choice is
 * selected in a quote (an empty list removes it).
 * Cost per unit and margin are computed live; the API replaces the whole list in one call.
 */
export function CompositionModal({ open, onClose, prestation, choix }: { open: boolean; onClose: () => void; prestation: PrestationDetail; choix?: ChoixOption }) {
  const materiaux = useMateriaux({ page: 1, limit: 100, actif: 'true' });
  const services = useServicesMo({ page: 1, limit: 100, actif: 'true' });
  const save = useSaveCompositions(prestation.id, choix?.id);
  const source = choix ? choix.compositions : prestation.compositions;
  const settings = useCompanySettings(open);
  const seuil = settings.data?.seuilAlerteMargePourcent ?? 15;
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    save.reset();
    setRows(
      source.map((c) => ({
        key: nextKey++,
        kind: c.materiau ? 'MATERIAU' : 'MAIN_OEUVRE',
        itemId: (c.materiau ?? c.serviceMainOeuvre)?.id ?? '',
        quantite: String(c.quantiteParUnite),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prestation, choix]);

  const catalogue = useMemo(
    () => ({
      MATERIAU: (materiaux.data?.data ?? []).map((m) => ({ id: m.id, nom: m.nom, unite: m.unite, prix: m.prixAchatFixe })),
      MAIN_OEUVRE: (services.data?.data ?? []).map((s) => ({ id: s.id, nom: s.nom, unite: s.unite, prix: s.prixUnitaire })),
    }),
    [materiaux.data, services.data],
  );
  const find = (r: Row) => catalogue[r.kind].find((i) => i.id === r.itemId);
  const qty = (r: Row) => Number(r.quantite.replace(',', '.'));
  const lineCost = (r: Row) => {
    const item = find(r);
    return item && qty(r) > 0 ? item.prix * qty(r) : 0;
  };

  const coutMateriaux = rows.filter((r) => r.kind === 'MATERIAU').reduce((sum, r) => sum + lineCost(r), 0);
  const coutMainOeuvre = rows.filter((r) => r.kind === 'MAIN_OEUVRE').reduce((sum, r) => sum + lineCost(r), 0);
  const cout = coutMateriaux + coutMainOeuvre;
  const prixMilieu = (prestation.prixVenteMin + prestation.prixVenteMax) / 2;
  const marge = prixMilieu > 0 ? ((prixMilieu - cout) / prixMilieu) * 100 : null;

  const invalid = rows.findIndex((r) => r.itemId === '' || !(qty(r) > 0));
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (kind: Kind) => setRows((rs) => [...rs, { key: nextKey++, kind, itemId: '', quantite: '1' }]);

  const submit = () => {
    if (invalid >= 0) return void toast.error(`Ligne ${invalid + 1} : choisissez un élément et une quantité supérieure à 0.`);
    save.mutate(
      rows.map((r) =>
        r.kind === 'MATERIAU'
          ? { materiauId: r.itemId as number, quantiteParUnite: qty(r) }
          : { serviceMainOeuvreId: r.itemId as number, quantiteParUnite: qty(r) },
      ),
      { onSuccess: () => { toast.success(choix && rows.length === 0 ? 'Composition du choix supprimée : la composition de base s’applique' : 'Composition enregistrée'); onClose(); } },
    );
  };

  const unite = formatUnite(prestation.unite);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={choix ? `Composition du choix « ${choix.nom} »` : `Composition — ${prestation.nom}`}
      description={
        choix
          ? `Ce que consomme 1 ${unite} quand ce choix est retenu : elle REMPLACE la composition de base. Laissez vide pour garder la composition de base.`
          : `Ce que consomme 1 ${unite} de cette prestation. Sert au coût, à la marge et aux commandes fournisseur.`
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={save.isPending}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        {rows.length === 0 && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {choix
              ? `Aucune ligne : la composition de base s’applique pour ce choix. Ajoutez des lignes pour la remplacer.`
              : `Aucune ligne : ajoutez les matériaux et la main d’œuvre nécessaires pour 1 ${unite}.`}
          </p>
        )}
        {rows.map((r, index) => {
          const item = find(r);
          return (
            <div key={r.key} className="grid items-end gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[10.5rem_1fr_8rem_6.5rem_auto] dark:border-slate-700">
              <Select
                label={index === 0 ? 'Type' : undefined}
                aria-label="Type"
                options={KIND_OPTIONS}
                value={r.kind}
                onChange={(e) => update(r.key, { kind: e.target.value as Kind, itemId: '' })}
              />
              <Select
                label={index === 0 ? 'Élément' : undefined}
                aria-label="Élément"
                placeholder="Choisir…"
                options={catalogue[r.kind].map((i) => ({ value: i.id, label: `${i.nom} — ${formatEuros(i.prix)} / ${formatUnite(i.unite)}` }))}
                value={r.itemId}
                onChange={(e) => update(r.key, { itemId: e.target.value ? Number(e.target.value) : '' })}
              />
              <Input
                label={index === 0 ? `Qté pour 1 ${unite}` : undefined}
                aria-label="Quantité"
                type="number"
                step="0.0001"
                min="0"
                value={r.quantite}
                onChange={(e) => update(r.key, { quantite: e.target.value })}
                hint={item ? formatUnite(item.unite) : undefined}
              />
              <p className="pb-2.5 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">{formatEuros(lineCost(r))}</p>
              <Button variant="ghost" aria-label="Supprimer la ligne" icon={<Trash2 className="size-4 text-red-600" />} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => add('MATERIAU')}>Matériau</Button>
          <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => add('MAIN_OEUVRE')}>Main d’œuvre</Button>
        </div>
        <dl className="grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4 dark:bg-slate-800/50">
          <div><dt className="text-slate-500">Matériaux</dt><dd className="font-semibold tabular-nums">{formatEuros(coutMateriaux)} / {unite}</dd></div>
          <div><dt className="text-slate-500">Main d’œuvre</dt><dd className="font-semibold tabular-nums">{formatEuros(coutMainOeuvre)} / {unite}</dd></div>
          <div><dt className="text-slate-500">Coût de revient</dt><dd className="font-semibold tabular-nums">{formatEuros(cout)} / {unite}</dd></div>
          <div>
            <dt className="text-slate-500">Marge au prix moyen ({formatEuros(prixMilieu)})</dt>
            <dd className={marge !== null && marge < seuil ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700 dark:text-emerald-400'}>{rows.length ? formatPercent(marge) : '—'}</dd>
          </div>
        </dl>
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      </div>
    </Modal>
  );
}
