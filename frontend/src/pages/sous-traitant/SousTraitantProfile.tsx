import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Save, UserCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { message?: unknown } } }).response?.data;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join(' | ');
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function SousTraitantProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ prenom: user?.prenom ?? '', nom: user?.nom ?? '', email: user?.email ?? '' });
  const [password, setPassword] = useState({ newPassword: '', confirm: '' });
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: () => api.patch('/auth/profile', { nom: form.nom.trim(), prenom: form.prenom.trim() || undefined, email: form.email.trim() }),
    onSuccess: ({ data }) => { updateUser(data); setProfileFeedback('Profil mis a jour avec succes.'); },
    onError: (error) => setProfileFeedback(getApiErrorMessage(error, 'Impossible de mettre a jour le profil.')),
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', { newPassword: password.newPassword }),
    onSuccess: () => { setPassword({ newPassword: '', confirm: '' }); setPasswordFeedback('Mot de passe modifie avec succes.'); },
    onError: (error) => setPasswordFeedback(getApiErrorMessage(error, 'Impossible de modifier le mot de passe.')),
  });

  function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileFeedback(null);
    if (!form.nom.trim() || !form.email.trim()) return;
    profileMutation.mutate();
  }

  function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordFeedback(null);
    if (password.newPassword.length < 8) { setPasswordFeedback('Le mot de passe doit contenir au moins 8 caracteres.'); return; }
    if (password.newPassword !== password.confirm) { setPasswordFeedback('Les mots de passe ne correspondent pas.'); return; }
    passwordMutation.mutate();
  }

  const initials = `${user?.prenom?.charAt(0) ?? ''}${user?.nom?.charAt(0) ?? ''}`.toUpperCase() || 'ST';

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">{initials || <UserCircle2 size={28} />}</div>
          <div><h1 className="text-2xl font-bold text-slate-900">Mon profil</h1><p className="text-sm text-slate-500">Sous-traitant</p></div>
        </div>
      </section>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-slate-900">Informations personnelles</h2>
        <form onSubmit={submitProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold text-slate-700">Prenom<input value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500" /></label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500" /></label>
          </div>
          <label className="block space-y-1 text-sm font-semibold text-slate-700">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500" /></label>
          <button disabled={profileMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Save size={16} /> Enregistrer le profil</button>
          {profileFeedback && <p className="text-sm text-slate-600">{profileFeedback}</p>}
        </form>
      </section>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900"><KeyRound size={18} /> Modifier le mot de passe</h2>
        <form onSubmit={submitPassword} className="space-y-4">
          <input required type="password" minLength={8} placeholder="Nouveau mot de passe" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-emerald-500" />
          <input required type="password" minLength={8} placeholder="Confirmer le mot de passe" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} className="w-full rounded-xl border border-stone-200 px-3 py-2.5 outline-none focus:border-emerald-500" />
          <button disabled={passwordMutation.isPending} className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Modifier le mot de passe</button>
          {passwordFeedback && <p className="text-sm text-slate-600">{passwordFeedback}</p>}
        </form>
      </section>
    </div>
  );
}
