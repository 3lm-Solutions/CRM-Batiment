import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, PenSquare, Phone, Save, Trash2, User, UserCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { SignatureCanvas, type SignatureCanvasHandle } from '@/components/signature/SignatureCanvas';
import { cn, formatDate } from '@/lib/utils';

interface SignatureProfileResponse {
  id: number;
  signatureBase64?: string;
  signatureUpdatedAt?: string;
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
    const apiMessage = error.response.data.message;
    if (typeof apiMessage === 'string') return apiMessage;
    if (Array.isArray(apiMessage)) {
      return apiMessage.filter((item): item is string => typeof item === 'string').join(' | ');
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function TechnicoProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canvasRef = useRef<SignatureCanvasHandle | null>(null);
  const [draftSignature, setDraftSignature] = useState<string | null>(null);
  const [signatureFeedback, setSignatureFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Info form ──────────────────────────────────────────────────────────────
  const [infoForm, setInfoForm] = useState({
    prenom: user?.prenom ?? '',
    nom: user?.nom ?? '',
    telephone: user?.telephone ?? '',
  });
  const [infoFeedback, setInfoFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Password form ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ newPassword: '', confirm: '' });
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Queries & mutations ───────────────────────────────────────────────────
  const signatureQuery = useQuery({
    queryKey: ['conseiller-signature-profile'],
    queryFn: async () => {
      const response = await api.get('/conseiller/signature');
      return response.data as SignatureProfileResponse;
    },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async () => {
      const signatureBase64 = draftSignature ?? canvasRef.current?.exportAsDataUrl();
      if (!signatureBase64) {
        throw new Error('Veuillez dessiner votre signature avant de sauvegarder.');
      }
      const response = await api.post('/conseiller/signature', { signatureBase64 });
      return response.data as { message: string };
    },
    onSuccess: async (data) => {
      setSignatureFeedback({ type: 'success', text: data.message ?? 'Signature sauvegardee.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conseiller-signature-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-signature-profile'] }),
      ]);
    },
    onError: (error: unknown) => {
      setSignatureFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Erreur lors de la sauvegarde de la signature.'),
      });
    },
  });

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
  const savedSignature = signatureQuery.data?.signatureBase64;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white shadow">
            {initials || <UserCircle2 size={24} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Mon profil conseiller</h2>
            <p className="text-sm text-slate-500">
              {`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim()}
              {user?.email ? ` • ${user.email}` : ''}
            </p>
            <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
              Technico-commercial
            </span>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ──────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <User size={18} className="text-teal-600" />
          <h3 className="text-base font-bold text-slate-900">Informations personnelles</h3>
        </div>

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Prénom</label>
              <input
                type="text"
                value={infoForm.prenom}
                onChange={(e) => setInfoForm({ ...infoForm, prenom: e.target.value })}
                placeholder="Prénom"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nom *</label>
              <input
                required
                type="text"
                value={infoForm.nom}
                onChange={(e) => setInfoForm({ ...infoForm, nom: e.target.value })}
                placeholder="Nom de famille"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5"><Phone size={13} /> Téléphone</span>
            </label>
            <input
              type="tel"
              value={infoForm.telephone}
              onChange={(e) => setInfoForm({ ...infoForm, telephone: e.target.value })}
              placeholder="0612345678"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-400">L'email ne peut pas être modifié ici.</p>
          </div>

          {infoFeedback && (
            <p className={cn('rounded-xl px-4 py-2 text-sm',
              infoFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
              {infoFeedback.text}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={infoMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50"
            >
              {infoMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      {/* ── Changer le mot de passe ────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Lock size={18} className="text-teal-600" />
          <h3 className="text-base font-bold text-slate-900">Changer le mot de passe</h3>
        </div>

        <form onSubmit={handlePwSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nouveau mot de passe *</label>
            <input
              required
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              minLength={6}
              placeholder="Minimum 6 caractères"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirmer le mot de passe *</label>
            <input
              required
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              placeholder="Répétez le mot de passe"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {pwFeedback && (
            <p className={cn('rounded-xl px-4 py-2 text-sm',
              pwFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
              {pwFeedback.text}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50"
            >
              {pwMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Modifier le mot de passe
            </button>
          </div>
        </form>
      </div>

      {/* ── Signature ─────────────────────────────────────────────────────── */}
      {signatureFeedback && (
        <div className={cn('rounded-2xl border px-4 py-3 text-sm',
          signatureFeedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700')}>
          {signatureFeedback.text}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <PenSquare size={18} className="text-violet-600" />
          <h3 className="text-lg font-bold text-slate-900">Ma signature</h3>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Dessinez votre signature a la souris ou au doigt, puis sauvegardez-la.
        </p>

        {savedSignature && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Apercu signature actuelle
            </p>
            <img
              src={savedSignature}
              alt="Signature conseiller actuelle"
              className="mt-2 h-20 w-full rounded-lg bg-white object-contain"
            />
            {signatureQuery.data?.signatureUpdatedAt && (
              <p className="mt-2 text-xs text-slate-500">
                Derniere mise a jour: {formatDate(signatureQuery.data.signatureUpdatedAt)}
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <SignatureCanvas
            ref={canvasRef}
            initialValue={savedSignature}
            onChange={setDraftSignature}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              canvasRef.current?.clear();
              setDraftSignature(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Trash2 size={15} />
            Effacer
          </button>
          <button
            type="button"
            onClick={() => saveSignatureMutation.mutate()}
            disabled={saveSignatureMutation.isPending || signatureQuery.isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {saveSignatureMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Sauvegarder ma signature
          </button>
        </div>
      </div>

    </div>
  );
}
