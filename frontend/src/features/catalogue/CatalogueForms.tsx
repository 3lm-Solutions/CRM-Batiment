import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatUnite } from '@/lib/format';
import { UNITES, useCategories, useFournisseurOptions, useSaveCatalogue, type Materiau, type Prestation, type ServiceMo } from './api';

const UNITE_OPTIONS = UNITES.map((u) => ({ value: u, label: formatUnite(u) }));
const money = z.coerce.number({ invalid_type_error: 'Nombre attendu' }).min(0, 'Doit être positif');
const optionalNumber = z.union([z.literal(''), z.coerce.number().min(0)]).transform((v) => (v === '' ? null : v));
const optionalId = z.union([z.literal(''), z.coerce.number()]).transform((v) => (v === '' ? null : v));
const unite = z.enum(UNITES);

function FormModal({ title, open, onClose, onSubmit, pending, error, children }: {
  title: string; open: boolean; onClose: () => void; onSubmit: () => void; pending: boolean; error: unknown; children: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={onSubmit} loading={pending}>Enregistrer</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4" noValidate>
        {children}
        {error ? <p role="alert" className="text-sm text-red-600">{errorMessage(error)}</p> : null}
      </form>
    </Modal>
  );
}

// ── Matériau ──────────────────────────────────────────────────────────────
const materiauSchema = z.object({
  nom: z.string().trim().min(1, 'Obligatoire'),
  unite,
  prixAchatFixe: money,
  fournisseurId: optionalId,
  couleur: z.string().trim(),
  finition: z.string().trim(),
  stockMinimum: money,
  actif: z.boolean(),
});

export function MateriauModal({ open, onClose, materiau }: { open: boolean; onClose: () => void; materiau?: Materiau }) {
  const save = useSaveCatalogue('materiaux');
  const fournisseurs = useFournisseurOptions(open);
  const form = useForm<z.input<typeof materiauSchema>, unknown, z.output<typeof materiauSchema>>({
    resolver: zodResolver(materiauSchema),
    values: {
      nom: materiau?.nom ?? '', unite: materiau?.unite ?? 'PIECE', prixAchatFixe: materiau?.prixAchatFixe ?? 0,
      fournisseurId: materiau?.fournisseur?.id ?? '', couleur: materiau?.couleur ?? '', finition: materiau?.finition ?? '',
      stockMinimum: materiau?.stockMinimum ?? 0, actif: materiau?.actif ?? true,
    },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit((v) =>
    save.mutate({ id: materiau?.id, ...v, couleur: v.couleur || null, finition: v.finition || null }, {
      onSuccess: () => { toast.success(materiau ? 'Matériau modifié (prix historisé)' : 'Matériau créé'); onClose(); },
    }),
  );
  return (
    <FormModal title={materiau ? `Modifier ${materiau.nom}` : 'Nouveau matériau'} open={open} onClose={onClose} onSubmit={() => void submit()} pending={save.isPending} error={save.error}>
      <Input label="Nom" required error={e.nom?.message} {...form.register('nom')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Unité" options={UNITE_OPTIONS} {...form.register('unite')} />
        <Input label="Prix d'achat HT (€)" type="number" step="0.01" required error={e.prixAchatFixe?.message} {...form.register('prixAchatFixe')} />
        <Select label="Fournisseur" placeholder="Aucun" hint="Nécessaire aux commandes automatiques" options={(fournisseurs.data ?? []).map((f) => ({ value: f.id, label: f.nom }))} {...form.register('fournisseurId')} />
        <Input label="Stock minimum" type="number" step="0.001" {...form.register('stockMinimum')} />
        <Input label="Couleur" {...form.register('couleur')} />
        <Input label="Finition" {...form.register('finition')} />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand-700" {...form.register('actif')} /> Actif (proposé dans les devis)</label>
    </FormModal>
  );
}

// ── Service de main d'œuvre ───────────────────────────────────────────────
const serviceSchema = z.object({
  nom: z.string().trim().min(1, 'Obligatoire'),
  unite,
  prixUnitaire: money,
  productiviteJour: optionalNumber,
  coutJournalier: optionalNumber,
  actif: z.boolean(),
});

export function ServiceModal({ open, onClose, service }: { open: boolean; onClose: () => void; service?: ServiceMo }) {
  const save = useSaveCatalogue('services-mo');
  const form = useForm<z.input<typeof serviceSchema>, unknown, z.output<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    values: {
      nom: service?.nom ?? '', unite: service?.unite ?? 'M2', prixUnitaire: service?.prixUnitaire ?? 0,
      productiviteJour: service?.productiviteJour ?? '', coutJournalier: service?.coutJournalier ?? '', actif: service?.actif ?? true,
    },
  });
  const submit = form.handleSubmit((v) =>
    save.mutate({ id: service?.id, ...v }, { onSuccess: () => { toast.success('Service enregistré'); onClose(); } }),
  );
  return (
    <FormModal title={service ? `Modifier ${service.nom}` : 'Nouveau service de main d’œuvre'} open={open} onClose={onClose} onSubmit={() => void submit()} pending={save.isPending} error={save.error}>
      <Input label="Nom" required error={form.formState.errors.nom?.message} {...form.register('nom')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Unité" options={UNITE_OPTIONS} {...form.register('unite')} />
        <Input label="Coût HT par unité (€)" type="number" step="0.01" required {...form.register('prixUnitaire')} />
        <Input label="Productivité / jour" type="number" step="0.01" {...form.register('productiviteJour')} />
        <Input label="Coût journalier (€)" type="number" step="0.01" {...form.register('coutJournalier')} />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand-700" {...form.register('actif')} /> Actif</label>
    </FormModal>
  );
}

// ── Prestation ────────────────────────────────────────────────────────────
const prestationSchema = z
  .object({
    nom: z.string().trim().min(1, 'Obligatoire'),
    description: z.string().trim(),
    categorieId: z.coerce.number().min(1, 'Choisissez une catégorie'),
    sousCategorieId: optionalId,
    unite,
    prixVenteMin: money,
    prixVenteMax: money,
    actif: z.boolean(),
  })
  .refine((v) => v.prixVenteMin <= v.prixVenteMax, { path: ['prixVenteMax'], message: 'Doit être ≥ au prix minimum' });

export function PrestationModal({ open, onClose, prestation }: { open: boolean; onClose: () => void; prestation?: Prestation }) {
  const save = useSaveCatalogue('prestations');
  const categories = useCategories();
  const form = useForm<z.input<typeof prestationSchema>, unknown, z.output<typeof prestationSchema>>({
    resolver: zodResolver(prestationSchema),
    values: {
      nom: prestation?.nom ?? '', description: prestation?.description ?? '',
      categorieId: prestation?.categorie.id ?? '', sousCategorieId: prestation?.sousCategorie?.id ?? '',
      unite: prestation?.unite ?? 'M2', prixVenteMin: prestation?.prixVenteMin ?? 0, prixVenteMax: prestation?.prixVenteMax ?? 0,
      actif: prestation?.actif ?? true,
    },
  });
  const e = form.formState.errors;
  const categorieId = Number(form.watch('categorieId'));
  const sousCategories = categories.data?.find((c) => c.id === categorieId)?.sousCategories ?? [];
  const submit = form.handleSubmit((v) =>
    save.mutate({ id: prestation?.id, ...v, description: v.description || null }, {
      onSuccess: () => { toast.success(prestation ? 'Prestation modifiée' : 'Prestation créée'); onClose(); },
    }),
  );
  return (
    <FormModal title={prestation ? `Modifier ${prestation.nom}` : 'Nouvelle prestation'} open={open} onClose={onClose} onSubmit={() => void submit()} pending={save.isPending} error={save.error}>
      <Input label="Nom" required error={e.nom?.message} {...form.register('nom')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Catégorie" required placeholder="Choisir…" error={e.categorieId?.message} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.nom }))} {...form.register('categorieId')} />
        <Select label="Sous-catégorie" placeholder="Aucune" options={sousCategories.map((s) => ({ value: s.id, label: s.nom }))} {...form.register('sousCategorieId')} />
        <Select label="Unité" options={UNITE_OPTIONS} {...form.register('unite')} />
        <div />
        <Input label="Prix de vente min. HT (€)" type="number" step="0.01" error={e.prixVenteMin?.message} {...form.register('prixVenteMin')} />
        <Input label="Prix de vente max. HT (€)" type="number" step="0.01" error={e.prixVenteMax?.message} {...form.register('prixVenteMax')} />
      </div>
      <Textarea label="Description" {...form.register('description')} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand-700" {...form.register('actif')} /> Active</label>
    </FormModal>
  );
}

// ── Catégorie ─────────────────────────────────────────────────────────────
export function CategorieModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const save = useSaveCatalogue('categories');
  const form = useForm<{ nom: string; description: string }>({ defaultValues: { nom: '', description: '' } });
  const submit = form.handleSubmit((v) =>
    save.mutate({ ...v, description: v.description || null }, { onSuccess: () => { toast.success('Catégorie créée'); form.reset(); onClose(); } }),
  );
  return (
    <FormModal title="Nouvelle catégorie" open={open} onClose={onClose} onSubmit={() => void submit()} pending={save.isPending} error={save.error}>
      <Input label="Nom" required {...form.register('nom', { required: true })} />
      <Textarea label="Description" {...form.register('description')} />
    </FormModal>
  );
}
