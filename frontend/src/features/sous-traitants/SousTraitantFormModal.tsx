import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Input, Modal, Select, statusOptions } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useSaveSousTraitant, type SousTraitant, type SousTraitantStatut } from './api';
import { zPhone } from '@/lib/validation';

const schema = z.object({
  nom: z.string().trim().min(1, 'Obligatoire'),
  contact: z.string().trim(),
  siret: z.union([z.literal(''), z.string().trim().regex(/^\d{14}$/, '14 chiffres')]),
  email: z.union([z.literal(''), z.string().trim().email('Email invalide')]),
  telephone: zPhone,
  adresse: z.string().trim(),
  specialite: z.string().trim(),
  statut: z.enum(['ACTIF', 'INACTIF', 'SUSPENDU']),
});
type FormValues = z.infer<typeof schema>;

const toForm = (st?: SousTraitant): FormValues => ({
  nom: st?.nom ?? '',
  contact: st?.contact ?? '',
  siret: st?.siret ?? '',
  email: st?.email ?? '',
  telephone: st?.telephone ?? '',
  adresse: st?.adresse ?? '',
  specialite: st?.specialite ?? '',
  statut: st?.statut ?? 'ACTIF',
});
const orNull = (s: string) => s || null;

export function SousTraitantFormModal({ open, onClose, sousTraitant, onSaved }: { open: boolean; onClose: () => void; sousTraitant?: SousTraitant; onSaved?: (id: number) => void }) {
  const save = useSaveSousTraitant();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: toForm(sousTraitant) });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: sousTraitant?.id,
        nom: v.nom,
        contact: orNull(v.contact),
        siret: orNull(v.siret),
        email: orNull(v.email),
        telephone: orNull(v.telephone),
        adresse: orNull(v.adresse),
        specialite: orNull(v.specialite),
        ...(sousTraitant && { statut: v.statut as SousTraitantStatut }),
      },
      {
        onSuccess: (st) => {
          toast.success(sousTraitant ? 'Sous-traitant modifié' : 'Sous-traitant créé');
          onSaved?.(st.id);
          onClose();
        },
      },
    ),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={sousTraitant ? `Modifier ${sousTraitant.nom}` : 'Nouveau sous-traitant'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={save.isPending}>Enregistrer</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input label="Raison sociale" required error={errors.nom?.message} {...form.register('nom')} />
        <Input label="Spécialité" placeholder="Plomberie, électricité…" {...form.register('specialite')} />
        <Input label="Contact" {...form.register('contact')} />
        <Input label="SIRET" inputMode="numeric" error={errors.siret?.message} {...form.register('siret')} />
        <Input label="Email" type="email" error={errors.email?.message} {...form.register('email')} />
        <Input label="Téléphone" type="tel" error={errors.telephone?.message} {...form.register('telephone')} />
        <Input label="Adresse" containerClassName="sm:col-span-2" {...form.register('adresse')} />
        {sousTraitant && <Select label="Statut" options={statusOptions('sousTraitant')} {...form.register('statut')} />}
        {save.isError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{errorMessage(save.error)}</p>}
      </form>
    </Modal>
  );
}
