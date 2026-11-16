import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import type { Devis } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle2, Loader2, MailOpen, Printer, XCircle } from 'lucide-react';

type ClientDecision = 'ACCEPTE' | 'REFUSE';

interface ValidationPreviewResponse {
  devis: Devis;
  canRespond: boolean;
  decisionTaken: ClientDecision | null;
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

function getStatusLabel(statut: string) {
  switch (statut) {
    case 'BROUILLON':
      return 'Brouillon';
    case 'ENVOYE':
      return 'Envoyé';
    case 'ACCEPTE':
      return 'Accepté';
    case 'SIGNE':
      return 'Signé';
    case 'REFUSE':
      return 'Refusé';
    case 'ANNULE':
      return 'Annulé';
    case 'REVISE':
      return 'Révisé';
    case 'RENVOYE':
      return 'Renvoyé';
    default:
      return statut;
  }
}

function getClientName(devis: Devis) {
  if (!devis.client) return 'Client';
  return `${devis.client.prenom ?? ''} ${devis.client.nom}`.trim() || devis.client.nom;
}

export default function ClientDevisValidationPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const decisionParam = searchParams.get('decision');
  const initialDecision =
    decisionParam === 'ACCEPTE' || decisionParam === 'REFUSE'
      ? (decisionParam as ClientDecision)
      : null;

  const [selectedDecision, setSelectedDecision] = useState<ClientDecision | null>(initialDecision);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    // Synchronisation avec le param├¿tre de d├®cision de l'URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDecision(initialDecision);
  }, [initialDecision]);

  const previewQuery = useQuery({
    queryKey: ['client-devis-validation', token],
    enabled: token.length > 0,
    queryFn: async () => {
      const response = await api.get('/devis/public/validation', { params: { token } });
      return response.data as ValidationPreviewResponse;
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (decision: ClientDecision) => {
      const response = await api.post('/devis/public/validation/respond', {
        token,
        decision,
      });
      return response.data as { message: string; devis: Devis };
    },
    onSuccess: async (data) => {
      setFeedback({ type: 'success', text: data.message });
      await queryClient.invalidateQueries({ queryKey: ['client-devis-validation', token] });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(
          error,
          'Une erreur est survenue pendant la validation du devis.',
        ),
      });
    },
  });

  const preview = previewQuery.data;
  const devis = preview?.devis;
  const finalDecision = useMemo(
    () => respondMutation.data?.devis?.statut ?? preview?.devis?.statut ?? null,
    [preview?.devis?.statut, respondMutation.data?.devis?.statut],
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-xl md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Validation client</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Votre devis est prêt</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Consultez le détail du devis puis choisissez de l’accepter ou de le refuser.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Printer size={16} />
            Imprimer
          </button>
        </div>

        {!token && (
          <div className="rounded-[28px] border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-rose-700">Lien incomplet</p>
            <p className="mt-2 text-sm text-slate-500">
              Le jeton de validation est absent. Utilisez le lien complet reçu par email.
            </p>
          </div>
        )}

        {previewQuery.isLoading && token && (
          <div className="flex items-center justify-center rounded-[28px] bg-white px-6 py-16 shadow-sm">
            <Loader2 size={24} className="animate-spin text-slate-700" />
          </div>
        )}

        {previewQuery.isError && token && (
          <div className="rounded-[28px] border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold text-rose-700">Lien invalide</p>
            <p className="mt-2 text-sm text-slate-500">
              Ce lien de validation est invalide ou a expiré.
            </p>
          </div>
        )}

        {devis && (
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

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Devis</p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-900">{devis.reference}</h2>
                    <p className="mt-2 text-sm text-slate-500">Statut actuel : {getStatusLabel(finalDecision ?? devis.statut)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Montant TTC</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {formatCurrency(devis.totalTTC ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Client</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{getClientName(devis)}</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-500">
                      {devis.client?.adresseChantier && <p>{devis.client.adresseChantier}</p>}
                      {devis.client?.adresseClient && !devis.client?.adresseChantier && (
                        <p>{devis.client.adresseClient}</p>
                      )}
                      {devis.client?.email && <p>{devis.client.email}</p>}
                      {devis.client?.telephone && <p>{devis.client.telephone}</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Informations</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-500">
                      <p>Date : {formatDate(devis.createdAt)}</p>
                      <p>TVA : {devis.tauxTVA ?? 20}%</p>
                      <p>Mode de validation : {devis.modeValidation ?? 'EMAIL'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-left text-sm text-white">
                        <th className="px-4 py-3 font-semibold">N°</th>
                        <th className="px-4 py-3 font-semibold">Description</th>
                        <th className="px-4 py-3 text-right font-semibold">Quantité</th>
                        <th className="px-4 py-3 text-right font-semibold">Prix U.</th>
                        <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {(devis.lignes ?? []).map((ligne, index) => (
                        <tr key={ligne.id}>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-500">{index + 1}</td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {ligne.description || ligne.prestation?.nom || 'Ligne de devis'}
                            </p>
                            {ligne.dimension && (
                              <p className="mt-1 text-xs text-slate-500">Dimensions: {ligne.dimension}</p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-slate-700">
                            {ligne.quantite} {ligne.unite}
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-slate-700">
                            {formatCurrency(ligne.prixUnitaireVente ?? 0)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(ligne.totalHT ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {devis.notes && (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Notes</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{devis.notes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Récapitulatif</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total HT</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(devis.totalHT ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">TVA</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(devis.totalTVA ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3">
                      <span className="font-semibold text-slate-700">Total TTC</span>
                      <span className="text-lg font-bold text-slate-900">{formatCurrency(devis.totalTTC ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <MailOpen size={18} className="text-slate-700" />
                    <p className="text-sm font-semibold text-slate-900">Décision client</p>
                  </div>

                  {preview?.decisionTaken && !preview.canRespond ? (
                    <div
                      className={
                        preview.decisionTaken === 'ACCEPTE'
                          ? 'mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-700'
                          : 'mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-700'
                      }
                    >
                      {preview.decisionTaken === 'ACCEPTE'
                        ? 'Ce devis a déjà été accepté.'
                        : 'Ce devis a déjà été refusé.'}
                    </div>
                  ) : !preview?.canRespond ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-600">
                      Ce devis n'est plus en attente de validation.
                    </div>
                  ) : (
                    <>
                      <p className="mt-4 text-sm text-slate-500">
                        Choisissez une décision, puis confirmez votre validation.
                      </p>

                      <div className="mt-4 grid gap-3">
                        <button
                          onClick={() => setSelectedDecision('ACCEPTE')}
                          className={
                            selectedDecision === 'ACCEPTE'
                              ? 'flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-left text-emerald-700'
                              : 'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/60'
                          }
                        >
                          <CheckCircle2 size={20} />
                          <div>
                            <p className="font-semibold">Acceptér le devis</p>
                            <p className="text-xs opacity-80">Le devis passe à l’étape suivante.</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setSelectedDecision('REFUSE')}
                          className={
                            selectedDecision === 'REFUSE'
                              ? 'flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-4 text-left text-rose-700'
                              : 'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-700 transition hover:border-rose-200 hover:bg-rose-50/60'
                          }
                        >
                          <XCircle size={20} />
                          <div>
                            <p className="font-semibold">Refusér le devis</p>
                            <p className="text-xs opacity-80">Le devis reste consultable pour suivi.</p>
                          </div>
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          selectedDecision && respondMutation.mutate(selectedDecision)
                        }
                        disabled={!selectedDecision || respondMutation.isPending}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {respondMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                        {selectedDecision === 'ACCEPTE'
                          ? 'Confirmer l’acceptation'
                          : selectedDecision === 'REFUSE'
                            ? 'Confirmer le refus'
                            : 'Choisir une décision'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
