import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge, Button, Input, Loading, Modal, SearchInput, Select, Tabs, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatEuros, formatUnite } from '@/lib/format';
import { UNITES, usePrestation, usePrestations } from '../catalogue/api';
import { ChiffrageSimulator, type ChiffrageSelection } from '../catalogue/ChiffrageSimulator';
import { useAddLigne } from './api';

/** Catalogue line: search → pick → quantity & options (live pricing) → optional price override. */
function CatalogueTab({ devisId, onDone }: { devisId: number; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selection, setSelection] = useState<ChiffrageSelection | null>(null);
  const [prixOverride, setPrixOverride] = useState('');
  const list = usePrestations({ page: 1, search, actif: 'true', limit: 8 });
  const prestation = usePrestation(selectedId);
  const add = useAddLigne(devisId);

  if (selectedId) {
    if (prestation.isPending) return <Loading />;
    if (prestation.isError) return <p className="text-sm text-red-600">{errorMessage(prestation.error)}</p>;
    const p = prestation.data;
    const ready = !!selection?.result;
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{p.nom}</p>
            <p className="text-sm text-slate-500">{formatEuros(p.prixVenteMin)} à {formatEuros(p.prixVenteMax)} HT / {formatUnite(p.unite)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setSelection(null); }}>Changer</Button>
        </div>
        <ChiffrageSimulator prestation={p} onChange={setSelection} />
        <Input
          label="Prix de vente unitaire HT (facultatif)"
          type="number"
          step="0.01"
          min={0}
          hint={selection?.result ? `Laisser vide pour le prix suggéré : ${formatEuros(selection.result.prixVenteSuggereUnite)}` : undefined}
          value={prixOverride}
          onChange={(e) => setPrixOverride(e.target.value)}
        />
        {add.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(add.error)}</p>}
        <div className="flex justify-end">
          <Button
            disabled={!ready}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                {
                  prestationId: p.id,
                  choixIds: selection!.choixIds,
                  quantite: selection!.quantite,
                  ...(prixOverride !== '' && { prixUnitaireVente: Number(prixOverride) }),
                },
                { onSuccess: () => { toast.success('Ligne ajoutée'); onDone(); } },
              )
            }
          >
            Ajouter au devis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher une prestation…" />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {list.isPending && <li className="px-4 py-3 text-sm text-slate-500">Chargement…</li>}
        {list.data?.data.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Aucune prestation trouvée</li>}
        {list.data?.data.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setSelectedId(p.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-brand-100/50 dark:hover:bg-slate-800">
              <span>
                <span className="block font-medium">{p.nom}</span>
                <span className="text-xs text-slate-500">{p.categorie.nom}{p.sousCategorie && ` › ${p.sousCategorie.nom}`}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {!p._count?.compositions && <Badge tone="amber">coût inconnu</Badge>}
                <span className="tabular-nums text-slate-600">{formatEuros(p.prixVenteMin)} – {formatEuros(p.prixVenteMax)}/{formatUnite(p.unite)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const freeSchema = z.object({
  description: z.string().trim().min(1, 'Obligatoire'),
  quantite: z.coerce.number().positive('Doit être > 0'),
  unite: z.enum(UNITES),
  prixUnitaireVente: z.coerce.number().min(0),
  prixAchat: z.coerce.number().min(0),
  mainOeuvre: z.coerce.number().min(0),
});

/** Free line: anything not in the catalogue (travel, special work…). Costs are optional. */
function FreeTab({ devisId, onDone }: { devisId: number; onDone: () => void }) {
  const add = useAddLigne(devisId);
  const form = useForm<z.input<typeof freeSchema>, unknown, z.output<typeof freeSchema>>({
    resolver: zodResolver(freeSchema),
    defaultValues: { description: '', quantite: 1, unite: 'FORFAIT', prixUnitaireVente: 0, prixAchat: 0, mainOeuvre: 0 },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit((v) => add.mutate(v, { onSuccess: () => { toast.success('Ligne ajoutée'); onDone(); } }));
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Textarea label="Description" required rows={2} error={e.description?.message} {...form.register('description')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Quantité" type="number" step="0.001" required error={e.quantite?.message} {...form.register('quantite')} />
        <Select label="Unité" options={UNITES.map((u) => ({ value: u, label: formatUnite(u) }))} {...form.register('unite')} />
        <Input label="Prix de vente unitaire HT" type="number" step="0.01" required {...form.register('prixUnitaireVente')} />
        <Input label="Coût matériaux unitaire" type="number" step="0.01" hint="Pour calculer la marge" {...form.register('prixAchat')} />
        <Input label="Coût main d’œuvre unitaire" type="number" step="0.01" {...form.register('mainOeuvre')} />
      </div>
      {add.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(add.error)}</p>}
      <div className="flex justify-end"><Button type="submit" loading={add.isPending}>Ajouter au devis</Button></div>
    </form>
  );
}

export function AddLigneModal({ devisId, open, onClose }: { devisId: number; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'catalogue' | 'libre'>('catalogue');
  return (
    <Modal open={open} onClose={onClose} size="xl" title="Ajouter une ligne">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'catalogue', label: 'Depuis le catalogue' }, { value: 'libre', label: 'Ligne libre' }]} />
      <div className={cn(tab !== 'catalogue' && 'hidden')}><CatalogueTab devisId={devisId} onDone={onClose} /></div>
      {tab === 'libre' && <FreeTab devisId={devisId} onDone={onClose} />}
    </Modal>
  );
}
