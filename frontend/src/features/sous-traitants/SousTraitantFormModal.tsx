import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Input, Modal, Select, statusOptions } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import { usePortalAccounts } from '../users/api';
import { useSaveSousTraitant, useSousTraitants, type SousTraitant, type SousTraitantStatut } from './api';
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

  // Creation from an existing SOUS_TRAITANT account (decision F1 of 20/10): the record is
  // linked to it at once, and contact / email / phone are taken from the account.
  const creating = !sousTraitant;
  const comptes = usePortalAccounts('SOUS_TRAITANT', open && creating);
  const tous = useSousTraitants({ page: 1, limit: 100 }, open && creating);
  const lieA = new Map((tous.data?.data ?? []).filter((x) => x.userId).map((x) => [x.userId!, x.nom]));
  const [compte, setCompte] = useState('');
  useEffect(() => {
    if (open) setCompte('');
  }, [open]);
  const pickAccount = (id: string) => {
    if (id && lieA.has(Number(id))) {
      toast.error(`Ce compte est déjà lié à « ${lieA.get(Number(id))} ». Choisissez-en un autre.`);
      return;
    }
    setCompte(id);
    const u = comptes.data?.find((x) => x.id === Number(id));
    if (!u) return;
    const fill = (k: 'nom' | 'contact' | 'email' | 'telephone', v: string) => {
      if (!form.getValues(k)) form.setValue(k, v, { shouldValidate: true });
    };
    fill('nom', fullName(u)); // raison sociale to adjust if needed
    fill('contact', fullName(u));
    fill('email', u.email);
    fill('telephone', u.telephone ?? '');
  };

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
        ...(creating && compte && { userId: Number(compte) }),
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
        {creating && (
          <Select
            label="Créer depuis un compte existant"
            containerClassName="sm:col-span-2"
            hint="Facultatif — le compte (rôle Sous-traitant, créé dans Utilisateurs) est lié à la fiche : il verra ses chantiers et tâches dans son espace."
            placeholder="Aucun (fiche sans accès portail)"
            options={(comptes.data ?? []).map((u) => ({
              value: u.id,
              label: `${fullName(u)} — ${u.email}${lieA.has(u.id) ? ` (déjà lié à ${lieA.get(u.id)})` : ''}`,
            }))}
            value={compte}
            onChange={(e) => pickAccount(e.target.value)}
          />
        )}
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
