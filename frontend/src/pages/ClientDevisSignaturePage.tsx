import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import { SignatureCanvas, type SignatureCanvasHandle } from '@/components/signature/SignatureCanvas';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle2, Loader2, MessageSquare, ShieldCheck, Signature } from 'lucide-react';

interface PublicSignaturePreviewResponse {
  token: string;
  statut: string;
  expiresAt: string;
  telephoneMasked: string;
  otpAttempts: number;
  clientName: string;
  devis: {
    id: number;
    reference: string;
    statut: string;
    totalTTC: number;
    signatureClientDate?: string;
    signatureConseillerDate?: string;
  };
  canRequestOtp: boolean;
  canVerifyOtp: boolean;
  canSubmitSignature: boolean;
  isBlocked: boolean;
  isExpired: boolean;
  isSigned: boolean;
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
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

export default function ClientDevisSignaturePage() {
  const queryClient = useQueryClient();
  const { token = '' } = useParams();
  const canvasRef = useRef<SignatureCanvasHandle | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [otpCode, setOtpCode] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [signatureValue, setSignatureValue] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ['client-devis-signature', token],
    enabled: token.length > 0,
    queryFn: async () => {
      const response = await api.get(`/devis/public/signature/${token}`);
      return response.data as PublicSignaturePreviewResponse;
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/devis/public/signature/${token}/otp/send`);
      return response.data as { message: string; debugOtp?: string };
    },
    onSuccess: async (data) => {
      setFeedback({
        type: 'success',
        text: data.debugOtp
          ? `${data.message} (code dev: ${data.debugOtp})`
          : data.message,
      });
      await queryClient.invalidateQueries({ queryKey: ['client-devis-signature', token] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible d’envoyer le code OTP.'),
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/devis/public/signature/${token}/otp/verify`, { otpCode });
      return response.data as { message: string; sessionToken: string };
    },
    onSuccess: async (data) => {
      setSessionToken(data.sessionToken);
      setFeedback({ type: 'success', text: data.message });
      await queryClient.invalidateQueries({ queryKey: ['client-devis-signature', token] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Code OTP invalide.'),
      });
    },
  });

  const submitSignatureMutation = useMutation({
    mutationFn: async () => {
      const signatureBase64 = signatureValue ?? canvasRef.current?.exportAsDataUrl();
      if (!signatureBase64) {
        throw new Error('Veuillez dessiner votre signature.');
      }
      if (!sessionToken) {
        throw new Error('Session OTP absente. Veuillez vérifier le code OTP.');
      }
      const response = await api.post(`/devis/public/signature/${token}/submit`, {
        sessionToken,
        signatureBase64,
      });
      return response.data as { message: string };
    },
    onSuccess: async (data) => {
      setFeedback({ type: 'success', text: data.message });
      await queryClient.invalidateQueries({ queryKey: ['client-devis-signature', token] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible d’enregistrer la signature.'),
      });
    },
  });

  const preview = previewQuery.data;
  const canDraw = useMemo(
    () => Boolean(sessionToken) || preview?.canSubmitSignature,
    [preview?.canSubmitSignature, sessionToken],
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signature client</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Validation sécurisée du devis</h1>
          <p className="mt-2 text-sm text-slate-300">
            Identifiez-vous par OTP puis dessinez votre signature.
          </p>
        </div>

        {!token && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Lien de signature incomplet.
          </div>
        )}

        {previewQuery.isLoading && (
          <div className="flex items-center justify-center rounded-[28px] bg-white px-6 py-16 shadow-sm">
            <Loader2 size={24} className="animate-spin text-slate-700" />
          </div>
        )}

        {previewQuery.isError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Lien expiré ou invalide.
          </div>
        )}

        {preview && (
          <>
            {feedback && (
              <div
                className={
                  feedback.type === 'success'
                    ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'
                    : 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
                }
              >
                {feedback.text}
              </div>
            )}

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Client : {preview.clientName}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{preview.devis.reference}</p>
              <p className="mt-1 text-sm text-slate-600">
                Montant TTC : {formatCurrency(preview.devis.totalTTC ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Lien valide jusqu’au {formatDate(preview.expiresAt)}</p>
              <p className="mt-1 text-xs text-slate-500">SMS vers {preview.telephoneMasked}</p>
            </div>

            {!preview.isSigned && (
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-900">Étape OTP</h2>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Cliquez pour recevoir un code, puis saisissez les 6 chiffres.
                </p>
                <button
                  onClick={() => sendOtpMutation.mutate()}
                  disabled={sendOtpMutation.isPending || preview.isBlocked || preview.isExpired}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {sendOtpMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Recevoir le code OTP
                </button>

                <div className="mt-4 flex gap-2">
                  <input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-40 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    onClick={() => verifyOtpMutation.mutate()}
                    disabled={verifyOtpMutation.isPending || otpCode.length !== 6}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {verifyOtpMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                    Vérifier le code
                  </button>
                </div>
              </div>
            )}

            {canDraw && !preview.isSigned && (
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Signature size={18} className="text-violet-600" />
                  <h2 className="text-lg font-bold text-slate-900">Étape signature</h2>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Signez dans la zone ci-dessous puis confirmez.
                </p>

                <div className="mt-4">
                  <SignatureCanvas ref={canvasRef} onChange={setSignatureValue} />
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      canvasRef.current?.clear();
                      setSignatureValue(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Effacer
                  </button>
                  <button
                    onClick={() => submitSignatureMutation.mutate()}
                    disabled={submitSignatureMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {submitSignatureMutation.isPending && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    Confirmer la signature
                  </button>
                </div>
              </div>
            )}

            {preview.isSigned && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800 shadow-sm">
                <p className="inline-flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle2 size={20} />
                  Signature client enregistrée
                </p>
                {preview.devis.signatureClientDate && (
                  <p className="mt-1 text-sm">
                    Date : {formatDate(preview.devis.signatureClientDate)}
                  </p>
                )}
                <p className="mt-2 text-sm">
                  Votre conseiller finalisera le dossier avec sa propre signature.
                </p>
              </div>
            )}

            {(preview.isBlocked || preview.isExpired) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <ShieldCheck size={16} />
                  Lien non utilisable
                </p>
                <p className="mt-1">
                  Contactez votre conseiller pour recevoir un nouveau lien de signature.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

