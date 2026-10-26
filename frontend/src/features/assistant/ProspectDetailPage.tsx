import { ArrowLeft, Bot, CheckCircle2, Mail, RotateCcw, Save, User, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Input, Loading, PageHeader, StatusBadge, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, fullName } from '@/lib/format';
import { useProspect, useQualifierProspect, useRejeterProspect, useRouvrirProspect, useUpdateProspect, type Prospect } from './api';

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

  if (prospect.isPending) return <Loading />;
  if (prospect.isError) return <ErrorState error={prospect.error} onRetry={() => void prospect.refetch()} />;
  const p = prospect.data;
  const onError = (e: unknown) => toast.error(errorMessage(e));
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
                <Button variant="success" icon={<CheckCircle2 className="size-4" />} onClick={() => setDialog('qualifier')}>Qualifier → demande de devis</Button>
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
            : 'Le client est retrouvé par email ou téléphone, sinon créé à partir de la fiche ; une demande de devis (origine Chatbot) est créée.'
        }
        confirmLabel="Créer la demande de devis"
        loading={qualifier.isPending}
        onConfirm={() =>
          qualifier.mutate(undefined, {
            onSuccess: (r) => {
              toast.success(`Demande ${r.demande.reference} créée`);
              setDialog(null);
              navigate('/demandes');
            },
            onError,
          })
        }
      >
        {p.typeProjet && <Badge tone="blue">{p.typeProjet}</Badge>}
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
