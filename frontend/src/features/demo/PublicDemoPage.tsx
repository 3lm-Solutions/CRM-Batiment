import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, CheckCircle2, MonitorPlay } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import { useSubmitDemo } from './api';
import { DEMO_URL, useDemoInfo } from './sandbox';
import { zPhone } from '@/lib/validation';

const schema = z.object({
  nom: z.string().trim().min(1, 'Obligatoire').max(100),
  prenom: z.string().trim().max(100),
  email: z.string().trim().email('Email invalide'),
  telephone: zPhone,
  entreprise: z.string().trim().max(150),
  message: z.string().trim().max(2000),
  // Honeypot, hidden from humans
  website: z.string(),
});
type FormValues = z.infer<typeof schema>;

/** Public "request a demo" page (no account). */
export function PublicDemoPage() {
  const submit = useSubmitDemo();
  const demo = useDemoInfo();
  // This instance IS the demo → its login page; otherwise the address configured at build time
  const essai = demo.data?.actif ? '/login' : DEMO_URL ? `${DEMO_URL.replace(/\/$/, '')}/login` : null;
  const [done, setDone] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom: '', prenom: '', email: '', telephone: '', entreprise: '', message: '', website: '' },
  });
  const errors = form.formState.errors;
  const orUndef = (s: string) => s || undefined;

  const onSubmit = form.handleSubmit((v) =>
    submit.mutate(
      { nom: v.nom, email: v.email, prenom: orUndef(v.prenom), telephone: orUndef(v.telephone), entreprise: orUndef(v.entreprise), message: orUndef(v.message), website: orUndef(v.website) },
      { onSuccess: (r) => setDone(r.message) },
    ),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 text-slate-900 dark:from-[#0f1117] dark:via-[#0f1117] dark:to-[#0f1117] dark:text-slate-100">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="group mb-8 flex items-center gap-3" aria-label="Retour à l’accueil">
          <span className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 text-white shadow-lg shadow-blue-500/30 transition group-hover:scale-105"><Building2 className="size-6" aria-hidden /></span>
          <span>
            <span className="block text-xl font-extrabold tracking-tight">{BRAND.prefix}<span className="text-blue-600">{BRAND.suffix}</span></span>
            <span className="block text-sm text-slate-500">Devis, chantiers et factures pour les entreprises du bâtiment</span>
          </span>
        </Link>
        {essai && (
          <a
            href={essai}
            className="mb-4 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200"
          >
            <MonitorPlay className="size-6 shrink-0" />
            <span className="flex-1">
              <strong className="block">Essayez tout de suite la démo en ligne</strong>
              Sans inscription : entrez comme administrateur, technico, chef de chantier…
            </span>
            <ArrowRight className="size-5 shrink-0" />
          </a>
        )}
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl sm:p-8 dark:border-white/10 dark:bg-[#1a1d2e]/90">
          {done ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
              <h1 className="text-xl font-bold">Merci !</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{done}</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Demander une démonstration</h1>
              <p className="mt-1 text-sm text-slate-500">Laissez-nous vos coordonnées : nous vous recontactons pour une démo de 30 minutes.</p>
              <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
                <Input label="Nom" required autoComplete="family-name" error={errors.nom?.message} {...form.register('nom')} />
                <Input label="Prénom" autoComplete="given-name" {...form.register('prenom')} />
                <Input label="Email professionnel" type="email" required autoComplete="email" containerClassName="sm:col-span-2" error={errors.email?.message} {...form.register('email')} />
                <Input label="Téléphone" type="tel" autoComplete="tel" error={errors.telephone?.message} {...form.register('telephone')} />
                <Input label="Entreprise" autoComplete="organization" {...form.register('entreprise')} />
                <Textarea label="Votre besoin" rows={4} containerClassName="sm:col-span-2" placeholder="Taille de l’entreprise, métiers, outils actuels…" {...form.register('message')} />
                {/* Honeypot: invisible and skipped by keyboard and screen readers */}
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" {...form.register('website')} />
                {submit.isError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{errorMessage(submit.error)}</p>}
                <Button type="submit" size="lg" className="sm:col-span-2" loading={submit.isPending}>Envoyer ma demande</Button>
              </form>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">Déjà client ? <Link to="/login" className="font-medium text-brand-700 hover:underline">Se connecter</Link></p>
      </div>
    </div>
  );
}
