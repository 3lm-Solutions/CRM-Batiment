import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCES, STATUTS_CLIENT, TYPES_CLIENT, useSaveClient, useTypesProjet, type Client, type LeadSource, type StatutClient, type TypeClient } from './api';
import { zPhone, zSiret, zTvaIntracom } from '@/lib/validation';

const schema = z.object({
  statut: z.enum(Object.keys(STATUTS_CLIENT) as [StatutClient, ...StatutClient[]]),
  typeClient: z.enum(Object.keys(TYPES_CLIENT) as [TypeClient, ...TypeClient[]]),
  nom: z.string().trim().min(1, 'Obligatoire'),
  prenom: z.string().trim(),
  siret: zSiret,
  tvaIntracom: zTvaIntracom,
  contactNom: z.string().trim(),
  contactFonction: z.string().trim(),
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

const toForm = (c: Client | undefined, statutInitial: StatutClient): FormInput => ({
  statut: c?.statut ?? statutInitial,
  typeClient: c?.typeClient ?? 'PARTICULIER',
  nom: c?.nom ?? '',
  prenom: c?.prenom ?? '',
  siret: c?.siret ?? '',
  tvaIntracom: c?.tvaIntracom ?? '',
  contactNom: c?.contactNom ?? '',
  contactFonction: c?.contactFonction ?? '',
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

const CHOIX: { value: TypeClient; label: string; hint: string; icon: typeof User }[] = [
  { value: 'PARTICULIER', label: 'Particulier', hint: 'Une personne', icon: User },
  { value: 'PROFESSIONNEL', label: 'Professionnel', hint: 'Une entreprise', icon: Building2 },
];

export function ClientFormModal({
  open,
  onClose,
  client,
  onSaved,
  statutInitial = 'QUALIFIE',
}: {
  open: boolean;
  onClose: () => void;
  client?: Client;
  onSaved?: (c: Client) => void;
  /** New contact from the « Prospects » page (QUALIFIE, 29/10) or the « Clients » page (CLIENT) — 27/10 */
  statutInitial?: StatutClient;
}) {
  const save = useSaveClient();
  const types = useTypesProjet();
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), values: toForm(client, statutInitial) });
  const errors = form.formState.errors;
  const typeClient = form.watch('typeClient');
  const pro = typeClient === 'PROFESSIONNEL';

  const submit = form.handleSubmit((v) => {
    const estPro = v.typeClient === 'PROFESSIONNEL';
    save.mutate(
      {
        id: client?.id,
        // Sent only when changed: the automatic moves (quote sent / signed) are kept otherwise
        ...(!client || v.statut !== client.statut ? { statut: v.statut } : {}),
        typeClient: v.typeClient,
        nom: v.nom,
        source: v.source,
        typeProjetIds: v.typeProjetIds,
        // A company has no first name; a private person no company fields (the API applies the same rule)
        prenom: estPro ? null : nullIfEmpty(v.prenom),
        siret: estPro ? nullIfEmpty(v.siret.replace(/[\s.-]+/g, '')) : null,
        tvaIntracom: estPro ? nullIfEmpty(v.tvaIntracom.replace(/[\s.-]+/g, '').toUpperCase()) : null,
        contactNom: estPro ? nullIfEmpty(v.contactNom) : null,
        contactFonction: estPro ? nullIfEmpty(v.contactFonction) : null,
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
    );
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={client ? `Modifier ${client.nom}` : statutInitial === 'CLIENT' ? 'Nouveau client' : 'Nouveau prospect'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} loading={save.isPending}>Enregistrer</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div role="radiogroup" aria-label="Type de client" className="grid grid-cols-2 gap-3">
          {CHOIX.map((c) => {
            const actif = typeClient === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => form.setValue('typeClient', c.value, { shouldDirty: true })}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                  actif
                    ? 'border-brand-700 bg-brand-100/60 ring-2 ring-brand-500/30 dark:border-blue-400 dark:bg-slate-800'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                )}
              >
                <c.icon className={cn('size-5', actif ? 'text-brand-700 dark:text-blue-300' : 'text-slate-400')} />
                <span>
                  <span className="block text-sm font-semibold">{c.label}</span>
                  <span className="block text-xs text-slate-500">{c.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {pro ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Raison sociale" required containerClassName="sm:col-span-2" maxLength={150} error={errors.nom?.message} {...form.register('nom')} />
            <Input label="SIRET" hint="Facultatif — 14 chiffres" inputMode="numeric" error={errors.siret?.message} {...form.register('siret')} />
            <Input label="N° TVA intracommunautaire" hint="Facultatif — ex. FR40303265045" error={errors.tvaIntracom?.message} {...form.register('tvaIntracom')} />
            <Input label="Personne à contacter" maxLength={150} {...form.register('contactNom')} />
            <Input label="Fonction" maxLength={100} placeholder="Ex. : Responsable travaux" {...form.register('contactFonction')} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom" required maxLength={150} error={errors.nom?.message} {...form.register('nom')} />
            <Input label="Prénom" maxLength={100} {...form.register('prenom')} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" hint="Nécessaire pour envoyer les devis en ligne" error={errors.email?.message} {...form.register('email')} />
          <Input label="Téléphone" type="tel" error={errors.telephone?.message} {...form.register('telephone')} />
          <Input label={pro ? 'Adresse de facturation' : 'Adresse du client'} {...form.register('adresseClient')} />
          <Input label="Adresse du chantier" hint="Si différente" {...form.register('adresseChantier')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Étape"
            hint="Devient client tout seul à la signature d’un devis"
            // 29/10: « Prospect » (not qualified) only for an older contact still at that stage
            options={Object.entries(STATUTS_CLIENT)
              .filter(([value]) => value !== 'PROSPECT' || client?.statut === 'PROSPECT')
              .map(([value, label]) => ({ value, label }))}
            {...form.register('statut')}
          />
          <Select label="Origine" options={LEAD_SOURCE_OPTIONS} {...form.register('source')} />
        </div>
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
