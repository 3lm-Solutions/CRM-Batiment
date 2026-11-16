import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { SignatureCanvas, type SignatureCanvasHandle } from '@/components/signature/SignatureCanvas';
import type { Devis, DevisClientSignatureRequest } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, Loader2, Send, ShieldCheck, Signature } from 'lucide-react';

interface SignatureOverviewResponse {
  devis: Devis;
  latestRequest: DevisClientSignatureRequest | null;
  requests: DevisClientSignatureRequest[];
  signatureReadiness: {
    clientSigned: boolean;
    conseillerSigned: boolean;
    canApposeConseillerSignature: boolean;
    isComplete: boolean;
  };
}

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
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function getRequestLabel(statut?: string | null) {
  switch (statut) {
    case 'EN_ATTENTE':
      return 'En attente';
    case 'OTP_ENVOYE':
      return 'OTP envoyé';
    case 'OTP_VERIFIE':
      return 'OTP vérifié';
    case 'SIGNE_CLIENT':
      return 'Signé par le client';
    case 'BLOQUE':
      return 'Bloqué';
    case 'EXPIRE':
      return 'Expiré';
    case 'ANNULE':
      return 'Annulé';
    default:
      return 'Aucune demande';
  }
}

export default function TechnicoDevisSignature() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const devisId = Number(id);
  const canvasRef = useRef<SignatureCanvasHandle | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [clientPhone, setClientPhone] = useState('');
  const [signatureDraft, setSignatureDraft] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['technico-devis-signature', devisId],
    enabled: Number.isFinite(devisId) && devisId > 0,
    queryFn: async () => {
      const response = await api.get(`/devis/${devisId}/signature`);
      return response.data as SignatureOverviewResponse;
    },
  });

  const profileSignatureQuery = useQuery({
    queryKey: ['conseiller-signature-profile'],
    queryFn: async () => {
      const response = await api.get('/conseiller/signature');
      return response.data as SignatureProfileResponse;
    },
  });

  useEffect(() => {
    if (!overviewQuery.data) return;
    const fallbackPhone =
      overviewQuery.data.latestRequest?.telephoneClient ?? overviewQuery.data.devis.client?.telephone;
    if (fallbackPhone) setClientPhone(fallbackPhone);
  }, [overviewQuery.data]);

  useEffect(() => {
    if (!profileSignatureQuery.data?.signatureBase64) return;
    setSignatureDraft(profileSignatureQuery.data.signatureBase64);
  }, [profileSignatureQuery.data?.signatureBase64]);

  const sendClientLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/devis/${devisId}/signature/send-client`, {
        telephone: clientPhone || undefined,
      });
      return response.data as { message: string; signatureUrl: string };
    },
    onSuccess: async (data) => {
      setFeedback({ type: 'success', text: data.message });
      await queryClient.invalidateQueries({ queryKey: ['technico-devis-signature', devisId] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible d’envoyer le lien de signature client.'),
      });
    },
  });

  const saveConseillerSignatureMutation = useMutation({
    mutationFn: async () => {
      const signatureBase64 = signatureDraft ?? canvasRef.current?.exportAsDataUrl();
      if (!signatureBase64) {
        throw new Error('Veuillez dessiner votre signature avant de sauvegarder.');
      }
      const response = await api.post('/conseiller/signature', { signatureBase64 });
      return response.data as { message: string };
    },
    onSuccess: async (data) => {
      setFeedback({ type: 'success', text: data.message });
      await queryClient.invalidateQueries({ queryKey: ['conseiller-signature-profile'] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible de sauvegarder la signature conseiller.'),
      });
    },
  });

  const apposeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/devis/${devisId}/signature/appose-conseiller`);
      return response.data as { message: string };
    },
    onSuccess: async (data) => {
      setFeedback({ type: 'success', text: data.message });
      await queryClient.invalidateQueries({ queryKey: ['technico-devis-signature', devisId] });
      await queryClient.invalidateQueries({ queryKey: ['technico-devis'] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Impossible d’apposer la signature conseiller.'),
      });
    },
  });

  const overview = overviewQuery.data;
  const devis = overview?.devis;
  const latestRequest = overview?.latestRequest;
  const savedSignature = profileSignatureQuery.data?.signatureBase64;

  const canAppose = useMemo(() => {
    if (!overview?.signatureReadiness.canApposeConseillerSignature) return false;
    return Boolean(savedSignature);
  }, [overview?.signatureReadiness.canApposeConseillerSignature, savedSignature]);

  if (!Number.isFinite(devisId) || devisId <= 0) {
    return <p className="text-sm text-rose-600">Identifiant devis invalide.</p>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/technico/devis')}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Retour aux devis
      </button>

      {overviewQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-teal-600" />
        </div>
      ) : overviewQuery.isError || !devis ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Impossible de charger ce devis pour la signature.
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Devis à signer</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{devis.reference}</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                Statut: {devis.statut}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Client: {`${devis.client?.prenom ?? ''} ${devis.client?.nom ?? ''}`.trim() || 'Client'} •
              Total TTC: {formatCurrency(devis.totalTTC ?? 0)}
            </p>
          </div>

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

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Send size={17} className="text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Signature client</h3>
              </div>

              <p className="mt-3 text-sm text-gray-600">
                État demande : <span className="font-semibold">{getRequestLabel(latestRequest?.statut)}</span>
              </p>
              {latestRequest?.expiresAt && (
                <p className="mt-1 text-xs text-gray-500">
                  Expiré le {formatDate(latestRequest.expiresAt)}
                </p>
              )}
              {devis.signatureClientDate && (
                <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={14} />
                  Client signé le {formatDate(devis.signatureClientDate)}
                </p>
              )}

              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">Téléphone client</label>
                <input
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                  placeholder="+33612345678"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />

                <button
                  onClick={() => sendClientLinkMutation.mutate()}
                  disabled={sendClientLinkMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {sendClientLinkMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Envoyer pour signature
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Signature size={18} className="text-violet-600" />
                <h3 className="text-lg font-bold text-gray-900">Signature conseiller</h3>
              </div>

              <p className="mt-3 text-sm text-gray-600">
                Configurez votre signature une fois puis apposez-la sur le devis.
              </p>

              <div className="mt-4">
                <SignatureCanvas
                  ref={canvasRef}
                  initialValue={savedSignature}
                  onChange={setSignatureDraft}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      canvasRef.current?.clear();
                      setSignatureDraft(null);
                    }}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    Effacer
                  </button>
                  <button
                    onClick={() => saveConseillerSignatureMutation.mutate()}
                    disabled={saveConseillerSignatureMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                  >
                    {saveConseillerSignatureMutation.isPending && (
                      <Loader2 size={15} className="animate-spin" />
                    )}
                    Sauvegarder ma signature
                  </button>
                </div>
                {profileSignatureQuery.data?.signatureUpdatedAt && (
                  <p className="mt-2 text-xs text-gray-500">
                    Dernière mise à jour : {formatDate(profileSignatureQuery.data.signatureUpdatedAt)}
                  </p>
                )}
              </div>

              <button
                onClick={() => apposeMutation.mutate()}
                disabled={!canAppose || apposeMutation.isPending}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {apposeMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Apposer ma signature
              </button>

              {!overview.signatureReadiness.canApposeConseillerSignature && (
                <p className="mt-2 text-xs text-amber-700">
                  La signature client est requise avant la signature conseiller.
                </p>
              )}
              {overview.signatureReadiness.canApposeConseillerSignature && !savedSignature && (
                <p className="mt-2 text-xs text-amber-700">
                  Veuillez d’abord configurer votre signature dans votre profil.
                </p>
              )}

              {devis.signatureConseillerDate && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={14} />
                  Conseiller signé le {formatDate(devis.signatureConseillerDate)}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
