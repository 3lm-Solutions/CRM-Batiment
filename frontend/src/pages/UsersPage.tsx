import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import type { User, Role } from '@/types';
import { formatDate, getInitials, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Search, Edit, Trash2, X, Shield, Loader2,
  Mail, Phone, RotateCcw, UserX,
} from 'lucide-react';

const roleConfig: Record<Role, { bg: string; text: string; dot: string; label: string }> = {
  ADMIN:         { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400',    label: 'Administrateur'      },
  TECHNICO:      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400',    label: 'Technico-commercial' },
  ASSISTANTE:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Assistante'          },
  CHEF_CHANTIER: { bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  label: 'Chef de chantier'    },
  SOUS_TRAITANT: { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400',  label: 'Sous-traitant'       },
};

const roles: Role[] = ['ADMIN', 'TECHNICO', 'ASSISTANTE', 'CHEF_CHANTIER', 'SOUS_TRAITANT'];

interface UserForm { email: string; nom: string; prenom: string; telephone: string; role: Role; }
const emptyForm: UserForm = { email: '', nom: '', prenom: '', telephone: '', role: 'TECHNICO' };

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editForm, setEditForm] = useState<Pick<UserForm, 'nom' | 'prenom' | 'telephone' | 'role'> & { actif: boolean }>({
    nom: '', prenom: '', telephone: '', role: 'TECHNICO', actif: true,
  });
  const [resetFeedback, setResetFeedback] = useState<{ userId: number; type: 'success' | 'error'; message: string } | null>(null);
  const [createFeedback, setCreateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => (await api.get('/users')).data as User[],
  });

  const createMutation = useMutation({
    mutationFn: (body: UserForm) => api.post('/auth/create-user', {
      email: body.email, nom: body.nom, prenom: body.prenom,
      telephone: body.telephone || undefined, role: body.role,
    }),
    onSuccess: (res) => {
      const tmp = typeof res?.data?.temporaryPassword === 'string' ? res.data.temporaryPassword : '';
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setForm(emptyForm);
      setCreateFeedback({ type: 'success', message: tmp ? `Utilisateur créé. Mot de passe temporaire : ${tmp}` : 'Utilisateur créé. Vérifiez la boite mail ou les logs backend.' });
    },
    onError: (err) => setCreateFeedback({ type: 'error', message: getApiErrorMessage(err, 'Erreur lors de la création.') }),
  });

  const updateMutation = useMutation({
    mutationFn: (p: { userId: number; nom: string; prenom: string; telephone?: string; role: Role; actif: boolean }) =>
      api.patch(`/users/${p.userId}`, { nom: p.nom, prenom: p.prenom, telephone: p.telephone, role: p.role, actif: p.actif }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['users'] }); setShowEditModal(false); setEditingUser(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}/hard`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => window.alert(getApiErrorMessage(err, 'Erreur lors de la suppression.')),
  });

  const resetTempPasswordMutation = useMutation({
    mutationFn: (p: { userId: number; email: string }) => api.post('/auth/reset-temp-password', { email: p.email }),
    onSuccess: async (res, p) => {
      const tmp = typeof res?.data?.temporaryPassword === 'string' ? res.data.temporaryPassword : '';
      setResetFeedback({ userId: p.userId, type: 'success', message: tmp ? `Nouveau mot de passe : ${tmp}` : 'Réinitialisé. Vérifiez les logs ou la boite mail.' });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err, p) => setResetFeedback({ userId: p.userId, type: 'error', message: getApiErrorMessage(err, 'Échec de réinitialisation.') }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ ...form, email: form.email.trim(), nom: form.nom.trim(), prenom: form.prenom.trim(), telephone: form.telephone.trim() });
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setEditForm({ nom: user.nom, prenom: user.prenom, telephone: user.telephone ?? '', role: user.role, actif: user.actif });
    setShowEditModal(true);
  }

  function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({ userId: editingUser.id, nom: editForm.nom.trim(), prenom: editForm.prenom.trim(), telephone: editForm.telephone.trim() || undefined, role: editForm.role, actif: editForm.actif });
  }

  function handleDeactivate(user: User) {
    if (currentUser?.id === user.id) { window.alert('Vous ne pouvez pas désactiver votre propre compte.'); return; }
    if (!window.confirm(`Désactiver le compte de ${user.prenom} ${user.nom} ?`)) return;
    deleteMutation.mutate(user.id);
  }

  const list = (users ?? []).filter((u) =>
    !search || `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Shield size={24} className="text-red-600" /> Gestion des Utilisateurs
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{list.length} utilisateur(s)</p>
        </div>
        <button
          onClick={() => { createMutation.reset(); setCreateFeedback(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 rounded-xl batiflow-gradient px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/20"
        >
          <Plus size={17} /> Nouvel utilisateur
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher un utilisateur..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-16 text-center shadow-sm">
          <Shield size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((u) => {
            const rc = roleConfig[u.role];
            const isSelf = currentUser?.id === u.id;
            const isAdminAccount = u.role === 'ADMIN';
            const actionsLocked = isSelf || isAdminAccount;

            return (
              <div
                key={u.id}
                className={cn(
                  'group relative flex flex-col rounded-3xl border bg-white p-5',
                  'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
                  'transition-all duration-200',
                  'hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)]',
                  isAdminAccount ? 'border-rose-200 bg-gradient-to-br from-rose-50/60 to-white' : 'border-gray-100',
                )}
              >
                {/* Top-right badge */}
                {isAdminAccount && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-600">
                    <Shield size={10} /> Protégé
                  </span>
                )}
                {isSelf && !isAdminAccount && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-600">
                    Vous
                  </span>
                )}

                {/* Avatar + name */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-13 w-13 h-12 w-12 shrink-0 items-center justify-center rounded-2xl batiflow-gradient text-base font-bold text-white shadow">
                    {getInitials(`${u.prenom} ${u.nom}`)}
                  </div>
                  <div className="min-w-0 flex-1 pr-14">
                    <p className="truncate font-semibold text-gray-900">{u.prenom} {u.nom}</p>
                    <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', rc.bg, rc.text)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', rc.dot)} />
                      {rc.label}
                    </span>
                  </div>
                </div>

                {/* Contact */}
                <div className="mb-4 space-y-1.5 text-sm text-gray-500">
                  <p className="flex min-w-0 items-center gap-2">
                    <Mail size={13} className="shrink-0 text-gray-400" />
                    <span className="truncate">{u.email}</span>
                  </p>
                  {u.telephone && (
                    <p className="flex items-center gap-2">
                      <Phone size={13} className="shrink-0 text-gray-400" />
                      {u.telephone}
                    </p>
                  )}
                </div>

                {/* Status + date */}
                <div className="mb-4 flex items-center justify-between text-xs">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold',
                    u.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', u.actif ? 'bg-emerald-500' : 'bg-gray-400')} />
                    {u.actif ? 'Actif' : 'Inactif'}
                  </span>
                  <span className="text-gray-400">Depuis {formatDate(u.createdAt)}</span>
                </div>

                {/* Feedback */}
                {resetFeedback?.userId === u.id && (
                  <p className={cn('mb-3 rounded-xl px-3 py-2 text-xs',
                    resetFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                    {resetFeedback.message}
                  </p>
                )}

                {/* Divider */}
                <div className="mb-3 h-px bg-gray-100" />

                {/* Actions */}
                {actionsLocked ? (
                  <div className="mt-auto rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-400">
                      {isSelf ? 'Votre compte — actions désactivées' : 'Administrateur — protégé'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-auto flex items-center gap-2">
                    {/* Edit button — blue */}
                    <button
                      onClick={() => openEditModal(u)}
                      title="Modifier"
                      className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-500/30"
                    >
                      <Edit size={13} /> Modifier
                    </button>

                    {/* Reset password — amber icon button */}
                    <button
                      onClick={() => {
                        if (!window.confirm(`Réinitialiser le mot de passe de ${u.email} ?`)) return;
                        setResetFeedback(null);
                        resetTempPasswordMutation.mutate({ userId: u.id, email: u.email });
                      }}
                      disabled={resetTempPasswordMutation.isPending}
                      title="Réinitialiser le mot de passe"
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-all hover:bg-amber-500 hover:text-white hover:shadow-lg hover:shadow-amber-400/30 disabled:opacity-40"
                    >
                      {resetTempPasswordMutation.isPending && resetTempPasswordMutation.variables?.userId === u.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <RotateCcw size={14} />}
                    </button>

                    {/* Deactivate — amber icon button */}
                    <button
                      onClick={() => handleDeactivate(u)}
                      disabled={deleteMutation.isPending}
                      title={!u.actif ? 'Compte déjà inactif' : 'Désactiver le compte'}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:opacity-40',
                        u.actif
                          ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-400/30'
                          : 'cursor-not-allowed bg-gray-100 text-gray-400',
                      )}
                    >
                      <UserX size={14} />
                    </button>

                    {/* Hard delete — permanent */}
                    <button
                      onClick={() => {
                        if (!window.confirm(`Supprimer définitivement ${u.prenom} ${u.nom} ? Cette action est irréversible.`)) return;
                        hardDeleteMutation.mutate(u.id);
                      }}
                      disabled={hardDeleteMutation.isPending}
                      title="Supprimer définitivement"
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition-all hover:bg-rose-600 hover:text-white hover:shadow-lg hover:shadow-rose-500/30 disabled:opacity-40"
                    >
                      {hardDeleteMutation.isPending
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteMutation.error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
          {getApiErrorMessage(deleteMutation.error, 'Erreur lors de la désactivation.')}
        </p>
      )}

      {/* ─── Create Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Nouvel utilisateur</h2>
              <button onClick={() => { setShowModal(false); setCreateFeedback(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Prénom *</label>
                  <input type="text" required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nom *</label>
                  <input type="text" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
              </div>
              <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Le mot de passe temporaire est généré automatiquement et envoyé par email (ou affiché dans les logs backend en dev).
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Téléphone</label>
                <input type="text" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Rôle *</label>
                <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30">
                  {roles.map((r) => <option key={r} value={r}>{roleConfig[r].label}</option>)}
                </select>
              </div>
              {createFeedback && (
                <p className={cn('rounded-lg px-4 py-2 text-sm', createFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                  {createFeedback.message}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setCreateFeedback(null); }}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex items-center gap-2 rounded-xl batiflow-gradient px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50">
                  {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ─── */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Modifier — {editingUser.prenom} {editingUser.nom}</h2>
              <button onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={editingUser.email} disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Prénom *</label>
                  <input type="text" required value={editForm.prenom} onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nom *</label>
                  <input type="text" required value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Téléphone</label>
                <input type="text" value={editForm.telephone} onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Rôle *</label>
                <select required value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30">
                  {roles.map((r) => <option key={r} value={r}>{roleConfig[r].label}</option>)}
                </select>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                <span className="text-sm font-medium text-gray-700">Compte actif</span>
                <input type="checkbox" checked={editForm.actif} onChange={(e) => setEditForm({ ...editForm, actif: e.target.checked })} className="h-4 w-4" />
              </label>
              {updateMutation.error && (
                <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                  {getApiErrorMessage(updateMutation.error, 'Erreur lors de la mise à jour.')}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="flex items-center gap-2 rounded-xl batiflow-gradient px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50">
                  {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
