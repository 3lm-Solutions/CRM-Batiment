import { Bot, ExternalLink, Mail, MessagesSquare, Pencil, Plus, RefreshCw, Search, ThumbsUp, Trash2, TriangleAlert, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Stat,
  StatusBadge,
  Tabs,
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import {
  type ProspectSource,
  useReleverEmails,
  useEmailStatut,
  useAssistantErreurs,
  useAssistantStats,
  useCategoriesConnaissances,
  useConnaissances,
  useDeleteConnaissance,
  useProspects,
  useRechercheConnaissances,
  useSaveConnaissance,
  type Connaissance,
  type ProspectStatut,
} from './api';

const ERREURS: Record<string, string> = {
  REPONSE_BLOQUEE: 'Réponse bloquée (prix ou donnée interne)',
  LLM_INDISPONIBLE: 'IA indisponible',
  LLM_REPONSE_INVALIDE: 'Réponse IA invalide',
  QUOTA: 'Quota OpenAI atteint',
  EMAIL_IMPORT: 'Email non importé',
  EMAIL_LLM_INDISPONIBLE: 'Tri des emails : IA indisponible (tri par mots-clés)',
  EMAIL_LLM_REPONSE_INVALIDE: 'Tri des emails : réponse IA invalide',
  EMAIL_QUOTA: 'Tri des emails : quota IA atteint',
};

const SOURCES: { value: ProspectSource; label: string }[] = [
  { value: 'CHATBOT', label: 'Chatbot' },
  { value: 'EMAIL', label: 'Email' },
];

/** Mailbox of the prospects (22/10): status line + « Relever les emails » (ADMIN). */
function EmailsBar({ isAdmin }: { isAdmin: boolean }) {
  const statut = useEmailStatut();
  const relever = useReleverEmails();
  const s = statut.data;
  if (!s) return null;
  if (!s.active) {
    return isAdmin ? (
      <p className="mb-3 flex items-center gap-2 text-xs text-slate-500">
        <Mail className="size-3.5" /> Prospects par email désactivés : configurez une boîte (IMAP_HOST, IMAP_USER, IMAP_PASS) dans le .env du backend.
      </p>
    ) : null;
  }
  const d = s.dernier;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      <span className="flex items-center gap-2">
        <Mail className="size-3.5" />
        Boîte {s.boite} · lue toutes les {s.intervalleMinutes} min
        {d && (
          <span className={d.erreur ? 'text-red-600' : 'text-slate-500'}>
            {' '}· dernier relevé {formatDateTime(d.date)} : {d.erreur ?? `${d.prospects} prospect(s), ${d.suites} réponse(s), ${d.rejetes} écarté(s)`}
          </span>
        )}
      </span>
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw className="size-3.5" />}
          loading={relever.isPending || s.enCours}
          onClick={() =>
            relever.mutate(undefined, {
              onSuccess: (b) => toast.success(b.lus ? `${b.lus} email(s) lu(s) : ${b.prospects} prospect(s), ${b.suites} réponse(s), ${b.rejetes} écarté(s)` : 'Aucun nouvel email'),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Relever les emails
        </Button>
      )}
    </div>
  );
}

// ── prospects ─────────────────────────────────────────────────────────────

const PROSPECT_TABS: { value: string; label: string; statuts?: ProspectStatut[] }[] = [
  { value: 'todo', label: 'À qualifier', statuts: ['A_QUALIFIER'] },
  { value: 'new', label: 'En conversation', statuts: ['NOUVEAU'] },
  { value: 'done', label: 'Qualifiés', statuts: ['QUALIFIE'] },
  { value: 'rejected', label: 'Rejetés', statuts: ['REJETE'] },
  { value: 'all', label: 'Tous' },
];

function Prospects({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  // 29/10: everything by default (a conversation still in progress is visible at once)
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState<{ page: number; search: string; statuts?: ProspectStatut[]; source: ProspectSource | '' }>({ page: 1, search: '', source: '' });
  const list = useProspects(query);
  return (
    <>
      <EmailsBar isAdmin={isAdmin} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Source"
          containerClassName="w-48"
          placeholder="Toutes sources"
          options={SOURCES}
          value={query.source}
          onChange={(e) => setQuery((q) => ({ ...q, page: 1, source: e.target.value as ProspectSource | '' }))}
        />
        <Select
          aria-label="Statut"
          containerClassName="w-52"
          options={PROSPECT_TABS.map((t) => ({ value: t.value, label: t.label }))}
          value={tab}
          onChange={(e) => {
            setTab(e.target.value);
            setQuery((q) => ({ ...q, page: 1, statuts: PROSPECT_TABS.find((t) => t.value === e.target.value)?.statuts }));
          }}
        />
        </div>
        <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Nom, email, téléphone, projet…" />
      </div>
      <Card className="overflow-hidden">
        {list.isError ? (
          <div className="p-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
        ) : (
          <DataTable
            loading={list.isPending}
            rows={list.data?.data}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/assistant/prospects/${p.id}`)}
            empty={{ title: 'Aucun prospect', description: 'Les conversations du chatbot et les emails reçus dans la boîte des prospects apparaissent ici.' }}
            columns={[
              {
                key: 'qui',
                header: 'Prospect',
                cell: (p) => (
                  <div>
                    <p className="font-medium text-gray-800 dark:text-slate-100">{p.clientNom ? fullName({ nom: p.clientNom, prenom: p.clientPrenom }) : <span className="italic text-gray-400">Anonyme</span>}</p>
                    <p className="whitespace-nowrap text-xs text-gray-500">{p.clientTelephone ?? p.clientEmail ?? '—'}</p>
                  </div>
                ),
              },
              {
                key: 'projet',
                header: 'Projet',
                className: 'max-w-md',
                cell: (p) => (
                  <div>
                    {p.typeProjet && <Badge tone="blue" className="mb-1">{p.typeProjet}</Badge>}
                    {p.emailSujet && <p className="truncate text-xs font-medium text-gray-700 dark:text-slate-200">{p.emailSujet}</p>}
                    <p className="line-clamp-2 text-sm text-gray-600">{p.description ?? '—'}</p>
                  </div>
                ),
              },
              {
                key: 'flags',
                header: '',
                cell: (p) => (
                  <span className="flex flex-wrap gap-1">
                    {p.clientId && <Badge tone="green">Client connu</Badge>}
                    {p.doublonDeId && <Badge tone="amber">Doublon ?</Badge>}
                  </span>
                ),
              },
              {
                key: 'source',
                header: 'Source',
                cell: (p) => (p.source === 'EMAIL' ? <Badge tone="violet"><Mail className="mr-1 inline size-3" />Email</Badge> : <Badge tone="slate"><Bot className="mr-1 inline size-3" />Chatbot</Badge>),
              },
              { key: 'msgs', header: 'Messages', align: 'right', cell: (p) => p._count.messages },
              { key: 'date', header: 'Dernière activité', cell: (p) => formatDateTime(p.derniereActivite) },
              { key: 'statut', header: 'Statut', cell: (p) => <StatusBadge kind="prospect" value={p.statut} /> },
            ]}
          />
        )}
        <Pagination meta={list.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>
    </>
  );
}

// ── knowledge base ────────────────────────────────────────────────────────

function ConnaissanceModal({ doc, onClose }: { doc: Connaissance | 'new' | null; onClose: () => void }) {
  const save = useSaveConnaissance();
  const [f, setF] = useState({ titre: '', categorie: '', contenu: '', priorite: '0', actif: true });
  useEffect(() => {
    if (!doc) return;
    setF(doc === 'new' ? { titre: '', categorie: '', contenu: '', priorite: '0', actif: true } : { titre: doc.titre, categorie: doc.categorie, contenu: doc.contenu, priorite: String(doc.priorite), actif: doc.actif });
  }, [doc]);
  if (!doc) return null;
  const hasPrice = /\d\s*(€|euros?)|€\s*\d/i.test(f.contenu);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={doc === 'new' ? 'Nouveau document' : 'Modifier le document'}
      description="L’assistant peut citer ce texte à un visiteur : jamais de prix, de marge ni de conditions fournisseur."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!f.titre.trim() || !f.categorie.trim() || !f.contenu.trim()}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                { id: doc === 'new' ? undefined : doc.id, titre: f.titre.trim(), categorie: f.categorie.trim(), contenu: f.contenu.trim(), priorite: Number(f.priorite), actif: f.actif },
                { onSuccess: () => { toast.success('Document enregistré'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Titre" required containerClassName="sm:col-span-2" value={f.titre} onChange={(e) => setF((s) => ({ ...s, titre: e.target.value }))} placeholder="Délais d’intervention" />
          <Input label="Catégorie" required value={f.categorie} onChange={(e) => setF((s) => ({ ...s, categorie: e.target.value }))} placeholder="Délais, Services…" />
        </div>
        <Textarea label="Contenu" required rows={8} value={f.contenu} onChange={(e) => setF((s) => ({ ...s, contenu: e.target.value }))} />
        {hasPrice && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-orange-50 p-2 text-sm text-orange-800">
            <TriangleAlert className="size-4" /> Ce texte contient un montant : l’assistant ne pourra pas le citer (réponse bloquée).
          </p>
        )}
        <div className="flex flex-wrap items-center gap-6">
          <Select
            label="Priorité"
            containerClassName="w-40"
            options={Array.from({ length: 11 }, (_, i) => ({ value: i, label: i === 0 ? '0 (normale)' : String(i) }))}
            value={f.priorite}
            onChange={(e) => setF((s) => ({ ...s, priorite: e.target.value }))}
          />
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand-700" checked={f.actif} onChange={(e) => setF((s) => ({ ...s, actif: e.target.checked }))} /> Utilisé par l’assistant
          </label>
        </div>
      </div>
    </Modal>
  );
}

function Connaissances({ canWrite }: { canWrite: boolean }) {
  const [query, setQuery] = useState({ page: 1, search: '', categorie: '' });
  const list = useConnaissances(query);
  const categories = useCategoriesConnaissances();
  const remove = useDeleteConnaissance();
  const [editing, setEditing] = useState<Connaissance | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Connaissance | null>(null);
  const [test, setTest] = useState('');
  const [testDebounced, setTestDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setTestDebounced(test), 400);
    return () => clearTimeout(t);
  }, [test]);
  const results = useRechercheConnaissances(testDebounced);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <SearchInput value={query.search} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Rechercher un document…" />
            <Select
              aria-label="Catégorie"
              containerClassName="w-44"
              placeholder="Toutes catégories"
              options={(categories.data ?? []).map((c) => ({ value: c.categorie, label: `${c.categorie} (${c.nombre})` }))}
              value={query.categorie}
              onChange={(e) => setQuery((q) => ({ ...q, categorie: e.target.value, page: 1 }))}
            />
          </div>
          {canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nouveau document</Button>}
        </div>
        <Card className="overflow-hidden">
          {list.isError ? (
            <div className="p-4"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
          ) : (
            <DataTable
              loading={list.isPending}
              rows={list.data?.data}
              rowKey={(d) => d.id}
              empty={{ title: 'Base de connaissances vide', description: 'Ajoutez vos services, délais, zone d’intervention, garanties… L’assistant répond à partir de ces textes.' }}
              columns={[
                {
                  key: 'titre',
                  header: 'Document',
                  cell: (d) => (
                    <div className="max-w-lg">
                      <p className="font-medium text-gray-800 dark:text-slate-100">{d.titre}</p>
                      <p className="line-clamp-2 text-xs text-gray-500">{d.contenu}</p>
                    </div>
                  ),
                },
                { key: 'cat', header: 'Catégorie', cell: (d) => <Badge tone="blue">{d.categorie}</Badge> },
                { key: 'prio', header: 'Priorité', align: 'right', cell: (d) => d.priorite },
                { key: 'actif', header: 'Statut', cell: (d) => <StatusBadge kind="actif" value={d.actif} /> },
                {
                  key: 'actions',
                  header: 'Actions',
                  align: 'right',
                  cell: (d) =>
                    canWrite && (
                      <span className="inline-flex gap-3">
                        <button type="button" onClick={() => setEditing(d)} className="text-gray-400 hover:text-blue-600" aria-label={`Modifier ${d.titre}`}><Pencil className="size-4" /></button>
                        <button type="button" onClick={() => setDeleting(d)} className="text-gray-400 hover:text-red-600" aria-label={`Supprimer ${d.titre}`}><Trash2 className="size-4" /></button>
                      </span>
                    ),
                },
              ]}
            />
          )}
          <Pagination meta={list.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader title={<span className="inline-flex items-center gap-2"><Search className="size-4 text-brand-700" /> Tester une question</span>} description="Les documents que l’assistant utiliserait pour répondre" />
        <div className="space-y-3 p-5">
          <Input aria-label="Question de test" value={test} onChange={(e) => setTest(e.target.value)} placeholder="Ex. : combien de temps pour isoler mes combles ?" />
          {testDebounced.trim().length >= 3 &&
            (results.data?.length === 0 ? (
              <p className="text-sm text-orange-700">Aucun document trouvé : l’assistant proposera de contacter un conseiller.</p>
            ) : (
              <ol className="space-y-2">
                {results.data?.map((r, i) => (
                  <li key={r.id} className="rounded-lg border border-gray-100 p-3 text-sm dark:border-slate-800">
                    <p className="font-medium">{i + 1}. {r.titre}</p>
                    <p className="line-clamp-3 text-xs text-gray-500">{r.contenu}</p>
                  </li>
                ))}
              </ol>
            ))}
        </div>
      </Card>
      <ConnaissanceModal doc={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Supprimer le document"
        message="L’assistant ne pourra plus s’en servir. Pour le mettre de côté, décochez plutôt « Utilisé par l’assistant »."
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast.success('Document supprimé'); setDeleting(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}

// ── journal ───────────────────────────────────────────────────────────────

function Journal() {
  const erreurs = useAssistantErreurs(true);
  const navigate = useNavigate();
  if (erreurs.isError) return <ErrorState error={erreurs.error} onRetry={() => void erreurs.refetch()} />;
  return (
    <Card className="overflow-hidden">
      <DataTable
        loading={erreurs.isPending}
        rows={erreurs.data}
        rowKey={(e) => e.id}
        onRowClick={(e) => e.sessionId && navigate(`/assistant/prospects/${e.sessionId}`)}
        empty={{ title: 'Aucune erreur', description: 'Erreurs de l’IA et réponses bloquées par le filtre de sécurité.' }}
        columns={[
          { key: 'date', header: 'Date', cell: (e) => formatDateTime(e.createdAt) },
          { key: 'type', header: 'Type', cell: (e) => <Badge tone={e.type === 'REPONSE_BLOQUEE' ? 'amber' : 'red'}>{ERREURS[e.type] ?? e.type}</Badge> },
          { key: 'detail', header: 'Détail', cell: (e) => <span className="text-xs text-gray-600">{e.detail ?? '—'}</span> },
          { key: 'conv', header: 'Conversation', cell: (e) => (e.sessionId ? `#${e.sessionId}` : '—') },
        ]}
      />
    </Card>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

type Tab = 'prospects' | 'connaissances' | 'journal';

export function AssistantPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const stats = useAssistantStats();
  const [tab, setTab] = useState<Tab>('prospects');
  const s = stats.data;
  const utiles = s?.feedbacks.UTILE ?? 0;
  const avis = utiles + (s?.feedbacks.PAS_UTILE ?? 0);
  const bloquees = s?.erreurs.REPONSE_BLOQUEE ?? 0;
  const pannes = s ? Object.entries(s.erreurs).filter(([k]) => k !== 'REPONSE_BLOQUEE').reduce((n, [, v]) => n + v, 0) : 0;

  return (
    <>
      <PageHeader
        title="Assistant IA"
        description="Prospects du chatbot et des emails, base de connaissances et qualité des réponses"
        actions={
          <a href="/chat" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ExternalLink className="size-4" /> Ouvrir le chatbot
          </a>
        }
      />
      <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<MessagesSquare />} iconTone="blue" label="Conversations et emails (30 jours)" value={s?.conversations ?? '—'} />
        <Stat icon={<UserCheck />} iconTone="orange" label="Prospects à qualifier" value={s?.parStatut.A_QUALIFIER ?? 0} hint={`${s?.parStatut.QUALIFIE ?? 0} qualifiés`} tone={s?.parStatut.A_QUALIFIER ? 'warning' : 'default'} />
        <Stat icon={<ThumbsUp />} iconTone="green" label="Réponses jugées utiles" value={avis ? `${Math.round((utiles / avis) * 100)} %` : '—'} hint={`${avis} avis`} />
        <Stat icon={<Bot />} iconTone="purple" label="Réponses bloquées / erreurs IA" value={`${bloquees} / ${pannes}`} hint="30 derniers jours" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'prospects', label: 'Prospects' },
          { value: 'connaissances', label: 'Base de connaissances' },
          ...(isAdmin ? [{ value: 'journal' as const, label: 'Journal' }] : []),
        ]}
      />
      {tab === 'prospects' && <Prospects isAdmin={isAdmin} />}
      {tab === 'connaissances' && <Connaissances canWrite={isAdmin} />}
      {tab === 'journal' && isAdmin && <Journal />}
      {tab === 'prospects' && s && s.conversations === 0 && (
        <Card className="mt-6"><EmptyState icon={<Bot className="size-6" />} title="Pas encore de conversation" description={`Le chatbot est disponible sur /chat et sur la page /demo. Pour l’intégrer à votre site : <iframe src="${window.location.origin}/chat" …>.`} /></Card>
      )}
    </>
  );
}
