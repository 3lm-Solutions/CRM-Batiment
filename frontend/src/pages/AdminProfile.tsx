import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, UserCircle2, Lock, Phone, User } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const data = (error as { response?: { data?: { message?: unknown } } }).response?.data;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return (data.message as string[]).join(' | ');
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function AdminProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Info form ─────────────────────────────────────────────────────────────
  const [infoForm, setInfoForm] = useState({
    prenom: user?.prenom ?? '',
    nom: user?.nom ?? '',
    telephone: user?.telephone ?? '',
  });
  const [infoFeedback, setInfoFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Password form ─────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ newPassword: '', confirm: '' });
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const infoMutation = useMutation({
    mutationFn: () =>
      api.patch(`/users/${user!.id}`, {
        nom: infoForm.nom.trim(),
        prenom: infoForm.prenom.trim(),
        telephone: infoForm.telephone.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setInfoFeedback({ type: 'success', text: 'Informations mises à jour.' });
    },
    onError: (err) => {
      setInfoFeedback({ type: 'error', text: getApiErrorMessage(err, 'Erreur lors de la mise à jour.') });
    },
  });

  const pwMutation = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', { newPassword: pwForm.newPassword }),
    onSuccess: () => {
      setPwForm({ newPassword: '', confirm: '' });
      setPwFeedback({ type: 'success', text: 'Mot de passe modifié avec succès.' });
    },
    onError: (err) => {
      setPwFeedback({ type: 'error', text: getApiErrorMessage(err, 'Erreur lors du changement de mot de passe.') });
    },
  });

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInfoFeedback(null);
    if (!infoForm.nom.trim()) return;
    infoMutation.mutate();
  }

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwFeedback(null);
    if (pwForm.newPassword.length < 6) {
      setPwFeedback({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwFeedback({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    pwMutation.mutate();
  }

  const initials = ((user?.prenom?.charAt(0) ?? '') + (user?.nom?.charAt(0) ?? '')).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl batiflow-gradient text-xl font-bold text-white shadow">
            {initials || <UserCircle2 size={28} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mon Profil</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {user?.prenom} {user?.nom}
              {user?.email ? ` • ${user.email}` : ''}
            </p>
            <span className="mt-1 inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
              Administrateur
            </span>
          </div>
        </div>
      </div>

      {/* ── Personal info ─────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <User size={18} className="text-primary-600" />
          <h2 className="text-base font-bold text-gray-900">Informations personnelles</h2>
        </div>

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Prénom</label>
              <input
                type="text"
                value={infoForm.prenom}
                onChange={(e) => setInfoForm({ ...infoForm, prenom: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nom *</label>
              <input
                required
                type="text"
                value={infoForm.nom}
                onChange={(e) => setInfoForm({ ...infoForm, nom: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
                placeholder="Nom de famille"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              <span className="inline-flex items-center gap-1.5"><Phone size={14} /> Téléphone</span>
            </label>
            <input
              type="tel"
              value={infoForm.telephone}
              onChange={(e) => setInfoForm({ ...infoForm, telephone: e.target.value })}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              placeholder="0612345678"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-400">L'email ne peut pas être modifié ici.</p>
          </div>

          {infoFeedback && (
            <p className={cn('rounded-xl px-4 py-2 text-sm',
              infoFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
              {infoFeedback.text}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={infoMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl batiflow-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
            >
              {infoMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Lock size={18} className="text-primary-600" />
          <h2 className="text-base font-bold text-gray-900">Changer le mot de passe</h2>
        </div>

        <form onSubmit={handlePwSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nouveau mot de passe *</label>
            <input
              required
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              minLength={6}
              placeholder="Minimum 6 caractères"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Confirmer le mot de passe *</label>
            <input
              required
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              placeholder="Répétez le mot de passe"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {pwFeedback && (
            <p className={cn('rounded-xl px-4 py-2 text-sm',
              pwFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
              {pwFeedback.text}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl batiflow-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
            >
              {pwMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Modifier le mot de passe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
