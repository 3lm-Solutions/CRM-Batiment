import { ArrowLeft, ClipboardCheck, NotebookPen, ExternalLink, FileText, HardHat, MessageSquareWarning, Phone, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Loading, PageHeader, Pagination, Progress, Stat, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatEuros, fullName } from '@/lib/format';
import { openFichier } from '@/lib/files';
import { RapportItem } from '../rapports/RapportItem';
import { TYPE_ASSURANCE } from '../sous-traitants/api';
import { useAvancerTache, useCocherChecklist, useStChantier, useStChantiers, useStDashboard, useStProfil, useStRapports, type StTache } from './api';
import { RapportForm } from './RapportForm';

// ── tableau de bord ───────────────────────────────────────────────────────

export function StDashboardPage() {
  const d = useStDashboard();
  if (d.isPending) return <Loading />;
  if (d.isError) return <ErrorState error={d.error} onRetry={() => void d.refetch()} />;
  const v = d.data;
  return (
    <>
      <PageHeader title="Mon espace" description="Vos chantiers, vos tâches et vos rapports" />
      {v.assurancesAlerte.length > 0 && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Attestation d’assurance à renouveler</p>
            <p>{v.assurancesAlerte.map((a) => `${TYPE_ASSURANCE[a.typeAssurance]} (${a.statut === 'EXPIREE' ? 'expirée' : 'expire'} le ${formatDate(a.dateExpiration)})`).join(' · ')} — envoyez la nouvelle attestation à l’entreprise.</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<HardHat />} iconTone="blue" label="Chantiers en cours" value={v.chantiersActifs} />
        <Stat icon={<ClipboardCheck />} iconTone="orange" label="Tâches à réaliser" value={v.tachesOuvertes} />
        <Stat icon={<NotebookPen />} iconTone="purple" label="Rapports en attente de validation" value={v.rapportsEnAttente} />
        <Stat icon={<MessageSquareWarning />} iconTone="red" label="Rapports à reprendre" value={v.rapportsARevoir} tone={v.rapportsARevoir ? 'warning' : 'default'} />
      </div>
      <Card className="mt-6">
        <CardHeader title="Mes prochaines tâches" actions={<Link to="/portail/chantiers" className="text-sm font-medium text-brand-700 hover:underline">Tous mes chantiers</Link>} />
        {v.prochainesTaches.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="size-6" />} title="Aucune tâche en cours" description="Les tâches qui vous sont affectées apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {v.prochainesTaches.map((t) => (
              <li key={t.id}>
                <Link to={`/portail/chantiers/${t.chantier.id}`} className="grid gap-2 px-5 py-3 hover:bg-slate-50 sm:grid-cols-[1fr_10rem] sm:items-center dark:hover:bg-slate-800/50">
                  <div>
                    <p className="font-medium">{t.libelle} <StatusBadge kind="tache" value={t.statut} /></p>
                    <p className="text-xs text-slate-500">{t.chantier.reference} · {t.chantier.adresse}{t.dateFin && ` · pour le ${formatDate(t.dateFin)}`}</p>
                  </div>
                  <Progress value={t.avancement} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ── chantiers ─────────────────────────────────────────────────────────────

export function StChantiersPage() {
  const list = useStChantiers();
  return (
    <>
      <PageHeader title="Mes chantiers" description="Chantiers sur lesquels l’entreprise vous a donné accès" />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <Card><EmptyState icon={<HardHat className="size-6" />} title="Aucun chantier" description="L’entreprise ne vous a encore ouvert aucun chantier." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data.map((c) => (
            <Link key={c.id} to={`/portail/chantiers/${c.id}`} className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-700">
              <Card className="h-full p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.reference}</p>
                    <p className="text-sm text-slate-500">{c.adresse}</p>
                  </div>
                  <StatusBadge kind="chantier" value={c.statut} />
                </div>
                <Progress value={c.avancement} className="mt-4" />
                <p className="mt-3 text-xs text-slate-500">
                  {formatDate(c.dateDebut)} → {formatDate(c.dateFin)} · {c.mesTaches} tâche(s) pour vous
                  {c.chefChantier && ` · chef : ${fullName(c.chefChantier)}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function TacheRow({ tache, chantierId, editable, onReport }: { tache: StTache; chantierId: number; editable: boolean; onReport: () => void }) {
  const avancer = useAvancerTache(chantierId);
  const cocher = useCocherChecklist(chantierId);
  const checklist = tache.checklist ?? [];
  const [value, setValue] = useState(tache.avancement);
  useEffect(() => {
    setValue(tache.avancement);
  }, [tache.avancement]);
  const dirty = value !== tache.avancement;
  const save = (patch: { avancement?: number; statut?: 'BLOQUEE' | 'EN_COURS' }) =>
    avancer.mutate({ id: tache.id, ...patch }, { onSuccess: () => toast.success('Avancement enregistré'), onError: (e) => { toast.error(errorMessage(e)); setValue(tache.avancement); } });

  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {tache.libelle} {tache.affecteeAMoi && <Badge tone="blue">Pour vous</Badge>}
        </p>
        <StatusBadge kind="tache" value={tache.statut} />
      </div>
      {tache.description && <p className="text-sm text-slate-600 dark:text-slate-400">{tache.description}</p>}
      <p className="text-xs text-slate-500">{formatDate(tache.dateDebut)} → {formatDate(tache.dateFin)}</p>
      {checklist.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50" aria-label={`Checklist de ${tache.libelle}`}>
          {checklist.map((i) => (
            <li key={i.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-700"
                  checked={i.fait}
                  disabled={!(editable && tache.affecteeAMoi) || cocher.isPending}
                  onChange={(e) => cocher.mutate({ tacheId: tache.id, itemId: i.id, fait: e.target.checked }, { onError: (err) => toast.error(errorMessage(err)) })}
                />
                <span className={i.fait ? 'text-slate-400 line-through' : undefined}>{i.libelle}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {editable && tache.affecteeAMoi ? (
        <div className="flex flex-wrap items-center gap-3">
          {checklist.length > 0 ? (
            <div className="flex w-60 items-center gap-2"><Progress value={tache.avancement} className="flex-1" /><span className="text-xs text-slate-500">suit la checklist</span></div>
          ) : (
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label={`Avancement de ${tache.libelle}`}
            className="w-48 accent-brand-700"
          />
          )}
          {checklist.length === 0 && <span className="w-12 text-sm font-semibold tabular-nums">{value} %</span>}
          {dirty && <Button size="sm" loading={avancer.isPending} onClick={() => save({ avancement: value })}>Enregistrer</Button>}
          {tache.statut !== 'BLOQUEE' && tache.statut !== 'TERMINEE' && (
            <Button size="sm" variant="ghost" icon={<MessageSquareWarning className="size-4" />} onClick={() => save({ statut: 'BLOQUEE' })}>Signaler un blocage</Button>
          )}
          {tache.statut === 'BLOQUEE' && <Button size="sm" variant="ghost" onClick={() => save({ statut: 'EN_COURS' })}>Débloquée</Button>}
          <Button size="sm" variant="outline" onClick={onReport}>Rapport + photos</Button>
        </div>
      ) : (
        <Progress value={tache.avancement} className="max-w-xs" />
      )}
      {tache.commentaire && <p className="text-xs italic text-slate-500">{tache.commentaire}</p>}
    </li>
  );
}

export function StChantierPage() {
  const id = Number(useParams().id);
  const c = useStChantier(id);
  const [reportTache, setReportTache] = useState<number | undefined>(undefined);

  if (c.isPending) return <Loading />;
  if (c.isError) return <ErrorState error={c.error} onRetry={() => void c.refetch()} />;
  const ch = c.data;
  const open = !['CLOTURE', 'ANNULE'].includes(ch.statut);

  return (
    <>
      <Link to="/portail/chantiers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Mes chantiers
      </Link>
      <PageHeader title={ch.reference} description={<span className="flex flex-wrap items-center gap-2"><StatusBadge kind="chantier" value={ch.statut} /> {ch.adresse}</span>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Tâches" description={<Progress value={ch.avancement} className="mt-1 w-56" />} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {ch.taches.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune tâche planifiée.</li>}
              {ch.taches.map((t) => (
                <TacheRow
                  key={t.id}
                  tache={t}
                  chantierId={ch.id}
                  editable={open}
                  onReport={() => {
                    setReportTache(t.id);
                    document.getElementById('rapport')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              ))}
            </ul>
          </Card>
          {open && (
            <div id="rapport">
              <RapportForm chantierId={ch.id} taches={ch.taches} tacheInitiale={reportTache} />
            </div>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <div className="space-y-2 p-5 text-sm">
              <p><span className="text-slate-500">Client :</span> {ch.client.nom}</p>
              {ch.chefChantier ? (
                <>
                  <p><span className="text-slate-500">Chef de chantier :</span> {fullName(ch.chefChantier)}</p>
                  {ch.chefChantier.telephone && (
                    <a href={`tel:${ch.chefChantier.telephone}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-blue-300">
                      <Phone className="size-4" /> {ch.chefChantier.telephone}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-slate-500">Pas encore de chef de chantier.</p>
              )}
              <p className="pt-2 text-xs text-slate-500">{formatDate(ch.dateDebut)} → {formatDate(ch.dateFin)}</p>
            </div>
          </Card>
          {ch.description && (
            <Card>
              <CardHeader title="Travaux" />
              <p className="whitespace-pre-line p-5 text-sm">{ch.description}</p>
            </Card>
          )}
          <Card>
            <CardHeader title="Documents" />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {ch.documents.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucun document.</li>}
              {ch.documents.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => (d.fichierId ? void openFichier(d.fichierId) : d.url && window.open(d.url, '_blank', 'noopener'))}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <FileText className="size-4 shrink-0 text-slate-400" />
                    <span className="flex-1 text-sm"><span className="font-medium">{d.nom}</span> <span className="text-xs text-slate-500">· {d.type}</span></span>
                    <ExternalLink className="size-4 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── rapports ──────────────────────────────────────────────────────────────

export function StRapportsPage() {
  const [page, setPage] = useState(1);
  const rapports = useStRapports({ page });
  return (
    <>
      <PageHeader title="Mes rapports" description="Rapports envoyés au bureau et leur validation" />
      <Card>
        {rapports.isPending ? (
          <Loading />
        ) : rapports.isError ? (
          <div className="p-4"><ErrorState error={rapports.error} onRetry={() => void rapports.refetch()} /></div>
        ) : rapports.data.data.length === 0 ? (
          <EmptyState title="Aucun rapport" description="Envoyez un rapport depuis la page d’un chantier." action={<Link to="/portail/chantiers"><Button>Mes chantiers</Button></Link>} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rapports.data.data.map((r) => (
              <RapportItem
                key={r.id}
                rapport={r}
                showChantier
                actions={r.statut === 'REJETE' && <Link to={`/portail/chantiers/${r.chantierId}`} className="text-sm font-medium text-brand-700 hover:underline">Envoyer un rapport corrigé</Link>}
              />
            ))}
          </div>
        )}
        <Pagination meta={rapports.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}

// ── dossier ───────────────────────────────────────────────────────────────

export function StDossierPage() {
  const profil = useStProfil();
  if (profil.isPending) return <Loading />;
  if (profil.isError) return <ErrorState error={profil.error} onRetry={() => void profil.refetch()} />;
  const { compte, dossier, entreprise } = profil.data;
  return (
    <>
      <PageHeader title="Mon dossier" description={`Votre fiche chez ${entreprise.nom}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Mon compte" />
          <dl className="space-y-2 p-5 text-sm">
            <div><dt className="text-xs text-slate-500">Nom</dt><dd>{fullName(compte)}</dd></div>
            <div><dt className="text-xs text-slate-500">Email</dt><dd>{compte.email}</dd></div>
            <div><dt className="text-xs text-slate-500">Entreprise donneuse d’ordre</dt><dd>{entreprise.nom}{entreprise.telephone && ` · ${entreprise.telephone}`}</dd></div>
          </dl>
          <p className="px-5 pb-5 text-xs text-slate-500"><Link to="/profil" className="underline">Modifier mon mot de passe</Link></p>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          {!dossier ? (
            <Card><EmptyState title="Dossier non rattaché" description="Votre compte n’est pas encore lié à une fiche sous-traitant. Contactez l’entreprise." /></Card>
          ) : (
            <>
              <Card>
                <CardHeader title="Assurances" description="Pour renouveler une attestation, envoyez-la à l’entreprise." />
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {dossier.assurances.length === 0 && <li className="px-5 py-4 text-slate-500">Aucune attestation enregistrée.</li>}
                  {dossier.assurances.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3">
                      <span>{TYPE_ASSURANCE[a.typeAssurance]} · {a.compagnieAssurance} · expire le {formatDate(a.dateExpiration)}</span>
                      <StatusBadge kind="assurance" value={a.statut} />
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Mes contrats" />
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {dossier.contrats.length === 0 && <li className="px-5 py-4 text-slate-500">Aucun contrat.</li>}
                  {dossier.contrats.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <span><span className="font-medium">{c.reference}</span> · chantier {c.chantier.reference} · {formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</span>
                      <span className="flex items-center gap-2"><span className="tabular-nums">{formatEuros(c.montantHT)} HT</span><StatusBadge kind="contrat" value={c.statut} /></span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
