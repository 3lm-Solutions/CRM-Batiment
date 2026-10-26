import { ArrowLeft, Check, ClipboardCopy, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ErrorState, Loading, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatEuros, formatPercent, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { DevisFacturesCard } from '../factures/DevisFacturesCard';
import { RelancesCard } from '../relances/RelancesCard';
import { AddLigneModal } from './AddLigneModal';
import { AWAITING_CLIENT, EDITABLE, useCompany, useCompanySettings, useDevis, useUpdateDevis, useVersions, type DevisDetail } from './api';
import { DevisActions } from './DevisActions';
import { DevisIaModal } from './DevisIaModal';
import { LignesTable } from './LignesTable';

const LIEN_STATUT: Record<string, string> = {
  ACTIF: 'Envoyé',
  OTP_ENVOYE: 'Code demandé',
  OTP_VERIFIE: 'Code vérifié',
  UTILISE: 'Utilisé',
  BLOQUE: 'Bloqué',
  EXPIRE: 'Expiré',
  ANNULE: 'Annulé',
};

function Totals({ devis, editable }: { devis: DevisDetail; editable: boolean }) {
  const update = useUpdateDevis(devis.id);
  const [tva, setTva] = useState(String(devis.tauxTVA ?? 20));
  useEffect(() => {
    setTva(String(devis.tauxTVA ?? 20));
  }, [devis.tauxTVA]);

  const saveTva = () => {
    const n = Number(tva);
    if (Number.isNaN(n) || n === devis.tauxTVA) return;
    update.mutate({ tauxTVA: n }, { onError: (e) => { toast.error(errorMessage(e)); setTva(String(devis.tauxTVA)); } });
  };

  return (
    <Card className="print-area">
      <CardHeader title="Totaux" />
      <dl className="space-y-2 p-5 text-sm">
        <div className="flex justify-between"><dt>Total HT</dt><dd className="font-semibold tabular-nums">{formatEuros(devis.totalHT)}</dd></div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-2">
            TVA
            {editable ? (
              <span className="inline-flex items-center gap-1 print:hidden">
                <input
                  aria-label="Taux de TVA"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={tva}
                  onChange={(e) => setTva(e.target.value)}
                  onBlur={saveTva}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-0.5 text-right text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                %
              </span>
            ) : (
              <span>{devis.tauxTVA} %</span>
            )}
          </dt>
          <dd className="tabular-nums">{formatEuros(devis.totalTVA)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base dark:border-slate-700"><dt className="font-semibold">Total TTC</dt><dd className="font-bold tabular-nums">{formatEuros(devis.totalTTC)}</dd></div>
        <div className="space-y-2 border-t border-dashed border-slate-200 pt-3 text-slate-600 print:hidden dark:border-slate-700 dark:text-slate-400">
          <div className="flex justify-between"><dt>Coût de revient</dt><dd className="tabular-nums">{formatEuros(devis.coutTotal)}</dd></div>
          <div className="flex justify-between"><dt>Bénéfice</dt><dd className="tabular-nums">{formatEuros(devis.profit)}</dd></div>
          <div className="flex justify-between">
            <dt>Marge</dt>
            <dd className={devis.alerteMarge ? 'flex items-center gap-1 font-semibold text-amber-700' : 'font-semibold tabular-nums'}>
              {devis.alerteMarge && <TriangleAlert className="size-4" aria-hidden />}
              {formatPercent(devis.margePourcent)}
            </dd>
          </div>
          {devis.alerteMarge && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Marge inférieure au seuil d’alerte de l’entreprise.</p>}
        </div>
      </dl>
    </Card>
  );
}

function Notes({ devis, editable }: { devis: DevisDetail; editable: boolean }) {
  const update = useUpdateDevis(devis.id);
  const [notes, setNotes] = useState(devis.notes ?? '');
  useEffect(() => {
    setNotes(devis.notes ?? '');
  }, [devis.notes]);
  if (!editable && !devis.notes) return null;
  return (
    <Card className="print:hidden">
      <CardHeader title="Notes internes" description="Jamais montrées au client" />
      <div className="p-5">
        {editable ? (
          <>
            <Textarea aria-label="Notes internes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={notes === (devis.notes ?? '')}
              loading={update.isPending}
              onClick={() => update.mutate({ notes: notes || null }, { onSuccess: () => toast.success('Notes enregistrées'), onError: (e) => toast.error(errorMessage(e)) })}
            >
              Enregistrer
            </Button>
          </>
        ) : (
          <p className="whitespace-pre-line text-sm">{devis.notes}</p>
        )}
      </div>
    </Card>
  );
}

function SuiviClient({ devis, lastLink }: { devis: DevisDetail; lastLink: string | null }) {
  const [copied, setCopied] = useState(false);
  const liens = devis.liensClient ?? [];
  return (
    <Card className="print:hidden">
      <CardHeader title="Suivi client" />
      <div className="space-y-3 p-5 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="text-slate-500">Envoyé le</span><span>{formatDate(devis.dateEnvoi)}</span>
          <span className="text-slate-500">Validé le</span><span>{formatDate(devis.dateValidation)}</span>
          <span className="text-slate-500">Signature client</span><span>{devis.signatureClientDate ? <Badge tone="green">{formatDate(devis.signatureClientDate)}</Badge> : '—'}</span>
          <span className="text-slate-500">Signature conseiller</span><span>{devis.signatureConseillerDate ? <Badge tone="green">{formatDate(devis.signatureConseillerDate)}</Badge> : '—'}</span>
        </div>
        {devis.motifRefus && <p className="rounded-lg bg-red-50 p-2 text-red-800 dark:bg-red-950/40 dark:text-red-200">Motif du refus : {devis.motifRefus}</p>}
        {lastLink && (
          <div className="rounded-lg bg-brand-100/60 p-3 dark:bg-slate-800">
            <p className="mb-1 text-xs font-medium">Lien envoyé au client</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-xs">{lastLink}</code>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Copier le lien"
                icon={copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
                onClick={() => void navigator.clipboard.writeText(lastLink).then(() => setCopied(true))}
              />
            </div>
          </div>
        )}
        {liens.length > 0 && (
          <ul className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            {liens.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span>{l.type === 'VALIDATION' ? 'Validation' : 'Signature'} v{l.versionDevis} <span className="text-xs text-slate-500">· {formatDateTime(l.createdAt)}</span></span>
                <Badge tone={l.statut === 'UTILISE' ? 'green' : ['ANNULE', 'EXPIRE', 'BLOQUE'].includes(l.statut) ? 'slate' : 'blue'}>{LIEN_STATUT[l.statut] ?? l.statut}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Versions({ devis }: { devis: DevisDetail }) {
  const [open, setOpen] = useState(false);
  const versions = useVersions(devis.id, open);
  if (!devis._count?.versions) return null;
  return (
    <Card className="print:hidden">
      <CardHeader title="Versions" description={`${devis._count.versions} version(s) envoyée(s) ou révisée(s)`} actions={<Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? 'Masquer' : 'Afficher'}</Button>} />
      {open && (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {versions.data?.map((v) => (
            <li key={v.id} className="px-5 py-3">
              <div className="flex justify-between"><span className="font-medium">Version {v.numeroVersion}</span><span className="tabular-nums">{formatEuros(v.totalTTC)} TTC</span></div>
              <p className="text-xs text-slate-500">{formatDateTime(v.createdAt)}{v.auteur && ` · ${v.auteur.prenom} ${v.auteur.nom}`}</p>
              {v.justification && <p className="mt-1 text-slate-600 dark:text-slate-400">{v.justification}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Company + client block shown only when printing (the browser print replaces the old PDF). */
function PrintHeader({ devis }: { devis: DevisDetail }) {
  const company = useCompany();
  return (
    <div className="mb-6 hidden grid-cols-2 gap-6 text-sm print:grid">
      <div>
        <p className="text-lg font-bold">{company.data?.nom}</p>
        <p>{company.data?.adresse}</p>
        <p>{company.data?.telephone} · {company.data?.email}</p>
        {company.data?.siret && <p>SIRET {company.data.siret}</p>}
      </div>
      <div className="text-right">
        <p className="text-lg font-bold">Devis {devis.reference}</p>
        <p>Date : {formatDate(devis.dateEnvoi ?? devis.dateCreation)}</p>
        <p className="mt-2 font-semibold">{fullName(devis.client)}</p>
        <p>{devis.client.adresseClient}</p>
        {devis.client.adresseChantier && <p>Chantier : {devis.client.adresseChantier}</p>}
      </div>
    </div>
  );
}

export function DevisEditorPage() {
  const id = Number(useParams().id);
  const { hasRole } = useAuth();
  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  const devis = useDevis(id);
  const settings = useCompanySettings(isBureau);
  const [adding, setAdding] = useState(false);
  const [ia, setIa] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  if (devis.isPending) return <Loading />;
  if (devis.isError) return <ErrorState error={devis.error} onRetry={() => void devis.refetch()} />;
  const d = devis.data;
  const editable = isBureau && EDITABLE.includes(d.statut);

  return (
    <>
      <Link to="/devis" className="no-print mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" /> Devis</Link>
      <PrintHeader devis={d} />
      <div className="print:hidden">
        <PageHeader
          title={`Devis ${d.reference}${d.versionCourante > 1 ? ` · v${d.versionCourante}` : ''}`}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="devis" value={d.statut} />
              <Link to={`/clients/${d.client.id}`} className="font-medium text-brand-700 hover:underline">{fullName(d.client)}</Link>
              {d.createur && <span>· par {d.createur.prenom} {d.createur.nom}</span>}
              {d.demandeDevis && <span>· demande {d.demandeDevis.reference}</span>}
              {d.chantier && <span>· chantier <Link to={`/chantiers/${d.chantier.id}`} className="font-medium text-brand-700 hover:underline">{d.chantier.reference}</Link></span>}
            </span>
          }
          actions={<DevisActions devis={d} onLink={(url) => setLastLink(url)} />}
        />
      </div>

      {d.statut === 'REVISE' && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Version {d.versionCourante} en cours de révision : modifiez les lignes puis renvoyez le devis au client.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="print-area">
            <CardHeader
              title="Lignes du devis"
              description={editable ? 'Quantité et prix modifiables directement ; les totaux se recalculent.' : undefined}
              actions={
                editable && (
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <Button size="sm" variant="outline" icon={<Sparkles className="size-4 text-purple-600" />} onClick={() => setIa(true)}>
                      Proposer avec l’IA
                    </Button>
                    <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Ajouter une ligne</Button>
                  </div>
                )
              }
            />
            <LignesTable devis={d} editable={editable} seuilMarge={settings.data?.seuilAlerteMargePourcent} />
          </Card>
          <Notes devis={d} editable={editable} />
        </div>
        {d.totalHT !== undefined && (
          <div className="space-y-6">
            <Totals devis={d} editable={editable} />
            <SuiviClient devis={d} lastLink={lastLink} />
            {isBureau && d.dateEnvoi && (
              <RelancesCard
                cible={{ devisId: d.id }}
                canRelancer={AWAITING_CLIENT.includes(d.statut) && !!d.client.email}
                description={AWAITING_CLIENT.includes(d.statut) && !d.client.email ? 'Le client n’a pas d’email : relance impossible.' : 'Automatiques tant que le client n’a pas répondu'}
              />
            )}
            {d.statut === 'SIGNE' && <DevisFacturesCard devisId={d.id} canWrite={isBureau} />}
            <Versions devis={d} />
          </div>
        )}
      </div>
      {editable && adding && <AddLigneModal devisId={d.id} open onClose={() => setAdding(false)} />}
      {editable && ia && <DevisIaModal devisId={d.id} description={d.demandeDevis?.description} onClose={() => setIa(false)} />}
    </>
  );
}
