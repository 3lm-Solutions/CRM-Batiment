import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, Input, Modal, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros } from '@/lib/format';
import { useDeleteChoix, useDeleteOption, useSaveChoix, useSaveOption, type ChoixOption, type OptionPrestation, type PrestationDetail } from './api';
import { CompositionModal } from './CompositionModal';

const onError = (e: unknown) => toast.error(errorMessage(e));

function OptionModal({ open, onClose, prestationId, option }: { open: boolean; onClose: () => void; prestationId: number; option?: OptionPrestation }) {
  const save = useSaveOption(prestationId);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [obligatoire, setObligatoire] = useState(false);
  const [ordre, setOrdre] = useState('0');
  useEffect(() => {
    if (!open) return;
    setNom(option?.nom ?? '');
    setDescription(option?.description ?? '');
    setObligatoire(option?.obligatoire ?? false);
    setOrdre(String(option?.ordre ?? 0));
  }, [open, option]);

  const submit = () =>
    save.mutate(
      { id: option?.id, nom: nom.trim(), description: description.trim() || null, obligatoire, ordre: Math.max(0, Math.round(Number(ordre) || 0)) },
      { onSuccess: () => { toast.success(option ? 'Option modifiée' : 'Option ajoutée'); onClose(); }, onError },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={option ? `Modifier l’option « ${option.nom} »` : 'Nouvelle option'}
      description="Une option regroupe des choix proposés au client dans le devis (ex. : Type de chape → Traditionnelle, Fibrée)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!nom.trim()} loading={save.isPending} onClick={submit}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input id="option-nom" label="Nom" required placeholder="Type de chape" value={nom} onChange={(e) => setNom(e.target.value)} />
        <Textarea id="option-description" label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="option-ordre" label="Ordre d’affichage" type="number" min={0} value={ordre} onChange={(e) => setOrdre(e.target.value)} />
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
            <input id="option-obligatoire" type="checkbox" className="size-4 accent-brand-700" checked={obligatoire} onChange={(e) => setObligatoire(e.target.checked)} />
            Choix obligatoire dans le devis
          </label>
        </div>
      </div>
    </Modal>
  );
}

function ChoixModal({ open, onClose, optionId, choix }: { open: boolean; onClose: () => void; optionId: number; choix?: ChoixOption }) {
  const save = useSaveChoix();
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('0');
  const [ordre, setOrdre] = useState('0');
  const [actif, setActif] = useState(true);
  useEffect(() => {
    if (!open) return;
    setNom(choix?.nom ?? '');
    setDescription(choix?.description ?? '');
    setImpact(String(choix?.impactPrix ?? 0));
    setOrdre(String(choix?.ordre ?? 0));
    setActif(choix?.actif ?? true);
  }, [open, choix]);

  const impactValue = Number(impact.replace(',', '.'));
  const submit = () =>
    save.mutate(
      {
        id: choix?.id,
        optionId,
        nom: nom.trim(),
        description: description.trim() || null,
        impactPrix: Math.round(impactValue * 100) / 100,
        ordre: Math.max(0, Math.round(Number(ordre) || 0)),
        // `actif` is only accepted on update
        ...(choix && { actif }),
      },
      { onSuccess: () => { toast.success(choix ? 'Choix modifié' : 'Choix ajouté'); onClose(); }, onError },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={choix ? `Modifier le choix « ${choix.nom} »` : 'Nouveau choix'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!nom.trim() || Number.isNaN(impactValue)} loading={save.isPending} onClick={submit}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input id="choix-nom" label="Nom" required placeholder="Chape fibrée" value={nom} onChange={(e) => setNom(e.target.value)} />
        <Textarea id="choix-description" label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="choix-impact"
            label="Impact sur le prix (€ HT par unité)"
            type="number"
            step="0.01"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            hint="Supplément, ou remise si négatif. 0 = même prix."
          />
          <Input id="choix-ordre" label="Ordre d’affichage" type="number" min={0} value={ordre} onChange={(e) => setOrdre(e.target.value)} />
        </div>
        {choix && (
          <label className="flex items-center gap-2 text-sm">
            <input id="choix-actif" type="checkbox" className="size-4 accent-brand-700" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            Actif (décoché : n’est plus proposé dans les nouveaux devis)
          </label>
        )}
      </div>
    </Modal>
  );
}

type Pending = { kind: 'option'; item: OptionPrestation } | { kind: 'choix'; item: ChoixOption } | null;

/**
 * Options of a prestation and their choices. Read only for the office; the ADMIN creates,
 * edits and deletes them, and gives a choice its own composition (E1 of 20/10).
 */
export function OptionsCard({ prestation, canEdit, seesCosts }: { prestation: PrestationDetail; canEdit: boolean; seesCosts: boolean }) {
  const deleteOption = useDeleteOption();
  const deleteChoix = useDeleteChoix();
  const [optionForm, setOptionForm] = useState<OptionPrestation | 'new' | null>(null);
  const [choixForm, setChoixForm] = useState<{ optionId: number; choix?: ChoixOption } | null>(null);
  const [composing, setComposing] = useState<ChoixOption | null>(null);
  const [deleting, setDeleting] = useState<Pending>(null);

  const confirmDelete = () => {
    if (!deleting) return;
    const done = { onSuccess: () => { toast.success(deleting.kind === 'option' ? 'Option supprimée' : 'Choix supprimé'); setDeleting(null); }, onError };
    if (deleting.kind === 'option') deleteOption.mutate(deleting.item.id, done);
    else deleteChoix.mutate(deleting.item.id, done);
  };

  const iconBtn = 'rounded p-1 text-slate-400 hover:text-brand-700 focus-visible:outline-2 dark:hover:text-blue-300';
  return (
    <Card>
      <CardHeader
        title="Options"
        description="Choisies par le client dans le devis"
        actions={canEdit && <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setOptionForm('new')}>Option</Button>}
      />
      <div className="space-y-5 p-5">
        {prestation.options.length === 0 && (
          <p className="text-sm text-slate-500">Aucune option.{canEdit && ' Ajoutez-en une si le client doit choisir (finition, type, couleur…).'}</p>
        )}
        {prestation.options.map((o) => (
          <div key={o.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{o.nom}</p>
              {o.obligatoire && <Badge tone="blue">obligatoire</Badge>}
              {canEdit && (
                <span className="ml-auto inline-flex items-center gap-1">
                  <button type="button" className={iconBtn} aria-label={`Modifier l’option ${o.nom}`} onClick={() => setOptionForm(o)}><Pencil className="size-4" /></button>
                  <button type="button" className={`${iconBtn} hover:text-red-600`} aria-label={`Supprimer l’option ${o.nom}`} onClick={() => setDeleting({ kind: 'option', item: o })}><Trash2 className="size-4" /></button>
                </span>
              )}
            </div>
            {o.description && <p className="text-xs text-slate-500">{o.description}</p>}

            {canEdit ? (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {o.choix.length === 0 && <li className="px-3 py-2 text-sm text-amber-700">Aucun choix : ajoutez au moins un choix.</li>}
                {o.choix.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className={c.actif ? 'font-medium' : 'text-slate-400 line-through'}>{c.nom}</span>
                    {!c.actif && <Badge>inactif</Badge>}
                    {c.impactPrix !== 0 && <span className="tabular-nums text-slate-600 dark:text-slate-300">{c.impactPrix > 0 ? '+' : ''}{formatEuros(c.impactPrix)} / unité</span>}
                    {c.compositions.length > 0 && <Badge tone="violet">composition propre</Badge>}
                    <span className="ml-auto inline-flex items-center gap-1">
                      <button type="button" className={iconBtn} title="Composition du choix" aria-label={`Composition du choix ${c.nom}`} onClick={() => setComposing(c)}><ListChecks className="size-4" /></button>
                      <button type="button" className={iconBtn} aria-label={`Modifier le choix ${c.nom}`} onClick={() => setChoixForm({ optionId: o.id, choix: c })}><Pencil className="size-4" /></button>
                      <button type="button" className={`${iconBtn} hover:text-red-600`} aria-label={`Supprimer le choix ${c.nom}`} onClick={() => setDeleting({ kind: 'choix', item: c })}><Trash2 className="size-4" /></button>
                    </span>
                  </li>
                ))}
                <li className="px-3 py-2">
                  <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setChoixForm({ optionId: o.id })}>Ajouter un choix</Button>
                </li>
              </ul>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {o.choix.filter((c) => c.actif).map((c) => (
                  <li key={c.id}>
                    <Badge tone={c.compositions.length ? 'violet' : 'slate'}>
                      {c.nom}{seesCosts && c.impactPrix ? ` (${c.impactPrix > 0 ? '+' : ''}${formatEuros(c.impactPrix)})` : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {prestation.options.some((o) => o.choix.some((c) => c.compositions.length)) && (
          <p className="text-xs text-slate-500">« Composition propre » / en violet : ce choix remplace la composition de base quand il est retenu.</p>
        )}
      </div>

      {canEdit && (
        <>
          <OptionModal open={optionForm !== null} onClose={() => setOptionForm(null)} prestationId={prestation.id} option={optionForm === 'new' ? undefined : (optionForm ?? undefined)} />
          <ChoixModal open={choixForm !== null} onClose={() => setChoixForm(null)} optionId={choixForm?.optionId ?? 0} choix={choixForm?.choix} />
          <CompositionModal open={composing !== null} onClose={() => setComposing(null)} prestation={prestation} choix={composing ?? undefined} />
          <ConfirmDialog
            open={deleting !== null}
            onClose={() => setDeleting(null)}
            danger
            title={deleting?.kind === 'option' ? `Supprimer l’option « ${deleting.item.nom} » ?` : `Supprimer le choix « ${deleting?.item.nom ?? ''} » ?`}
            message={
              deleting?.kind === 'option'
                ? 'L’option et tous ses choix disparaissent du catalogue. Les devis déjà faits gardent leur texte.'
                : 'Le choix disparaît du catalogue. Les devis déjà faits gardent leur texte. Pour seulement ne plus le proposer, désactivez-le plutôt.'
            }
            confirmLabel="Supprimer"
            loading={deleteOption.isPending || deleteChoix.isPending}
            onConfirm={confirmDelete}
          />
        </>
      )}
    </Card>
  );
}
