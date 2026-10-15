import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ROLE_LABELS, type Role } from '@/shared';
import { z } from 'zod';
import { Badge, Button, Card, ConfirmDialog, DataTable, ErrorState, Input, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '../auth/auth-context';
import { useCreateUser, useUpdateUser, useUserAction, useUsers, type User, type UsersQuery } from './api';
import { zPhone } from '@/lib/validation';

const ROLES = Object.keys(ROLE_LABELS) as [Role, ...Role[]];
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

const schema = z.object({
  email: z.string().trim().email('Email invalide'),
  prenom: z.string().trim().min(1, 'Obligatoire'),
  nom: z.string().trim().min(1, 'Obligatoire'),
  role: z.enum(ROLES),
  telephone: zPhone,
});
type FormValues = z.infer<typeof schema>;

function UserFormModal({ user, open, onClose }: { user?: User; open: boolean; onClose: () => void }) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const [created, setCreated] = useState<{ email: string; temporaryPassword?: string; emailSent?: boolean } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: user
      ? { email: user.email, prenom: user.prenom, nom: user.nom, role: user.role, telephone: user.telephone ?? '' }
      : { email: '', prenom: '', nom: '', role: 'TECHNICO', telephone: '' },
  });
  const error = create.error ?? update.error;

  const close = () => {
    setCreated(null);
    create.reset();
    update.reset();
    onClose();
  };

  const submit = form.handleSubmit(({ email, ...v }) => {
    const body = { ...v, telephone: v.telephone || null };
    if (user) {
      update.mutate({ id: user.id, ...body }, { onSuccess: () => { toast.success('Utilisateur modifié'); close(); } });
    } else {
      create.mutate({ ...body, email }, { onSuccess: (r) => setCreated({ email: r.user.email, temporaryPassword: r.temporaryPassword, emailSent: r.emailSent }) });
    }
  });

  if (created) {
    return (
      <Modal open={open} onClose={close} title="Compte créé" footer={<Button onClick={close}>Terminé</Button>}>
        <div className="space-y-3 text-sm">
          <p>
            {created.emailSent
              ? `Les identifiants ont été envoyés à ${created.email}.`
              : `L’email n’a pas pu être envoyé à ${created.email} : transmettez le mot de passe vous-même.`}
          </p>
          {created.temporaryPassword && (
            <p className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
              Mot de passe temporaire : <code className="text-base font-bold">{created.temporaryPassword}</code>
              <span className="mt-1 block text-xs text-slate-500">Affiché uniquement hors production.</span>
            </p>
          )}
          <p className="text-slate-500">L’utilisateur devra choisir son propre mot de passe à la première connexion.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={user ? `Modifier ${user.prenom} ${user.nom}` : 'Nouvel utilisateur'}
      footer={
        <>
          <Button variant="outline" onClick={close}>Annuler</Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>{user ? 'Enregistrer' : 'Créer le compte'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Email" type="email" required disabled={!!user} error={form.formState.errors.email?.message} {...form.register('email')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" required error={form.formState.errors.prenom?.message} {...form.register('prenom')} />
          <Input label="Nom" required error={form.formState.errors.nom?.message} {...form.register('nom')} />
          <Select label="Rôle" required options={ROLE_OPTIONS} {...form.register('role')} />
          <Input label="Téléphone" type="tel" error={form.formState.errors.telephone?.message} {...form.register('telephone')} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{errorMessage(error)}</p>}
      </form>
    </Modal>
  );
}

const CONFIRM_TEXT = {
  deactivate: ['Désactiver le compte', 'La personne sera déconnectée immédiatement et ne pourra plus se connecter.'],
  'reset-password': ['Réinitialiser le mot de passe', 'Un mot de passe temporaire est envoyé par email ; ses sessions ouvertes sont fermées.'],
  delete: ['Supprimer définitivement', 'Impossible si le compte a un historique (devis, tickets…) : préférez la désactivation.'],
} as const;

export function UsersPage() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState<UsersQuery>({ page: 1, search: '', role: '', actif: '' });
  const users = useUsers(query);
  const action = useUserAction();
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [confirm, setConfirm] = useState<{ user: User; action: keyof typeof CONFIRM_TEXT } | null>(null);

  const run = (user: User, act: 'deactivate' | 'activate' | 'reset-password' | 'delete') =>
    action.mutate(
      { id: user.id, action: act },
      {
        onSuccess: (r) => {
          setConfirm(null);
          if (act === 'reset-password') {
            toast.success(r.temporaryPassword ? `Nouveau mot de passe temporaire : ${r.temporaryPassword}` : 'Mot de passe temporaire envoyé par email', { duration: 15_000 });
          } else toast.success('Utilisateur mis à jour');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <>
      <PageHeader title="Utilisateurs" description="Comptes de l’entreprise et rôles" actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nouvel utilisateur</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <SearchInput value={query.search ?? ''} onChange={(search) => setQuery((q) => ({ ...q, search, page: 1 }))} placeholder="Nom, prénom, email…" />
          <Select aria-label="Rôle" containerClassName="w-48" placeholder="Tous les rôles" options={ROLE_OPTIONS} value={query.role} onChange={(e) => setQuery((q) => ({ ...q, role: e.target.value as Role, page: 1 }))} />
          <Select aria-label="Statut" containerClassName="w-40" placeholder="Tous" options={[{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }]} value={query.actif} onChange={(e) => setQuery((q) => ({ ...q, actif: e.target.value as UsersQuery['actif'], page: 1 }))} />
        </div>
        {users.isError ? (
          <div className="p-4"><ErrorState error={users.error} onRetry={() => void users.refetch()} /></div>
        ) : (
          <DataTable
            loading={users.isPending}
            rows={users.data?.data}
            rowKey={(u) => u.id}
            empty={{ title: 'Aucun utilisateur', description: 'Modifiez les filtres ou créez un compte.' }}
            columns={[
              { key: 'nom', header: 'Nom', cell: (u) => <span className="font-medium">{u.prenom} {u.nom}{u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(vous)</span>}</span> },
              { key: 'email', header: 'Email', cell: (u) => u.email },
              { key: 'role', header: 'Rôle', cell: (u) => <Badge tone="blue">{ROLE_LABELS[u.role]}</Badge> },
              { key: 'statut', header: 'Statut', cell: (u) => (u.mustChangePassword && u.actif ? <Badge tone="amber">1re connexion</Badge> : <StatusBadge kind="actif" value={u.actif} />) },
              { key: 'login', header: 'Dernière connexion', cell: (u) => formatDateTime(u.lastLoginAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                cell: (u) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label="Modifier" onClick={() => setEditing(u)} icon={<Pencil className="size-4" />} />
                    {u.id !== me?.id && (
                      <>
                        <Button variant="ghost" size="sm" aria-label="Réinitialiser le mot de passe" onClick={() => setConfirm({ user: u, action: 'reset-password' })} icon={<KeyRound className="size-4" />} />
                        <Button variant="ghost" size="sm" aria-label={u.actif ? 'Désactiver' : 'Réactiver'} onClick={() => (u.actif ? setConfirm({ user: u, action: 'deactivate' }) : run(u, 'activate'))} icon={<Power className="size-4" />} />
                        {u.role !== 'ADMIN' && <Button variant="ghost" size="sm" aria-label="Supprimer" onClick={() => setConfirm({ user: u, action: 'delete' })} icon={<Trash2 className="size-4 text-red-600" />} />}
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={users.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
      </Card>

      <UserFormModal open={editing !== null} user={editing === 'new' ? undefined : (editing ?? undefined)} onClose={() => setEditing(null)} />
      {confirm && (
        <ConfirmDialog
          open
          onClose={() => setConfirm(null)}
          onConfirm={() => run(confirm.user, confirm.action)}
          loading={action.isPending}
          danger={confirm.action !== 'reset-password'}
          title={`${CONFIRM_TEXT[confirm.action][0]} — ${confirm.user.prenom} ${confirm.user.nom}`}
          message={CONFIRM_TEXT[confirm.action][1]}
        />
      )}
    </>
  );
}
