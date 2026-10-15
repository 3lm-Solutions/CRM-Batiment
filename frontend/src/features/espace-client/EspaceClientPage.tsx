import { ArrowLeft, HardHat, CheckCircle2, LifeBuoy, Phone, Printer, Send, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, CardHeader, EmptyState, Input, Loading, Progress, Select, StatusBadge, Tabs, Textarea } from '@/components/ui';
import { errorMessage, toProblem } from '@/lib/api';
import { formatDate, formatEuros, formatNumber, formatPercent, formatUnite, fullName } from '@/lib/format';
import { FACTURE_TYPE_TITLE } from '../factures/api';
import { SAV_CATEGORIES, type SavCategorie } from '../sav/api';
import { useEspaceClient, useEspaceDevis, useEspaceFacture, useEspaceSav, useEspaceSavMessage, type EspaceClient } from './api';

type Tab = 'chantiers' | 'devis' | 'factures' | 'sav';
type View = { type: 'devis' | 'facture'; id: number } | null;

function Shell({ entreprise, children }: { entreprise?: EspaceClient['entreprise']; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-950">
      <header className="sidebar-gradient text-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15"><HardHat className="size-5" aria-hidden /></div>
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

function DevisView({ token, id, onBack }: { token: string; id: number; onBack: () => void }) {
  const q = useEspaceDevis(token, id);
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

function FactureView({ token, id, onBack }: { token: string; id: number; onBack: () => void }) {
  const q = useEspaceFacture(token, id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <p role="alert" className="text-sm text-red-600">{errorMessage(q.error)}</p>;
  const f = q.data;
  return (
    <>
      <div className="flex justify-between print:hidden">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>Retour</Button>
        <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
      </div>
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
        {f.statut === 'PAYEE' && <p className="mt-6 text-center text-lg font-bold uppercase tracking-widest text-emerald-600">Payée le {formatDate(f.datePaiement)}</p>}
      </Card>
    </>
  );
}

function SavSection({ token, data }: { token: string; data: EspaceClient }) {
  const ouvrir = useEspaceSav(token);
  const message = useEspaceSavMessage(token);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [categorie, setCategorie] = useState<SavCategorie>('DEFAUT_TRAVAUX');
  const [done, setDone] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<number, string>>({});

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Signaler un problème" description="Après travaux : défaut, malfaçon, question… Nous vous recontactons." />
        <div className="space-y-4 p-5">
          {done && <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="size-5 shrink-0" /> {done}</p>}
          <Input label="Objet" required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : le joint de la douche fuit" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Chantier" placeholder="Non précisé" options={data.chantiers.map((c) => ({ value: c.id, label: `${c.reference} · ${c.adresse}` }))} value={chantierId} onChange={(e) => setChantierId(e.target.value)} />
            <Select label="Type" options={Object.entries(SAV_CATEGORIES).map(([value, label]) => ({ value, label }))} value={categorie} onChange={(e) => setCategorie(e.target.value as SavCategorie)} />
          </div>
          <Textarea label="Description" required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          {ouvrir.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(ouvrir.error)}</p>}
          <Button
            icon={<Send className="size-4" />}
            disabled={!titre.trim() || !description.trim()}
            loading={ouvrir.isPending}
            onClick={() =>
              ouvrir.mutate(
                { titre: titre.trim(), description: description.trim(), chantierId: chantierId ? Number(chantierId) : undefined, categorie },
                { onSuccess: (r) => { setDone(r.message); setTitre(''); setDescription(''); } },
              )
            }
          >
            Envoyer
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Mes demandes" />
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.sav.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune demande.</li>}
          {data.sav.map((t) => (
            <li key={t.id} className="space-y-2 px-5 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span><span className="font-medium">{t.reference}</span> · {t.titre}</span>
                <StatusBadge kind="sav" value={t.statut} />
              </div>
              <p className="text-xs text-slate-500">Ouverte le {formatDate(t.createdAt)}{t.chantier && ` · ${t.chantier.reference}`}</p>
              {t.messages.map((m) => <p key={m.id} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">{m.contenu}</p>)}
              {t.statut !== 'CLOTURE' && (
                <div className="flex gap-2">
                  <input
                    aria-label={`Message pour ${t.reference}`}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Ajouter une précision…"
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
  const espace = useEspaceClient(token);
  const [tab, setTab] = useState<Tab | null>(null);
  const [view, setView] = useState<View>(null);

  if (espace.isPending) return <Shell><Loading /></Shell>;
  if (espace.isError) {
    const p = toProblem(espace.error);
    return (
      <Shell>
        <Card><EmptyState icon={<XCircle className="size-6" />} title={p.status === 410 ? 'Lien expiré ou désactivé' : 'Espace indisponible'} description={p.message} /></Card>
      </Shell>
    );
  }
  const d = espace.data;
  const current: Tab = tab ?? (d.chantiers.length ? 'chantiers' : 'devis');

  return (
    <Shell entreprise={d.entreprise}>
      {view ? (
        view.type === 'devis' ? <DevisView token={token} id={view.id} onBack={() => setView(null)} /> : <FactureView token={token} id={view.id} onBack={() => setView(null)} />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold">Bonjour {fullName(d.client)}</h1>
            <p className="text-sm text-slate-500">Votre espace personnel, valable jusqu’au {formatDate(d.expiresAt)}.</p>
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
                <Card key={c.id}>
                  <CardHeader title={`${c.reference} · ${c.adresse}`} description={`${formatDate(c.dateDebut)} → ${formatDate(c.dateFin)}`} actions={<StatusBadge kind="chantier" value={c.statut} />} />
                  <div className="space-y-4 p-5">
                    <Progress value={c.avancement} />
                    {c.chefChantier && (
                      <p className="text-sm">
                        Votre chef de chantier : <span className="font-medium">{fullName(c.chefChantier)}</span>
                        {c.chefChantier.telephone && <a href={`tel:${c.chefChantier.telephone}`} className="ml-2 inline-flex items-center gap-1 text-brand-700 hover:underline"><Phone className="size-3.5" />{c.chefChantier.telephone}</a>}
                      </p>
                    )}
                    {c.taches.length > 0 && (
                      <ul className="space-y-2">
                        {c.taches.map((t) => (
                          <li key={t.id} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_10rem]">
                            <span>{t.libelle}</span>
                            <Progress value={t.avancement} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
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
          {current === 'sav' && <SavSection token={token} data={d} />}
          <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><LifeBuoy className="size-4" /> Une question ? {d.entreprise.telephone ?? d.entreprise.email}</p>
        </>
      )}
    </Shell>
  );
}
