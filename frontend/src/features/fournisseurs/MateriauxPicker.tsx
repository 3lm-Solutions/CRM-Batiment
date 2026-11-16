import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Modal, SearchInput } from '@/components/ui';
import type { PaginatedResponse } from '@/shared';
import { api, errorMessage } from '@/lib/api';
import { formatEuros, formatUnite } from '@/lib/format';
import type { Materiau } from '../catalogue/api';
import { MateriauModal } from '../catalogue/CatalogueForms';
import { useRemplacerMateriaux } from './api';

type Known = Pick<Materiau, 'id' | 'nom' | 'unite' | 'prixAchatFixe' | 'fournisseur'>;
/** Stable default: a new [] on every render would re-run the effect below forever */
const NONE: Known[] = [];

/** Active materials of the catalogue, searched by name (100 at a time). */
function useMateriauxRecherche(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['catalogue', 'materiaux', 'picker', search],
    enabled,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Materiau>>('/catalogue/materiaux', { params: { page: 1, limit: 100, actif: true, search: search || undefined } })).data.data,
  });
}

/** The materials a supplier currently supplies (to prefill the picker). */
export function useMateriauxDuFournisseur(fournisseurId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['catalogue', 'materiaux', 'fournisseur', fournisseurId],
    enabled: enabled && !!fournisseurId,
    queryFn: async () =>
      (await api.get<PaginatedResponse<Materiau>>('/catalogue/materiaux', { params: { page: 1, limit: 100, fournisseurId } })).data.data,
  });
}

/**
 * Materials supplied by a supplier (21/10): tick existing catalogue materials, or create one.
 * One supplier per material: ticking a material of another supplier moves it here (shown).
 */
export function MateriauxPicker({
  value,
  onChange,
  fournisseurId,
  initial = NONE,
  enabled = true,
  allowCreate = true,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  /** The supplier being edited (undefined while creating it) */
  fournisseurId?: number;
  /** Materials already linked (names shown even when outside the current search) */
  initial?: Known[];
  enabled?: boolean;
  allowCreate?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [known, setKnown] = useState<Map<number, Known>>(new Map());
  const results = useMateriauxRecherche(search, enabled);

  useEffect(() => {
    setKnown((k) => {
      const next = new Map(k);
      [...initial, ...(results.data ?? [])].forEach((m) => next.set(m.id, m));
      return next;
    });
  }, [initial, results.data]);

  const selected = new Set(value);
  const toggle = (id: number) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const list = results.data ?? [];
  const moved = value.map((id) => known.get(id)).filter((m): m is Known => !!m && !!m.fournisseur && m.fournisseur.id !== fournisseurId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Matériaux fournis <span className="font-normal text-slate-500">({value.length} choisi{value.length > 1 ? 's' : ''})</span>
        </p>
        {allowCreate && (
          <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nouveau matériau
          </Button>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-900 hover:bg-red-100 hover:text-red-700 dark:bg-slate-800 dark:text-blue-200"
              title="Retirer"
            >
              {known.get(id)?.nom ?? `#${id}`} ×
            </button>
          ))}
        </div>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un matériau du catalogue…" />
      <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" aria-label="Matériaux du catalogue">
        {results.isPending && <li className="px-3 py-2 text-sm text-slate-500">Chargement…</li>}
        {!results.isPending && list.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500">Aucun matériau{search ? ` pour « ${search} »` : ''}{allowCreate ? ' — créez-le avec « Nouveau matériau ».' : '.'}</li>
        )}
        {list.map((m) => {
          const autre = m.fournisseur && m.fournisseur.id !== fournisseurId ? m.fournisseur.nom : null;
          return (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <input type="checkbox" className="size-4 accent-brand-700" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                <span className="min-w-0 flex-1 truncate">{m.nom}</span>
                {autre && <Badge tone="slate">chez {autre}</Badge>}
                <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">{formatEuros(m.prixAchatFixe)} / {formatUnite(m.unite)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {moved.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Un matériau n’a qu’un fournisseur : {moved.map((m) => `${m.nom} (chez ${m.fournisseur!.nom})`).join(', ')} {moved.length > 1 ? 'seront rattachés' : 'sera rattaché'} à ce fournisseur.
        </p>
      )}

      {allowCreate && (
        <MateriauModal
          open={creating}
          onClose={() => setCreating(false)}
          defaultFournisseurId={fournisseurId}
          onSaved={(m) => {
            setKnown((k) => new Map(k).set(m.id, m));
            onChange([...value.filter((x) => x !== m.id), m.id]);
          }}
        />
      )}
    </div>
  );
}

/** From a new supplier order whose supplier has no material yet (21/10). ADMIN only (catalogue write). */
export function RattacherMateriauxModal({ open, onClose, fournisseur }: { open: boolean; onClose: () => void; fournisseur: { id: number; nom: string } | null }) {
  const save = useRemplacerMateriaux();
  const actuels = useMateriauxDuFournisseur(fournisseur?.id, open);
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    if (open) setIds((actuels.data ?? []).map((m) => m.id));
  }, [open, actuels.data]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Matériaux de ${fournisseur?.nom ?? ''}`}
      description="Cochez ce que ce fournisseur vous livre, ou créez un matériau. Ses prix d’achat restent ceux du catalogue."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            loading={save.isPending}
            disabled={!fournisseur}
            onClick={() =>
              fournisseur &&
              save.mutate(
                { id: fournisseur.id, materiauIds: ids },
                { onSuccess: () => { toast.success('Matériaux rattachés'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <MateriauxPicker value={ids} onChange={setIds} fournisseurId={fournisseur?.id} initial={actuels.data} enabled={open} />
    </Modal>
  );
}
