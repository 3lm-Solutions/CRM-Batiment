import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCES, useSaveClient, useTypesProjet, type Client, type LeadSource } from './api';
import { zPhone } from '@/lib/validation';

const schema = z.object({
  nom: z.string().trim().min(1, 'Obligatoire'),
  prenom: z.string().trim(),
  email: z.union([z.literal(''), z.string().trim().email('Email invalide')]),
  telephone: zPhone,
  adresseClient: z.string().trim(),
  adresseChantier: z.string().trim(),
  source: z.enum(Object.keys(LEAD_SOURCES) as [LeadSource, ...LeadSource[]]),
  besoin: z.string().trim(),
  notes: z.string().trim(),
  // Checkbox groups hold strings; converted to numbers on submit
  typeProjetIds: z.array(z.string()).transform((ids) => ids.map(Number)),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const toForm = (c?: Client): FormInput => ({
  nom: c?.nom ?? '',
  prenom: c?.prenom ?? '',
  email: c?.email ?? '',
  telephone: c?.telephone ?? '',
  adresseClient: c?.adresseClient ?? '',
  adresseChantier: c?.adresseChantier ?? '',
  source: c?.source ?? 'AUTRE',
  besoin: c?.besoin ?? '',
  notes: c?.notes ?? '',
  typeProjetIds: (c?.typeProjetIds ?? []).map(String),
});

const nullIfEmpty = (s: string) => s || null;

export function ClientFormModal({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client; onSaved?: (c: Client) => void }) {
  const save = useSaveClient();
  const types = useTypesProjet();
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), values: toForm(client) });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: client?.id,
        nom: v.nom,
        source: v.source,
        typeProjetIds: v.typeProjetIds,
        prenom: nullIfEmpty(v.prenom),
        email: nullIfEmpty(v.email),
        telephone: nullIfEmpty(v.telephone),
        adresseClient: nullIfEmpty(v.adresseClient),
        adresseChantier: nullIfEmpty(v.adresseChantier),
        besoin: nullIfEmpty(v.besoin),
        notes: nullIfEmpty(v.notes),
      },
      {
        onSuccess: (saved) => {
          toast.success(client ? 'Client modifié' : 'Client créé');
          onSaved?.(saved);
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
      title={client ? `Modifier ${client.nom}` : 'Nouveau client'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={save.isPending}>Enregistrer</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nom ou raison sociale" required error={errors.nom?.message} {...form.register('nom')} />
          <Input label="Prénom" {...form.register('prenom')} />
          <Input label="Email" type="email" hint="Nécessaire pour envoyer les devis en ligne" error={errors.email?.message} {...form.register('email')} />
          <Input label="Téléphone" type="tel" error={errors.telephone?.message} {...form.register('telephone')} />
          <Input label="Adresse du client" {...form.register('adresseClient')} />
          <Input label="Adresse du chantier" hint="Si différente" {...form.register('adresseChantier')} />
        </div>
        <Select label="Origine" options={LEAD_SOURCE_OPTIONS} {...form.register('source')} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Types de projet</legend>
          <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
            {types.data?.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={String(t.id)} className="size-4 rounded accent-brand-700" {...form.register('typeProjetIds')} />
                {t.nom}
              </label>
            ))}
          </div>
        </fieldset>
        <Textarea label="Besoin exprimé" {...form.register('besoin')} />
        <Textarea label="Notes internes" {...form.register('notes')} />
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      </form>
    </Modal>
  );
}
