import { ArrowLeft, Bot, Building2, CheckCircle2, Mail, RotateCcw, Save, User, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Input, Loading, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, fullName } from '@/lib/format';
import { useProspect, useQualifierProspect, useRejeterProspect, useRouvrirProspect, useUpdateProspect, type Prospect, type QualificationInput } from './api';

/** 29/10: private person or company, chosen when qualifying (editable later in « Prospects »). */
const CATEGORIES = [
  { value: 'PARTICULIER', label: 'Particulier', hint: 'Une personne', icon: User },
  { value: 'PROFESSIONNEL', label: 'Professionnel', hint: 'Une entreprise', icon: Building2 },
] as const;
const QUALIF_VIDE = { typeClient: 'PARTICULIER' as 'PARTICULIER' | 'PROFESSIONNEL', raisonSociale: '', siret: '', tvaIntracom: '', contactFonction: '' };
const compact = (s: string) => s.replace(/[\s.-]+/g, '');

/** What the qualification sends: the company fields only for a professional client. */
function qualificationBody(q: typeof QUALIF_VIDE): QualificationInput {
  if (q.typeClient !== 'PROFESSIONNEL') return { typeClient: 'PARTICULIER' };
  return {
    typeClient: 'PROFESSIONNEL',
    raisonSociale: q.raisonSociale.trim(),
    siret: compact(q.siret) || null,
    tvaIntracom: compact(q.tvaIntracom).toUpperCase() || null,
    contactFonction: q.contactFonction.trim() || null,
  };
}

/** 29/10: what is still missing before the qualification (same rule as the server). */
function champsManquants(p: Prospect): string[] {
  const manque: string[] = [];
  if (!p.clientNom?.trim()) manque.push('le nom');
  if (!p.clientEmail?.trim() && !p.clientTelephone?.trim()) manque.push('un téléphone ou un email');
  if ((p.description ?? '').trim().length < 10) manque.push('le besoin (10 caractères au moins)');
  return manque;
}

/** Error of the company fields, checked before sending (the server checks them again). */
function erreurQualification(q: typeof QUALIF_VIDE): string | null {
  if (q.typeClient !== 'PROFESSIONNEL') return null;
  if (!q.raisonSociale.trim()) return 'Indiquez la raison sociale de l’entreprise.';
  if (q.siret.trim() && !/^\d{14}$/.test(compact(q.siret))) return 'Le SIRET doit contenir 14 chiffres.';
  return null;
}

const EMPTY = { clientNom: '', clientPrenom: '', clientEmail: '', clientTelephone: '', adresse: '', typeProjet: '', description: '', notesInternes: '' };

function Fiche({ p }: { p: Prospect }) {
  const update = useUpdateProspect(p.id);
  const [f, setF] = useState(EMPTY);
  useEffect(() => {
    setF({
      clientNom: p.clientNom ?? '',
      clientPrenom: p.clientPrenom ?? '',
      clientEmail: p.clientEmail ?? '',
      clientTelephone: p.clientTelephone ?? '',
      adresse: p.adresse ?? '',
      typeProjet: p.typeProjet ?? '',
      description: p.description ?? '',
      notesInternes: p.notesInternes ?? '',
    });
  }, [p]);
  const locked = p.statut === 'QUALIFIE';
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const dirty = (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).some((k) => (p[k] ?? '') !== f[k]);

  return (
    <Card>
      <CardHeader
        title="Fiche prospect"
        description={locked ? 'Transformé en demande de devis : modifiez la demande.' : 'Complétez ou corrigez avant de qualifier.'}
        actions={
          !locked && (
            <Button
              size="sm"
              icon={<Save className="size-4" />}
              disabled={!dirty}
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])),
                  { onSuccess: () => toast.success('Fiche enregistrée'), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              Enregistrer
            </Button>
          )
        }
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Input label="Nom" required disabled={locked} value={f.clientNom} onChange={set('clientNom')} />
        <Input label="Prénom" disabled={locked} value={f.clientPrenom} onChange={set('clientPrenom')} />
        <Input label="Téléphone" type="tel" disabled={locked} value={f.clientTelephone} onChange={set('clientTelephone')} />
        <Input label="Email" type="email" disabled={locked} value={f.clientEmail} onChange={set('clientEmail')} />
        <Input label="Adresse / ville du chantier" disabled={locked} value={f.adresse} onChange={set('adresse')} />
        <Input label="Type de projet" disabled={locked} value={f.typeProjet} onChange={set('typeProjet')} hint={p.delai ? `Délai souhaité : ${p.delai}` : undefined} />
        <Textarea label="Besoin" required rows={4} containerClassName="sm:col-span-2" disabled={locked} value={f.description} onChange={set('description')} />
        <Textarea label="Notes internes" rows={2} containerClassName="sm:col-span-2" disabled={locked} value={f.notesInternes} onChange={set('notesInternes')} />
      </div>
    </Card>
  );
}

export function ProspectDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const prospect = useProspect(id);
  const qualifier = useQualifierProspect(id);
  const rejeter = useRejeterProspect(id);
  const rouvrir = useRouvrirProspect(id);
  const [dialog, setDialog] = useState<'qualifier' | 'rejeter' | null>(null);
  const [motif, setMotif] = useState('');
  const [qualif, setQualif] = useState(QUALIF_VIDE);
  const setQ = (k: keyof typeof QUALIF_VIDE) => (e: { target: { value: string } }) => setQualif((s) => ({ ...s, [k]: e.target.value }));

  if (prospect.isPending) return <Loading />;
  if (prospect.isError) return <ErrorState error={prospect.error} onRetry={() => void prospect.refetch()} />;
  const p = prospect.data;
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const manque = champsManquants(p);
  const nom = p.clientNom ? fullName({ nom: p.clientNom, prenom: p.clientPrenom }) : 'Prospect anonyme';

  return (
    <>
      <Link to="/assistant" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Assistant IA
      </Link>
      <PageHeader
        title={nom}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="prospect" value={p.statut} />
            {p.source === 'EMAIL' ? (
              <><Badge tone="violet"><Mail className="mr-1 inline size-3" />Email</Badge> Reçu le {formatDateTime(p.createdAt)}{p.emailSujet && <> · « {p.emailSujet} »</>}</>
            ) : (
              <>Conversation du {formatDateTime(p.createdAt)}</>
            )}
          </span>
        }
        actions={
          <>
            {(p.statut === 'A_QUALIFIER' || p.statut === 'NOUVEAU') && (
              <>
                <Button
                  variant="success"
                  icon={<CheckCircle2 className="size-4" />}
                  disabled={manque.length > 0}
                  title={manque.length ? `Il manque ${manque.join(', ')}` : undefined}
                  onClick={() => { setQualif(QUALIF_VIDE); setDialog('qualifier'); }}
                >
                  Qualifier → demande de devis
                </Button>
                <Button variant="outline" icon={<XCircle className="size-4" />} onClick={() => setDialog('rejeter')}>Rejeter</Button>
              </>
            )}
            {p.statut === 'REJETE' && (
              <Button variant="outline" icon={<RotateCcw className="size-4" />} loading={rouvrir.isPending} onClick={() => rouvrir.mutate(undefined, { onSuccess: () => toast.success('Prospect rouvert'), onError })}>
                Rouvrir
              </Button>
            )}
          </>
        }
      />

      {manque.length > 0 && (p.statut === 'NOUVEAU' || p.statut === 'A_QUALIFIER') && (
        <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Pour qualifier, il manque {manque.join(', ')}. Lisez la conversation à droite, complétez la fiche puis « Enregistrer ».
        </p>
      )}

      {(p.client || p.doublonDe || p.demandeDevis || p.motifRejet) && (
        <div className="mb-6 space-y-2">
          {p.demandeDevis && (
            <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              Demande de devis <Link to="/demandes" className="font-semibold underline">{p.demandeDevis.reference}</Link> créée
              {p.traitePar && ` par ${fullName(p.traitePar)}`} le {formatDateTime(p.traiteLe)}.
            </p>
          )}
          {p.client && !p.demandeDevis && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Déjà client : <Link to={`/clients/${p.client.id}`} className="font-semibold underline">{fullName(p.client)}</Link> (même email ou téléphone). La demande sera rattachée à cette fiche, sans doublon.
            </p>
          )}
          {p.doublonDe && (
            <p className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              Cette personne a déjà écrit le {formatDateTime(p.doublonDe.createdAt)} :{' '}
              <Link to={`/assistant/prospects/${p.doublonDe.id}`} className="font-semibold underline">conversation #{p.doublonDe.id}</Link> ({p.doublonDe.statut === 'A_QUALIFIER' ? 'à qualifier' : 'en cours'}). Qualifiez l’une et rejetez l’autre comme doublon.
            </p>
          )}
          {p.motifRejet && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Rejeté : {p.motifRejet}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Fiche p={p} />
        <Card className="flex max-h-[720px] flex-col">
          <CardHeader title={p.source === 'EMAIL' ? 'Emails reçus' : 'Conversation'} description={`${p.messages.length} message(s)${p.feedbacks.length ? ` · avis : ${p.feedbacks.map((f) => (f.rating === 'UTILE' ? '👍' : '👎')).join(' ')}` : ''}`} />
          <ol className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4 dark:bg-slate-950">
            {p.messages.map((m) => (
              <li key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'flex-row-reverse' : '')}>
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600')} aria-hidden>
                  {m.role === 'user' ? (p.source === 'EMAIL' ? <Mail className="size-4" /> : <User className="size-4" />) : <Bot className="size-4" />}
                </span>
                <div className={cn('max-w-[80%] rounded-xl px-3 py-2 text-sm', m.role === 'user' ? 'bg-blue-600 text-white' : 'border border-gray-100 bg-white text-gray-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100')}>
                  <p className="whitespace-pre-line">{m.contenu}</p>
                  <p className={cn('mt-1 text-[10px]', m.role === 'user' ? 'text-blue-100' : 'text-gray-400')}>{formatDateTime(m.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <ConfirmDialog
        open={dialog === 'qualifier'}
        onClose={() => setDialog(null)}
        title="Qualifier le prospect"
        message={
          p.client
            ? `Une demande de devis est créée pour le client existant ${fullName(p.client)}.`
            : `Le prospect qualifié apparaît dans « Prospects » (retrouvé par email ou téléphone, sinon créé) ; une demande de devis (origine ${p.source === 'EMAIL' ? 'Email' : 'Chatbot'}) est créée.`
        }
        confirmLabel="Qualifier et créer la demande"
        loading={qualifier.isPending}
        onConfirm={() => {
          const erreur = p.client ? null : erreurQualification(qualif);
          if (erreur) return void toast.error(erreur);
          qualifier.mutate(p.client ? {} : qualificationBody(qualif), {
            onSuccess: (r) => {
              toast.success(`Demande ${r.demande.reference} créée — le prospect est dans « Prospects »`);
              setDialog(null);
              navigate('/demandes');
            },
            onError,
          });
        }}
      >
        <div className="space-y-4">
          {p.typeProjet && <Badge tone="blue">{p.typeProjet}</Badge>}
          {!p.client && (
            <>
              <div role="radiogroup" aria-label="Type de client" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CATEGORIES.map((c) => {
                  const actif = qualif.typeClient === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={actif}
                      onClick={() => setQualif((s) => ({ ...s, typeClient: c.value }))}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition',
                        actif
                          ? 'border-brand-700 bg-brand-100/60 dark:border-blue-400 dark:bg-slate-800'
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
              {qualif.typeClient === 'PROFESSIONNEL' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Raison sociale" required containerClassName="sm:col-span-2" maxLength={150} value={qualif.raisonSociale} onChange={setQ('raisonSociale')} />
                  <Input label="SIRET" hint="Facultatif — 14 chiffres" inputMode="numeric" maxLength={20} value={qualif.siret} onChange={setQ('siret')} />
                  <Input label="N° TVA intracommunautaire" hint="Facultatif" maxLength={20} value={qualif.tvaIntracom} onChange={setQ('tvaIntracom')} />
                  <Input
                    label={`Fonction de ${p.clientNom ? fullName({ nom: p.clientNom, prenom: p.clientPrenom }) : 'la personne'}`}
                    hint="Devient la personne à contacter"
                    containerClassName="sm:col-span-2"
                    maxLength={100}
                    placeholder="Ex. : Gérant, Responsable travaux"
                    value={qualif.contactFonction}
                    onChange={setQ('contactFonction')}
                  />
                </div>
              )}
              <p className="text-xs text-slate-500">Modifiable ensuite dans la fiche du prospect (menu « Prospects »).</p>
            </>
          )}
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'rejeter'}
        onClose={() => setDialog(null)}
        danger
        title="Rejeter le prospect"
        message="Le prospect sort de la liste à qualifier (il peut être rouvert)."
        confirmLabel="Rejeter"
        loading={rejeter.isPending}
        onConfirm={() => {
          if (!motif.trim()) return void toast.error('Indiquez un motif.');
          rejeter.mutate(motif.trim(), { onSuccess: () => { toast.success('Prospect rejeté'); setDialog(null); setMotif(''); }, onError });
        }}
      >
        <Input label="Motif" required value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Spam, hors zone, doublon…" />
      </ConfirmDialog>
    </>
  );
}
