import { ArrowLeft, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, ConfirmDialog, ErrorState, Loading, Modal, PageHeader, Progress, Stat, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatEuros, fullName } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { RapportsCard } from '../rapports/RapportsCard';
import { useUserOptions } from '../users/api';
import {
  useChantier,
  useChantierAction,
  useDeleteChantier,
  useDeleteTache,
  useSetAccesSousTraitants,
  type ChantierAction,
  type ChantierDetail,
  type ChantierStatut,
  type Tache,
} from './api';
import { ChantierFormModal } from './ChantierFormModal';
import { DocumentsCard } from './DocumentsCard';
import { TacheModal } from './TacheModal';

/** Buttons offered per status (same transitions as the API state machine). */
const ACTIONS: Record<ChantierStatut, { action: ChantierAction; label: string; variant?: 'primary' | 'outline' | 'success' | 'danger'; bureauOnly?: boolean; cancel?: boolean }[]> = {
  PLANIFIE: [{ action: 'demarrer', label: 'Démarrer' }, { action: 'annuler', label: 'Annuler', variant: 'outline', cancel: true }],
  EN_COURS: [
    { action: 'terminer', label: 'Terminer', variant: 'success' },
    { action: 'suspendre', label: 'Suspendre', variant: 'outline' },
    { action: 'annuler', label: 'Annuler', variant: 'outline', cancel: true },
  ],
  SUSPENDU: [{ action: 'reprendre', label: 'Reprendre' }, { action: 'annuler', label: 'Annuler', variant: 'outline', cancel: true }],
  TERMINE: [{ action: 'cloturer', label: 'Clôturer', bureauOnly: true }, { action: 'reprendre', label: 'Rouvrir (réserves)', variant: 'outline' }],
  CLOTURE: [],
  ANNULE: [],
};

function AccesModal({ open, onClose, chantier }: { open: boolean; onClose: () => void; chantier: ChantierDetail }) {
  const accounts = useUserOptions(['SOUS_TRAITANT'], open);
  const save = useSetAccesSousTraitants(chantier.id);
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    if (open) setIds(chantier.sousTraitantsVisibles?.map((s) => s.user.id) ?? []);
  }, [open, chantier]);
  const toggle = (id: number) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Accès sous-traitants"
      description="Ces comptes voient le chantier, ses tâches et ses documents dans leur portail — jamais les prix."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            loading={save.isPending}
            onClick={() => save.mutate(ids, { onSuccess: () => { toast.success('Accès mis à jour'); onClose(); }, onError: (e) => toast.error(errorMessage(e)) })}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {accounts.data?.length === 0 && <p className="text-sm text-slate-500">Aucun compte sous-traitant. Créez-en un dans Utilisateurs, puis liez-le à la fiche du sous-traitant.</p>}
        {accounts.data?.map((u) => (
          <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            <input type="checkbox" className="size-4 accent-brand-700" checked={ids.includes(u.id)} onChange={() => toggle(u.id)} />
            {fullName(u)}
          </label>
        ))}
      </div>
    </Modal>
  );
}

function TachesCard({ chantier, canEdit }: { chantier: ChantierDetail; canEdit: boolean }) {
  const remove = useDeleteTache(chantier.id);
  const [editing, setEditing] = useState<Tache | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Tache | null>(null);
  const locked = ['CLOTURE', 'ANNULE'].includes(chantier.statut);

  return (
    <Card>
      <CardHeader
        title="Tâches"
        description={`${chantier.taches.filter((t) => t.statut === 'TERMINEE').length} / ${chantier.taches.length} terminée(s)`}
        actions={canEdit && !locked && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Ajouter</Button>}
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {chantier.taches.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucune tâche. Découpez le chantier en étapes pour suivre l’avancement.</li>}
        {chantier.taches.map((t) => (
          <li key={t.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_10rem_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{t.libelle}</p>
                <StatusBadge kind="tache" value={t.statut} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDate(t.dateDebut)} → {formatDate(t.dateFin)}
                {t.affectations.length > 0 && ` · ${t.affectations.map((a) => fullName(a.user)).join(', ')}`}
              </p>
              {t.commentaire && <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-400">{t.commentaire}</p>}
            </div>
            <Progress value={t.avancement} />
            {canEdit && !locked && (
              <div className="flex gap-1 justify-self-end">
                <button type="button" onClick={() => setEditing(t)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Modifier ${t.libelle}`}>
                  <Pencil className="size-4" />
                </button>
                <button type="button" onClick={() => setDeleting(t)} className="rounded p-1.5 text-slate-500 hover:text-red-600" aria-label={`Supprimer ${t.libelle}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <TacheModal open={editing !== null} onClose={() => setEditing(null)} chantierId={chantier.id} tache={editing === 'new' || !editing ? undefined : editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Supprimer la tâche"
        message={`« ${deleting?.libelle} » sera supprimée.`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast.success('Tâche supprimée'); setDeleting(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </Card>
  );
}

export function ChantierDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const chantier = useChantier(id);
  const action = useChantierAction(id);
  const remove = useDeleteChantier();
  const [editing, setEditing] = useState(false);
  const [acces, setAcces] = useState(false);
  const [confirm, setConfirm] = useState<ChantierAction | 'delete' | null>(null);

  const isBureau = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE');
  // Operational writes: ADMIN, ASSISTANTE, CHEF_CHANTIER (same as the API)
  const canOperate = hasRole('ADMIN', 'ASSISTANTE', 'CHEF_CHANTIER');
  const canCancel = hasRole('ADMIN', 'ASSISTANTE');

  if (chantier.isPending) return <Loading />;
  if (chantier.isError) return <ErrorState error={chantier.error} onRetry={() => void chantier.refetch()} />;
  const c = chantier.data;

  const run = (a: ChantierAction) =>
    action.mutate(a, {
      onSuccess: () => {
        toast.success('Statut mis à jour');
        setConfirm(null);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const actions = ACTIONS[c.statut].filter((a) => canOperate && (!a.bureauOnly || isBureau) && (!a.cancel || canCancel));
  const late = c.dateFin && new Date(c.dateFin) < new Date() && ['PLANIFIE', 'EN_COURS', 'SUSPENDU'].includes(c.statut);

  return (
    <>
      <Link to="/chantiers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Chantiers
      </Link>
      <PageHeader
        title={c.reference}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="chantier" value={c.statut} />
            {late && <Badge tone="red">En retard</Badge>}
            <span>{fullName(c.client)} · {c.adresse}</span>
          </span>
        }
        actions={
          <>
            {actions.map((a) => (
              <Button key={a.action} variant={a.variant ?? 'primary'} loading={action.isPending && action.variables === a.action} onClick={() => (a.cancel ? setConfirm(a.action) : run(a.action))}>
                {a.label}
              </Button>
            ))}
            {canOperate && <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Modifier</Button>}
            {hasRole('ADMIN') && <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm('delete')} aria-label="Supprimer le chantier" />}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Avancement" value={<Progress value={c.avancement} className="mt-1" />} hint={`${c.taches.length} tâche(s)`} />
        <Stat label="Période prévue" value={<span className="text-base">{formatDate(c.dateDebut)} → {formatDate(c.dateFin)}</span>} tone={late ? 'warning' : 'default'} />
        <Stat label="Chef de chantier" value={<span className="text-base">{c.chefChantier ? fullName(c.chefChantier) : 'Non affecté'}</span>} hint={c.chefChantier?.telephone ?? undefined} />
        <Stat
          label="Devis"
          value={
            <span className="flex flex-wrap gap-2 text-base">
              {c.devis.length === 0 && '—'}
              {c.devis.map((d) => (
                <Link key={d.id} to={`/devis/${d.id}`} className="text-brand-700 hover:underline dark:text-blue-300">{d.reference}</Link>
              ))}
            </span>
          }
          hint={c.devis[0]?.totalHT !== undefined ? `${formatEuros(c.devis.reduce((s, d) => s + (d.totalHT ?? 0), 0))} HT` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TachesCard chantier={c} canEdit={canOperate} />
          <RapportsCard chantierId={c.id} canReview={canOperate} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Client" />
            <dl className="space-y-2 p-5 text-sm">
              <div><dt className="text-xs text-slate-500">Nom</dt><dd><Link to={`/clients/${c.client.id}`} className="font-medium hover:underline">{fullName(c.client)}</Link></dd></div>
              <div><dt className="text-xs text-slate-500">Téléphone</dt><dd>{c.client.telephone ?? '—'}</dd></div>
              {c.client.email !== undefined && <div><dt className="text-xs text-slate-500">Email</dt><dd>{c.client.email ?? '—'}</dd></div>}
            </dl>
          </Card>
          {(c.description || c.notes) && (
            <Card>
              <CardHeader title="Description" />
              <div className="space-y-3 p-5 text-sm">
                {c.description && <p className="whitespace-pre-line">{c.description}</p>}
                {c.notes && <p className="whitespace-pre-line rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{c.notes}</p>}
              </div>
            </Card>
          )}
          <DocumentsCard chantierId={c.id} documents={c.documents} canEdit={canOperate} />
          {c.sousTraitantsVisibles && (
            <Card>
              <CardHeader
                title="Sous-traitants"
                description="Comptes ayant accès au portail"
                actions={canOperate && <Button size="sm" variant="outline" icon={<Users className="size-4" />} onClick={() => setAcces(true)}>Gérer</Button>}
              />
              <ul className="space-y-1 p-5 text-sm">
                {c.sousTraitantsVisibles.length === 0 && <li className="text-slate-500">Aucun accès.</li>}
                {c.sousTraitantsVisibles.map((s) => <li key={s.user.id}>{fullName(s.user)}</li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <ChantierFormModal open={editing} onClose={() => setEditing(false)} chantier={c} />
      <AccesModal open={acces} onClose={() => setAcces(false)} chantier={c} />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        danger
        title={confirm === 'delete' ? 'Supprimer le chantier' : 'Annuler le chantier'}
        message={
          confirm === 'delete'
            ? 'Suppression définitive (uniquement possible pour un chantier saisi par erreur).'
            : 'Le chantier passe à ANNULÉ. Cette action est définitive.'
        }
        confirmLabel={confirm === 'delete' ? 'Supprimer' : 'Annuler le chantier'}
        loading={action.isPending || remove.isPending}
        onConfirm={() =>
          confirm === 'delete'
            ? remove.mutate(c.id, { onSuccess: () => { toast.success('Chantier supprimé'); navigate('/chantiers'); }, onError: (e) => toast.error(errorMessage(e)) })
            : confirm && run(confirm)
        }
      />
    </>
  );
}
