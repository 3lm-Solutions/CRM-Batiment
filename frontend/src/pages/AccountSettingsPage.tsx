import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound, Loader2, Save, UserCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthResponse, User } from '@/types';

interface ProfileResponse extends User {
  company?: { id: number; nom: string };
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data
  ) {
    const message = error.response.data.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string').join(' | ');
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const profileQuery = useQuery({
    queryKey: ['auth-profile'],
    queryFn: async () => {
      const response = await api.get<ProfileResponse>('/auth/profile');
      return response.data;
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AuthResponse & { message?: string }>('/auth/change-password', {
        newPassword,
      });
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      setNewPassword('');
      setConfirmation('');
      setFeedback({ type: 'success', text: data.message ?? 'Mot de passe mis à jour.' });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible de modifier le mot de passe.'),
      });
    },
  });

  const profile = profileQuery.data ?? user;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (newPassword.length < 8) {
      setFeedback({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' });
      return;
    }

    if (newPassword !== confirmation) {
      setFeedback({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }

    changePasswordMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <UserCircle2 size={25} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950">Paramètres du compte</h2>
            <p className="text-sm text-slate-500">Consultez votre profil et sécurisez votre accès.</p>
          </div>
        </div>

        {profileQuery.isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Chargement du profil…
          </div>
        ) : (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <ProfileField label="Nom complet" value={`${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim()} />
            <ProfileField label="Email" value={profile?.email} />
            <ProfileField label="Téléphone" value={profile?.telephone} />
            <ProfileField label="Entreprise" value={profileQuery.data?.company?.nom} />
          </dl>
        )}

        {profileQuery.isError && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Impossible de charger les informations complètes du profil.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <KeyRound size={19} className="text-blue-600" />
          <h3 className="text-lg font-bold text-slate-950">Modifier le mot de passe</h3>
        </div>
        <p className="mt-1 text-sm text-slate-500">Utilisez au moins 8 caractères.</p>

        {feedback && (
          <p
            className={
              feedback.type === 'success'
                ? 'mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'
                : 'mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
            }
          >
            {feedback.text}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <PasswordField
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={setNewPassword}
            visible={showPasswords}
          />
          <PasswordField
            label="Confirmer le mot de passe"
            value={confirmation}
            onChange={setConfirmation}
            visible={showPasswords}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowPasswords((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPasswords ? 'Masquer' : 'Afficher'}
            </button>

            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {changePasswordMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Enregistrer
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-800">{value || 'Non renseigné'}</dd>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label} *</span>
      <input
        type={visible ? 'text' : 'password'}
        required
        minLength={8}
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
