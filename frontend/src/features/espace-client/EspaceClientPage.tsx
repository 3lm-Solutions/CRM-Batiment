import { ArrowLeft, Camera, CheckCircle2, Eye, HardHat, LifeBuoy, Printer, Send, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthImage } from '@/components/files/AuthImage';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, CardHeader, EmptyState, Input, Loading, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { errorMessage, toProblem } from '@/lib/api';
import { openFichier } from '@/lib/files';
import { formatDate, formatDateTime, formatEuros, formatNumber, formatPercent, formatUnite, fullName } from '@/lib/format';
import { ClientMentionsPro } from '../clients/ClientMentionsPro';
import { ChantierSuivi } from './ChantierSuivi';
import { FACTURE_TYPE_TITLE } from '../factures/api';
import { FactureQrCodes } from '../factures/FactureQrCodes';
import { PHOTO_TYPES, SAV_CATEGORIES, type SavCategorie, type SavStatut } from '../sav/api';
import { espacePhotoPath, MAX_PHOTOS_CLIENT, useEspaceClient, useEspaceDevis, useEspaceFacture, useEspaceSav, useEspaceSavMessage, type EspaceClient, type EspaceFacture, type EspaceSource } from './api';

type Tab = 'chantiers' | 'devis' | 'factures' | 'sav';
type View = { type: 'devis' | 'facture'; id: number } | null;

function Shell({ entreprise, children, apercuClientId }: { entreprise?: EspaceClient['entreprise']; children: ReactNode; apercuClientId?: number }) {
  return (
    <main className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-950">
      {apercuClientId !== undefined && (
        <div className="bg-amber-100 text-amber-950 print:hidden">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span className="inline-flex items-center gap-2"><Eye className="size-4" /> Aperçu : vous voyez l’espace de ce client exactement comme lui (lecture seule).</span>
            <Link to={`/clients/${apercuClientId}`} className="font-semibold underline">Retour à la fiche client</Link>
          </div>
        </div>
      )}
      <header className="sidebar-gradient text-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          {entreprise?.logo ? (
            <div className="flex h-10 max-w-32 items-center justify-center rounded-xl bg-white px-2"><img src={entreprise.logo} alt={`Logo ${entreprise.nom}`} className="max-h-8 max-w-full object-contain" /></div>
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15"><HardHat className="size-5" aria-hidden /></div>
          )}
          <div>
            <p className="text-lg font-bold">{entreprise?.nom ?? 'Espace client'}</p>
            {entreprise && <p className="text-xs text-cyan-50/80">{[entreprise.telephone, entreprise.email].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-4 pt-8 print:pt-0">{children}</div>
    </main>
  );
}

function DevisView({ source, id, onBack }: { source: EspaceSource; id: number; onBack: () => void }) {
  const q = useEspaceDevis(source, id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <p role="alert" className="text-sm text-red-600">{errorMessage(q.error)}</p>;
  const d = q.data;
  return (
    <>
      <div className="flex justify-between print:hidden">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Retour</Button>
        <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
      <Card className="print-area p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="text-lg font-bold">{d.company.nom}</p>
            {d.company.adresse && <p className="text-slate-600">{d.company.adresse}</p>}
            {d.company.siret && <p className="text-slate-600">SIRET {d.company.siret}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold">{fullName(d.client)}</p>
            {d.client.adresseChantier && <p className="text-slate-600">Chantier : {d.client.adresseChantier}</p>}
          </div>
        </div>
        <h2 className="mt-6 text-2xl font-bold">Devis {d.reference}{d.versionCourante > 1 ? ` · v${d.versionCourante}` : ''}</h2>
        <p className="text-sm text-slate-500">Émis le {formatDate(d.dateEnvoi ?? d.dateCreation)} · <StatusBadge kind="devis" value={d.statut} /></p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2">Désignation</th><th className="py-2 text-right">Qté</th><th className="py-2 text-right">PU HT</th><th className="py-2 text-right">Total HT</th></tr></thead>
            <tbody>
              {d.lignes.map((l) => (
                <tr key={l.ordre} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">{l.description}{[l.dimension, l.couleur, l.finition].filter(Boolean).length > 0 && <span className="block text-xs text-slate-500">{[l.dimension, l.couleur, l.finition].filter(Boolean).join(' · ')}</span>}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(l.quantite)} {formatUnite(l.unite)}</td>
                  <td className="py-2 text-right tabular-nums">{formatEuros(l.prixUnitaireVente)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{formatEuros(l.totalHT)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatEuros(d.totalHT)}</dd></div>
          <div className="flex justify-between"><dt>TVA {formatPercent(d.tauxTVA)}</dt><dd className="tabular-nums">{formatEuros(d.totalTVA)}</dd></div>
          <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>Total TTC</dt><dd className="tabular-nums">{formatEuros(d.totalTTC)}</dd></div>
        </dl>
        {['ENVOYE', 'RENVOYE', 'ACCEPTE'].includes(d.statut) && (
          <p className="mt-6 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 print:hidden">Pour accepter ou signer ce devis, utilisez le lien sécurisé reçu par email pour ce devis.</p>
        )}
      </Card>
    </>
  );
}

function FactureView({ source, id, onBack }: { source: EspaceSource; id: number; onBack: () => void }) {
  const q = useEspaceFacture(source, id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <p role="alert" className="text-sm text-red-600">{errorMessage(q.error)}</p>;
  return (
    <>
      <div className="flex justify-between print:hidden">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Retour</Button>
        <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
      <FactureClientDocument f={q.data} />
    </>
  );
}

/** An issued invoice as the client sees it (client space, and the public link / QR code of 21/10). */
export function FactureClientDocument({ f, showLien = true }: { f: EspaceFacture; showLien?: boolean }) {
  return (
      <Card className="print-area p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="text-lg font-bold">{f.companyNom}</p>
            {f.companyAdresse && <p className="whitespace-pre-line text-slate-600">{f.companyAdresse}</p>}
            {f.companySiret && <p className="text-slate-600">SIRET {f.companySiret}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-slate-500">Facturé à</p>
            <p className="font-semibold">{fullName({ nom: f.nomClient ?? '', prenom: f.prenomClient })}</p>
            <ClientMentionsPro client={{ siret: f.clientSiret, tvaIntracom: f.clientTvaIntracom }} />
            {f.adresseClient && <p className="whitespace-pre-line text-slate-600">{f.adresseClient}</p>}
          </div>
        </div>
        <h2 className="mt-6 text-2xl font-bold">{FACTURE_TYPE_TITLE[f.typeFacture]}{f.numeroSituation ? ` n° ${f.numeroSituation}` : ''}</h2>
        <p className="text-sm text-slate-500">
          N° {f.reference} · émise le {formatDate(f.dateEmission)} · échéance {formatDate(f.dateEcheance)}{f.referenceDevis && ` · devis ${f.referenceDevis}`}
          {f.factureOrigine?.reference && ` · annule la facture ${f.factureOrigine.reference}`}
        </p>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2">Description</th><th className="py-2 text-right">Qté</th><th className="py-2 text-right">PU HT</th><th className="py-2 text-right">Total HT</th></tr></thead>
          <tbody>
            {f.lignes.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-pre-line py-2 pr-3">{l.description}</td>
                <td className="py-2 text-right tabular-nums">{formatNumber(l.quantite)} {l.unite.toLowerCase()}</td>
                <td className="py-2 text-right tabular-nums">{formatEuros(l.prixUnitaireHT)}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatEuros(l.montantHT)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatEuros(f.montantHT)}</dd></div>
          <div className="flex justify-between"><dt>TVA {formatPercent(f.tauxTVA)}</dt><dd className="tabular-nums">{formatEuros(f.montantTVA)}</dd></div>
          <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>Total TTC</dt><dd className="tabular-nums">{formatEuros(f.montantTTC)}</dd></div>
        </dl>
        {(f.conditionsPaiement || f.communicationPaiement || f.notesLegales) && (
          <div className="mt-6 space-y-1 border-t pt-3 text-xs text-slate-600">
            {f.conditionsPaiement && <p><span className="font-semibold">Conditions :</span> {f.conditionsPaiement}</p>}
            {f.communicationPaiement && <p><span className="font-semibold">Communication :</span> {f.communicationPaiement}</p>}
            {f.notesLegales && <p className="whitespace-pre-line">{f.notesLegales}</p>}
          </div>
        )}
        <FactureQrCodes f={f} showLien={showLien} />
        {f.statut === 'PAYEE' && <p className="mt-6 text-center text-lg font-bold uppercase tracking-widest text-emerald-600">Payée le {formatDate(f.datePaiement)}</p>}
      </Card>
  );
}

const SAV_STEPS: { statut: SavStatut; label: string }[] = [
  { statut: 'OUVERT', label: 'Demande enregistrée' },
  { statut: 'EN_COURS', label: 'Prise en charge' },
  { statut: 'EN_ATTENTE_CLIENT', label: 'En attente de votre réponse' },
  { statut: 'RESOLU', label: 'Résolue' },
  { statut: 'CLOTURE', label: 'Clôturée' },
];
const stepLabel = (statut: SavStatut) => SAV_STEPS.find((x) => x.statut === statut)?.label ?? statut;

/** Follow-up of one request (G of 20/10): status timeline, then the conversation with the team. */
function SavTicketSuivi({ t, source }: { t: EspaceClient['sav'][number]; source: EspaceSource }) {
  const photos = t.photos ?? [];
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`Photos de ${t.reference}`}>
          {photos.map((p) => (
            <li key={p.id} className="text-center">
              <AuthImage
                path={espacePhotoPath(source, p.id)}
                alt={p.nom}
                className="size-16 rounded-lg"
                onClick={() => void openFichier(p.id, espacePhotoPath(source, p.id))}
              />
              <span className="text-[10px] text-slate-500">{p.auteur === 'CLIENT' ? 'Vous' : 'Équipe'}</span>
            </li>
          ))}
        </ul>
      )}
      <ol className="relative ml-2 space-y-2 border-l border-slate-200 pl-4 dark:border-slate-700" aria-label={`Suivi de ${t.reference}`}>
        {t.historique.map((h, i) => {
          const last = i === t.historique.length - 1;
          return (
            <li key={`${h.statut}-${h.createdAt}`} className="relative text-xs">
              <span className={`absolute -left-[21px] top-1 size-2.5 rounded-full ${last ? 'bg-brand-700 ring-4 ring-brand-100 dark:ring-brand-900' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden />
              <span className={last ? 'font-semibold' : 'text-slate-600 dark:text-slate-400'}>{stepLabel(h.statut)}</span>
              <span className="ml-2 text-slate-500">{formatDateTime(h.createdAt)}</span>
            </li>
          );
        })}
      </ol>
      {t.messages.length > 0 && (
        <div className="space-y-2">
          {t.messages.map((m) =>
            m.auteur === 'CLIENT' ? (
              <div key={m.id} className="ml-8 rounded-lg bg-brand-100 p-2 text-xs dark:bg-slate-800">
                <p className="mb-0.5 font-semibold text-brand-900 dark:text-blue-300">Vous · {formatDateTime(m.createdAt)}</p>
                <p className="whitespace-pre-line">{m.contenu}</p>
              </div>
            ) : (
              <div key={m.id} className="mr-8 rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-0.5 font-semibold">Équipe{m.auteurPrenom ? ` (${m.auteurPrenom})` : ''} · {formatDateTime(m.createdAt)}</p>
                <p className="whitespace-pre-line">{m.contenu}</p>
              </div>
            ),
          )}
        </div>
      )}
      {t.statut === 'EN_ATTENTE_CLIENT' && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Nous attendons votre réponse pour avancer.</p>}
    </div>
  );
}

/** Photos picked for a new request, previewed before sending (C42 of 21/10). */
function PhotosPicker({ photos, onChange }: { photos: File[]; onChange: (photos: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = photos.map((p) => URL.createObjectURL(p));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [photos]);

  const add = (list: FileList | null) => {
    setError(null);
    const files = [...(list ?? [])];
    if (files.some((f) => !PHOTO_TYPES.includes(f.type))) return setError('Photos JPEG, PNG ou WebP uniquement.');
    if (files.some((f) => f.size > 10 * 1024 * 1024)) return setError('10 Mo maximum par photo.');
    if (photos.length + files.length > MAX_PHOTOS_CLIENT) return setError(`${MAX_PHOTOS_CLIENT} photos au maximum.`);
    onChange([...photos, ...files]);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Photos <span className="font-normal text-slate-500">(facultatif, {MAX_PHOTOS_CLIENT} max.)</span></p>
      <div className="flex flex-wrap items-center gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative">
            <img src={u} alt={photos[i]?.name ?? 'Photo'} className="size-16 rounded-lg object-cover" />
            <button
              type="button"
              aria-label={`Retirer ${photos[i]?.name ?? 'la photo'}`}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-slate-700 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS_CLIENT && (
          <>
            <input ref={input} type="file" multiple accept={PHOTO_TYPES.join(',')} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            <Button type="button" size="sm" variant="outline" icon={<Camera className="size-4" />} onClick={() => input.current?.click()}>
              Ajouter des photos
            </Button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SavSection({ token, source, data }: { token: string | null; source: EspaceSource; data: EspaceClient }) {
  // token null = office preview: same view, no form
  const ouvrir = useEspaceSav(token ?? '');
  const message = useEspaceSavMessage(token ?? '');
  const readOnly = token === null;
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [categorie, setCategorie] = useState<SavCategorie>('DEFAUT_TRAVAUX');
  const [photos, setPhotos] = useState<File[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});
  // Étape 2 (26/10): the SAV is for finished works, within the company's period
  const eligibles = data.chantiers.filter((c) => c.sav?.possible);
  const enCours = data.chantiers.filter((c) => !c.sav?.possible && c.sav?.motif && !['TERMINE', 'CLOTURE'].includes(c.statut));
  useEffect(() => {
    if (!chantierId && eligibles.length === 1) setChantierId(String(eligibles[0].id));
  }, [chantierId, eligibles]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {!readOnly && eligibles.length === 0 && (
      <Card>
        <CardHeader title="Service après-vente" />
        <div className="space-y-3 p-5 text-sm">
          <p>Le service après-vente s’ouvre <span className="font-semibold">à la fin des travaux</span>, pour un chantier terminé.</p>
          {enCours.length > 0 && (
            <p className="text-slate-600 dark:text-slate-400">
              Votre chantier est en cours : pour toute question, contactez votre chef de chantier
              {enCours[0].chefChantier?.telephone ? ` au ${enCours[0].chefChantier.telephone}` : ''} ou {data.entreprise.telephone ?? data.entreprise.email ?? 'l’entreprise'}.
            </p>
          )}
          {data.chantiers.some((c) => ['TERMINE', 'CLOTURE'].includes(c.statut)) && (
            <p className="text-slate-600 dark:text-slate-400">La période de service après-vente de vos chantiers terminés est écoulée : contactez {data.entreprise.telephone ?? data.entreprise.email ?? 'l’entreprise'}.</p>
          )}
        </div>
      </Card>
      )}
      {!readOnly && eligibles.length > 0 && (
      <Card>
        <CardHeader title="Signaler un problème" description="Après travaux : défaut, malfaçon, question… Nous vous recontactons." />
        <div className="space-y-4 p-5">
          {done && <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="size-5 shrink-0" /> {done}</p>}
          <Input label="Objet" required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : le joint de la douche fuit" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Chantier"
              required
              placeholder="Choisir…"
              options={eligibles.map((c) => ({ value: c.id, label: `${c.reference} · ${c.adresse}${c.sav?.jusquau ? ` (SAV jusqu’au ${formatDate(c.sav.jusquau)})` : ''}` }))}
              value={chantierId}
              onChange={(e) => setChantierId(e.target.value)}
            />
            <Select label="Type" options={Object.entries(SAV_CATEGORIES).map(([value, label]) => ({ value, label }))} value={categorie} onChange={(e) => setCategorie(e.target.value as SavCategorie)} />
          </div>
          <Textarea label="Description" required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          <PhotosPicker photos={photos} onChange={setPhotos} />
          {ouvrir.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(ouvrir.error)}</p>}
          <Button
            icon={<Send className="size-4" />}
            disabled={!titre.trim() || !description.trim() || !chantierId}
            loading={ouvrir.isPending}
            onClick={() =>
              ouvrir.mutate(
                { titre: titre.trim(), description: description.trim(), chantierId: Number(chantierId), categorie, photos },
                { onSuccess: (r) => { setDone(r.message); setTitre(''); setDescription(''); setPhotos([]); } },
              )
            }
          >
            Envoyer
          </Button>
          <p className="text-xs text-slate-500">Vous recevez un email à chaque étape du traitement de votre demande.</p>
        </div>
      </Card>
      )}
      <Card className={readOnly ? 'lg:col-span-2' : undefined}>
        <CardHeader title={readOnly ? 'Demandes du client' : 'Mes demandes'} description="Suivi étape par étape et échanges avec l’équipe" />
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.sav.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune demande.</li>}
          {data.sav.map((t) => (
            <li key={t.id} className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span><span className="font-medium">{t.reference}</span> · {t.titre}</span>
                <StatusBadge kind="sav" value={t.statut} />
              </div>
              <p className="text-xs text-slate-500">Ouverte le {formatDate(t.createdAt)}{t.chantier && ` · ${t.chantier.reference}`}{t.dateResolution && ` · résolue le ${formatDate(t.dateResolution)}`}</p>
              <SavTicketSuivi t={t} source={source} />
              {!readOnly && t.statut !== 'CLOTURE' && (
                <div className="flex gap-2">
                  <input
                    aria-label={`Message pour ${t.reference}`}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                    placeholder={t.statut === 'EN_ATTENTE_CLIENT' ? 'Votre réponse…' : 'Ajouter une précision…'}
                    value={replies[t.id] ?? ''}
                    onChange={(e) => setReplies((r) => ({ ...r, [t.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!replies[t.id]?.trim()}
                    loading={message.isPending && message.variables?.id === t.id}
                    onClick={() => message.mutate({ id: t.id, contenu: replies[t.id].trim() }, { onSuccess: () => setReplies((r) => ({ ...r, [t.id]: '' })) })}
                  >
                    Envoyer
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Client online space, opened from the emailed link (no account). */
export function EspaceClientPage() {
  const token = useParams().token ?? '';
  return <EspaceClientView source={{ token }} />;
}

/** Office: the client's space exactly as he sees it, without sending a link (E1 of 20/10). */
export function EspaceClientApercuPage() {
  const clientId = Number(useParams().id);
  return <EspaceClientView source={{ clientId }} />;
}

function EspaceClientView({ source }: { source: EspaceSource }) {
  const espace = useEspaceClient(source);
  const apercuClientId = 'clientId' in source ? source.clientId : undefined;
  const token = 'token' in source ? source.token : null;
  const [tab, setTab] = useState<Tab | null>(null);
  const [view, setView] = useState<View>(null);

  if (espace.isPending) return <Shell apercuClientId={apercuClientId}><Loading /></Shell>;
  if (espace.isError) {
    const p = toProblem(espace.error);
    return (
      <Shell apercuClientId={apercuClientId}>
        <Card><EmptyState icon={<XCircle className="size-6" />} title={p.status === 410 ? 'Lien expiré ou désactivé' : 'Espace indisponible'} description={p.message} /></Card>
      </Shell>
    );
  }
  const d = espace.data;
  const current: Tab = tab ?? (d.chantiers.length ? 'chantiers' : 'devis');

  return (
    <Shell entreprise={d.entreprise} apercuClientId={apercuClientId}>
      {view ? (
        view.type === 'devis' ? <DevisView source={source} id={view.id} onBack={() => setView(null)} /> : <FactureView source={source} id={view.id} onBack={() => setView(null)} />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold">Bonjour {d.client.typeClient === 'PROFESSIONNEL' && d.client.contactNom ? d.client.contactNom : fullName(d.client)}</h1>
            <p className="text-sm text-slate-500">
              {d.expiresAt
                ? `Votre espace personnel, valable jusqu’au ${formatDate(d.expiresAt)}.`
                : 'Aucun lien actif : le client n’a pas accès à cet espace tant que vous ne lui avez pas envoyé le lien.'}
            </p>
          </div>
          <Tabs
            value={current}
            onChange={setTab}
            tabs={[
              { value: 'chantiers', label: `Chantiers (${d.chantiers.length})` },
              { value: 'devis', label: `Devis (${d.devis.length})` },
              { value: 'factures', label: `Factures (${d.factures.length})` },
              { value: 'sav', label: 'Service après-vente' },
            ]}
          />
          {current === 'chantiers' && (
            <div className="space-y-4">
              {d.chantiers.length === 0 && <Card><EmptyState title="Aucun chantier pour l’instant" /></Card>}
              {d.chantiers.map((c) => (
                <ChantierSuivi key={c.id} c={c} source={source} token={token} entreprise={d.entreprise} />
              ))}
            </div>
          )}
          {current === 'devis' && (
            <Card>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.devis.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucun devis.</li>}
                {d.devis.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => setView({ type: 'devis', id: x.id })} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span><span className="font-medium">{x.reference}</span> <span className="text-slate-500">· {formatDate(x.dateEnvoi)}</span></span>
                      <span className="flex items-center gap-3"><span className="tabular-nums">{formatEuros(x.totalTTC)} TTC</span><StatusBadge kind="devis" value={x.statut} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {current === 'factures' && (
            <Card>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.factures.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune facture.</li>}
                {d.factures.map((f) => {
                  const late = f.statut === 'ENVOYEE' && f.dateEcheance && new Date(f.dateEcheance) < new Date();
                  return (
                    <li key={f.id}>
                      <button type="button" onClick={() => setView({ type: 'facture', id: f.id })} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <span>
                          <span className="font-medium">{f.reference}</span> <span className="text-slate-500">· {FACTURE_TYPE_TITLE[f.typeFacture]} · {formatDate(f.dateEmission)}</span>
                          {late && <span className="ml-2 text-xs font-semibold text-red-600">échéance dépassée</span>}
                        </span>
                        <span className="flex items-center gap-3"><span className="tabular-nums">{formatEuros(f.montantTTC)}</span><StatusBadge kind="facture" value={f.statut} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {current === 'sav' && <SavSection token={token} source={source} data={d} />}
          <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><LifeBuoy className="size-4" /> Une question ? {d.entreprise.telephone ?? d.entreprise.email}</p>
        </>
      )}
    </Shell>
  );
}
