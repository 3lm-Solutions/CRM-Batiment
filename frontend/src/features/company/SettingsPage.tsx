import { zodResolver } from '@hookform/resolvers/zod';
import { BellRing, Building2, Calculator, ImageUp, Landmark, LifeBuoy, Play, Settings, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Card, CardHeader, ErrorState, Input, Loading, PageHeader } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatEuros, formatPercent } from '@/lib/format';
import { EMAIL_MESSAGE, zPhone } from '@/lib/validation';
import { useCompany, useCompanySettings, useUpdateCompany, useUpdateCompanySettings, type Company } from './api';
import type { CompanySettings } from '@/shared';
import { epcPayload, formatIban } from '@/lib/epc';
import { QrCode } from '@/components/QrCode';
import { type RelancesReglages, useExecuterRelances, useRelancesReglages, useUpdateRelancesReglages } from '../relances/api';

/** « 7, 14 » → [7, 14]; null if not 1 to 4 whole numbers within [min, max]. */
function parseJours(text: string, min: number, max: number): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < min || n > max)) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}

/** IBAN check digits (mod 97), as the API checks them: the error shows before saving. */
function ibanValide(v: string): boolean {
  const iban = v.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  let rest = 0;
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    for (const d of ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Bank details printed on invoices + SEPA payment QR code (21/10). */
function BanqueCard({ company }: { company: Company }) {
  const save = useUpdateCompany();
  const [iban, setIban] = useState(company.iban ? formatIban(company.iban) : '');
  const [bic, setBic] = useState(company.bic ?? '');
  useEffect(() => {
    setIban(company.iban ? formatIban(company.iban) : '');
    setBic(company.bic ?? '');
  }, [company.iban, company.bic]);
  const ibanErr = iban.trim() && !ibanValide(iban) ? 'IBAN invalide (vérifiez les chiffres)' : undefined;
  const bicErr = bic.trim() && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.trim().toUpperCase()) ? '8 ou 11 caractères, ex. BNPAFRPPXXX' : undefined;
  const exemple = iban.trim() && !ibanErr ? epcPayload({ beneficiaire: company.nom, iban, bic, montant: 100, libelle: 'Exemple' }) : null;

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Landmark className="size-4" /> Coordonnées bancaires</span>}
        description="Imprimées sur les factures émises, avec un QR code de paiement : le client le scanne avec son appli bancaire et le virement est prérempli"
      />
      <div className="flex flex-wrap items-start gap-5 p-5">
        <div className="min-w-0 flex-1 space-y-4">
          <Input label="IBAN" placeholder="FR76 3000 6000 0112 3456 7890 189" value={iban} onChange={(e) => setIban(e.target.value)} error={ibanErr} />
          <Input label="BIC" placeholder="BNPAFRPPXXX" value={bic} onChange={(e) => setBic(e.target.value.toUpperCase())} error={bicErr} hint="Facultatif pour un virement en zone SEPA" />
          <div className="flex justify-end">
            <Button
              loading={save.isPending}
              disabled={!!ibanErr || !!bicErr}
              onClick={() =>
                save.mutate(
                  { iban: iban.trim() ? iban : null, bic: bic.trim() ? bic.trim() : null },
                  { onSuccess: () => toast.success('Coordonnées bancaires enregistrées'), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              Enregistrer
            </Button>
          </div>
          <p className="text-xs text-slate-500">S’appliquent aux factures émises à partir de maintenant (une facture émise ne change plus). Les factures déjà émises et non payées les reçoivent à leur prochaine ouverture.</p>
        </div>
        {exemple && (
          <div className="text-center text-xs text-slate-500">
            <QrCode value={exemple} size={110} label="Exemple de QR code de paiement" />
            <p className="mt-1">Exemple (100 €)</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Automatic reminders (C3 of 21/10): on / off, delays, and a manual run. */
function RelancesCard() {
  const reglages = useRelancesReglages();
  if (reglages.isPending) return <Card><CardHeader title="Relances automatiques" /><p className="p-5 text-sm text-slate-500">Chargement…</p></Card>;
  if (reglages.isError) return <ErrorState error={reglages.error} onRetry={() => void reglages.refetch()} />;
  return <RelancesForm reglages={reglages.data} />;
}

function RelancesForm({ reglages }: { reglages: RelancesReglages }) {
  const save = useUpdateRelancesReglages();
  const run = useExecuterRelances();
  const [devis, setDevis] = useState(reglages.relanceDevisJours.join(', '));
  const [factures, setFactures] = useState(reglages.relanceFactureJours.join(', '));
  useEffect(() => {
    setDevis(reglages.relanceDevisJours.join(', '));
    setFactures(reglages.relanceFactureJours.join(', '));
  }, [reglages]);

  const devisJours = parseJours(devis, 1, 120);
  const factureJours = parseJours(factures, 0, 180);

  const toggle = () =>
    save.mutate(
      { relancesActives: !reglages.relancesActives },
      { onSuccess: (r) => toast.success(r.relancesActives ? 'Relances automatiques activées' : 'Relances automatiques coupées'), onError: (e) => toast.error(errorMessage(e)) },
    );
  const submit = () => {
    if (!devisJours || !factureJours) return;
    save.mutate({ relanceDevisJours: devisJours, relanceFactureJours: factureJours }, { onSuccess: () => toast.success('Délais enregistrés'), onError: (e) => toast.error(errorMessage(e)) });
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><BellRing className="size-4" /> Relances automatiques</span>}
        description="Chaque matin à 8 h, un email part aux clients qui n’ont pas répondu à un devis ou pas payé une facture"
      />
      <div className="space-y-4 p-5 text-sm">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="font-medium">Relances actives</span>
            <span className="block text-xs text-slate-500">Coupées, plus aucun email automatique ; « Relancer maintenant » reste possible sur chaque devis / facture.</span>
          </span>
          <input type="checkbox" className="size-5 accent-brand-700" checked={reglages.relancesActives} disabled={save.isPending} onChange={toggle} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Devis sans réponse : jours après l’envoi"
            value={devis}
            onChange={(e) => setDevis(e.target.value)}
            error={devisJours ? undefined : 'De 1 à 4 nombres entre 1 et 120, ex. 7, 14'}
            hint="Ex. 7, 14 : relance à J+7 puis J+14"
          />
          <Input
            label="Factures impayées : jours après l’échéance"
            value={factures}
            onChange={(e) => setFactures(e.target.value)}
            error={factureJours ? undefined : 'De 1 à 4 nombres entre 0 et 180, ex. 1, 15, 30'}
            hint="Ex. 1, 15, 30 : J+1, J+15 puis J+30"
          />
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="outline"
            icon={<Play className="size-4" />}
            loading={run.isPending}
            disabled={!reglages.relancesActives}
            onClick={() =>
              run.mutate(undefined, {
                onSuccess: (r) =>
                  r.devis + r.factures === 0
                    ? toast.info('Aucune relance à envoyer aujourd’hui.')
                    : toast.success(`${r.devis} devis et ${r.factures} facture(s) relancés${r.erreurs ? ` · ${r.erreurs} échec(s)` : ''}`),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Lancer les relances maintenant
          </Button>
          <Button loading={save.isPending} disabled={!devisJours || !factureJours} onClick={submit}>Enregistrer les délais</Button>
        </div>
      </div>
    </Card>
  );
}

// ── Coordinates ────────────────────────────────────────────────────────────
const companySchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.').max(150),
  siret: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ''))
    .refine((v) => !v || /^\d{14}$/.test(v), 'Le SIRET doit contenir 14 chiffres.'),
  adresse: z.string().trim().max(300),
  telephone: zPhone,
  email: z.string().trim().refine((v) => !v || z.string().email().safeParse(v).success, EMAIL_MESSAGE),
});

function CompanyCard({ company }: { company: Company }) {
  const save = useUpdateCompany();
  const form = useForm<z.input<typeof companySchema>, unknown, z.output<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    values: { nom: company.nom, siret: company.siret ?? '', adresse: company.adresse ?? '', telephone: company.telephone ?? '', email: company.email ?? '' },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit((v) =>
    save.mutate(
      { nom: v.nom, siret: v.siret || null, adresse: v.adresse || null, telephone: v.telephone || null, ...(v.email && { email: v.email }) },
      { onSuccess: () => toast.success('Coordonnées enregistrées') },
    ),
  );
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Building2 className="size-4" /> Coordonnées de l’entreprise</span>} description="Imprimées en en-tête des devis et des factures" />
      <form className="space-y-4 p-5" noValidate onSubmit={(ev) => { ev.preventDefault(); void submit(); }}>
        <Input label="Raison sociale" required error={e.nom?.message} {...form.register('nom')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="SIRET" placeholder="14 chiffres" error={e.siret?.message} {...form.register('siret')} />
          <Input label="Téléphone" error={e.telephone?.message} {...form.register('telephone')} />
        </div>
        <Input label="Email" type="email" error={e.email?.message} {...form.register('email')} />
        <Input label="Adresse" error={e.adresse?.message} {...form.register('adresse')} />
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
        <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Enregistrer</Button></div>
      </form>
    </Card>
  );
}

// ── Logo (B3 of 20/10) ─────────────────────────────────────────────────────
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 300 * 1024;

function LogoCard({ company }: { company: Company }) {
  const save = useUpdateCompany();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setError('Choisissez une image PNG, JPEG ou WebP.');
    if (file.size > LOGO_MAX_BYTES) return setError('Image trop lourde : 300 Ko maximum.');
    const reader = new FileReader();
    reader.onload = () =>
      save.mutate({ logo: String(reader.result) }, { onSuccess: () => toast.success('Logo enregistré'), onError: (e) => setError(errorMessage(e)) });
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><ImageUp className="size-4" /> Logo</span>}
        description="Affiché dans l’espace client et sur le lien de devis envoyé au client"
      />
      <div className="flex flex-wrap items-center gap-5 p-5">
        <div className="flex h-20 w-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
          {company.logo ? <img src={company.logo} alt="Logo de l’entreprise" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-500">Aucun logo</span>}
        </div>
        <div className="space-y-2">
          <input ref={input} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<ImageUp className="size-4" />} loading={save.isPending} onClick={() => input.current?.click()}>
              {company.logo ? 'Changer le logo' : 'Ajouter un logo'}
            </Button>
            {company.logo && (
              <Button variant="ghost" className="text-red-600" icon={<Trash2 className="size-4" />} disabled={save.isPending}
                onClick={() => save.mutate({ logo: null }, { onSuccess: () => toast.success('Logo supprimé'), onError: (e) => setError(errorMessage(e)) })}>
                Supprimer
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">PNG, JPEG ou WebP, 300 Ko maximum. Un fond transparent rend mieux.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </Card>
  );
}

// ── Pricing settings ───────────────────────────────────────────────────────
const pct = (max: number) => z.coerce.number({ invalid_type_error: 'Indiquez un nombre.' }).min(0, 'Doit être positif.').max(max, `${max} % maximum.`);
const settingsSchema = z
  .object({
    tvaDefaut: pct(100),
    acomptePercentDefault: pct(100),
    margeCiblePourcent: pct(95),
    seuilAlerteMargePourcent: pct(95),
    fraisFixeDeplacement: z.coerce.number({ invalid_type_error: 'Indiquez un nombre.' }).min(0, 'Doit être positif.'),
    pasArrondiPrix: z.coerce.number({ invalid_type_error: 'Indiquez un nombre.' }).min(0.01, '0,01 minimum.').max(1000),
  })
  .refine((v) => v.seuilAlerteMargePourcent <= v.margeCiblePourcent, {
    path: ['seuilAlerteMargePourcent'],
    message: 'Le seuil d’alerte doit être inférieur ou égal à la marge cible.',
  });

function SettingsCard({ settings }: { settings: CompanySettings }) {
  const save = useUpdateCompanySettings();
  const form = useForm<z.input<typeof settingsSchema>, unknown, z.output<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    values: {
      tvaDefaut: settings.tvaDefaut,
      acomptePercentDefault: settings.acomptePercentDefault,
      margeCiblePourcent: settings.margeCiblePourcent,
      seuilAlerteMargePourcent: settings.seuilAlerteMargePourcent,
      fraisFixeDeplacement: settings.fraisFixeDeplacement,
      pasArrondiPrix: settings.pasArrondiPrix,
    },
  });
  const e = form.formState.errors;
  const acompte = Number(form.watch('acomptePercentDefault')) || 0;
  const submit = form.handleSubmit((v) => save.mutate(v, { onSuccess: () => toast.success('Réglages enregistrés') }));
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Calculator className="size-4" /> Réglages de chiffrage et de facturation</span>} description="Utilisés pour les nouveaux devis, l’acompte et le calcul des marges" />
      <form className="space-y-4 p-5" noValidate onSubmit={(ev) => { ev.preventDefault(); void submit(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Acompte à la signature (%)" type="number" step="0.01" error={e.acomptePercentDefault?.message} hint={`Ex. devis de 10 000 € HT → acompte de ${formatEuros(100 * acompte)} HT. 0 = pas d’acompte.`} {...form.register('acomptePercentDefault')} />
          <Input label="TVA par défaut (%)" type="number" step="0.01" error={e.tvaDefaut?.message} {...form.register('tvaDefaut')} />
          <Input label="Marge cible (%)" type="number" step="0.01" error={e.margeCiblePourcent?.message} hint="Sert au « prix pour atteindre la marge cible »" {...form.register('margeCiblePourcent')} />
          <Input label="Seuil d’alerte de marge (%)" type="number" step="0.01" error={e.seuilAlerteMargePourcent?.message} hint="Un devis sous ce seuil est signalé" {...form.register('seuilAlerteMargePourcent')} />
          <Input label="Pas d’arrondi des prix (€)" type="number" step="0.01" error={e.pasArrondiPrix?.message} hint="Ex. 0,5 → 47,30 devient 47,50" {...form.register('pasArrondiPrix')} />
          <Input label="Frais fixes de déplacement (€)" type="number" step="0.01" error={e.fraisFixeDeplacement?.message} {...form.register('fraisFixeDeplacement')} />
        </div>
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Les devis déjà signés et les factures déjà créées ne changent pas. Valeurs actuelles : acompte {formatPercent(settings.acomptePercentDefault)}, marge cible {formatPercent(settings.margeCiblePourcent)}, alerte sous {formatPercent(settings.seuilAlerteMargePourcent)}.
        </p>
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
        <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Enregistrer</Button></div>
      </form>
    </Card>
  );
}

// ── After-sales period (Étape 2 of 26/10) ──────────────────────────────────
const DUREES_SAV = [
  { value: '12', label: '1 an (garantie de parfait achèvement)' },
  { value: '24', label: '2 ans (garantie biennale)' },
  { value: '120', label: '10 ans (garantie décennale)' },
  { value: '0', label: 'Sans limite' },
];

function SavCard({ settings }: { settings: CompanySettings }) {
  const save = useUpdateCompanySettings();
  const [mois, setMois] = useState(String(settings.savDureeMois));
  useEffect(() => setMois(String(settings.savDureeMois)), [settings.savDureeMois]);
  const n = Number(mois);
  const valide = Number.isInteger(n) && n >= 0 && n <= 120;
  const preset = DUREES_SAV.some((d) => d.value === mois);
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><LifeBuoy className="size-4" /> Service après-vente</span>}
        description="Un ticket SAV s’ouvre seulement sur un chantier terminé, pendant cette durée après la fin des travaux"
      />
      <div className="space-y-4 p-5">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Durée après la fin des travaux</legend>
          {DUREES_SAV.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="savDuree" className="size-4 accent-brand-700" checked={mois === d.value} onChange={() => setMois(d.value)} />
              {d.label}
            </label>
          ))}
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input type="radio" name="savDuree" className="size-4 accent-brand-700" checked={!preset} onChange={() => setMois('6')} />
            Autre :
            <input
              type="number"
              min={0}
              max={120}
              aria-label="Durée du SAV en mois"
              className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={preset ? '' : mois}
              onFocus={() => preset && setMois('6')}
              onChange={(e) => setMois(e.target.value)}
            />
            mois
          </label>
          {!valide && <p role="alert" className="text-sm text-red-600">De 0 à 120 mois (0 = sans limite).</p>}
        </fieldset>
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Pendant les travaux, le client ne peut pas ouvrir de ticket. Un administrateur peut toujours en ouvrir un (exception notée dans le ticket).
        </p>
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
        <div className="flex justify-end">
          <Button
            loading={save.isPending}
            disabled={!valide || n === settings.savDureeMois}
            onClick={() => save.mutate({ savDureeMois: n }, { onSuccess: () => toast.success('Durée du SAV enregistrée') })}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Market prices (29/10) ───────────────────────────────────────────────────
const PERIODES_MARCHE = [
  { value: 6, label: '6 mois', hint: 'Prix très récents, moins de devis' },
  { value: 12, label: '12 mois', hint: 'Recommandé' },
  { value: 24, label: '24 mois', hint: 'Plus de devis, prix plus anciens (la tendance corrige)' },
];

function PrixMarcheCard({ settings }: { settings: CompanySettings }) {
  const save = useUpdateCompanySettings();
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><TrendingUp className="size-4" /> Prix de marché</span>}
        description="Période des devis signés et des commandes fournisseur utilisés pour calculer les fourchettes de prix"
      />
      <div className="space-y-3 p-5">
        <div role="radiogroup" aria-label="Période du prix de marché" className="grid gap-2 sm:grid-cols-3">
          {PERIODES_MARCHE.map((p) => {
            const actif = settings.prixMarcheMois === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={actif}
                disabled={save.isPending}
                onClick={() => !actif && save.mutate({ prixMarcheMois: p.value }, { onSuccess: () => toast.success(`Prix de marché calculés sur ${p.label}`) })}
                className={
                  actif
                    ? 'rounded-xl border-2 border-brand-700 bg-brand-100/60 p-3 text-left dark:border-blue-400 dark:bg-slate-800'
                    : 'rounded-xl border-2 border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                }
              >
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="block text-xs text-slate-500">{p.hint}</span>
              </button>
            );
          })}
        </div>
        {save.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(save.error)}</p>}
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const company = useCompany();
  const settings = useCompanySettings();
  if (company.isPending || settings.isPending) return <Loading />;
  if (company.isError) return <ErrorState error={company.error} onRetry={() => void company.refetch()} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  return (
    <>
      <PageHeader icon={<Settings />} title="Paramètres" description="Coordonnées de l’entreprise et règles de chiffrage" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <CompanyCard company={company.data} />
          <LogoCard company={company.data} />
          <BanqueCard company={company.data} />
        </div>
        <div className="space-y-6">
          <SettingsCard settings={settings.data} />
          <RelancesCard />
          <SavCard settings={settings.data} />
          <PrixMarcheCard settings={settings.data} />
        </div>
      </div>
    </>
  );
}
