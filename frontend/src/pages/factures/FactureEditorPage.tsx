import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Mail, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { PrintDocumentModal } from '@/components/documents/PrintDocumentModal';
import { CGVDocument } from '@/components/documents/CGVDocument';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  computeFactureLine,
  computeFactureTotals,
  type EditableFactureLine,
} from '@/lib/factureCalculations';
import { cn, formatCurrency } from '@/lib/utils';
import type { FactureDetail } from '@/types';

interface FactureEditorPageProps {
  scope: 'admin' | 'technico' | 'assistante';
}

interface FactureDraft {
  id: number;
  reference: string;
  statut: 'BROUILLON' | 'ENVOYEE' | 'PAYEE' | 'ANNULEE';
  date: string;
  dateEcheance: string;
  typeFacture: 'ACOMPTE' | 'FINALE';
  acomptePercent: number;
  tauxTVA: number;
  referenceDevis: string;
  companyNom: string;
  companyEmail: string;
  companyTelephone: string;
  companyAdresse: string;
  companySiret: string;
  nomClient: string;
  prenomClient: string;
  emailClient: string;
  telephoneClient: string;
  adresseClient: string;
  conditionsPaiement: string;
  communicationPaiement: string;
  notesLegales: string;
  referencePaiement: string;
  editable: boolean;
  lignes: EditableFactureLine[];
}

const DEFAULT_TVA_NOTICE = [
  'Taux de TVA : En l absence de contestation par ecrit, dans un delai d un mois a compter de la reception de la facture,',
  'le client est presume reconnaitre que :',
  '(1) les travaux sont effectues a un batiment d habitation dont la premiere occupation a eu lieu au cours d une annee',
  'civile qui precede d au moins dix ans (*) la date de la premiere facture relative a ces travaux,',
  '(2) qu apres l execution de ces travaux, l habitation est utilisee, exclusivement ou soit a titre principal comme logement',
  'prive et',
  '(3) que ces travaux sont fournis et factures a un consommateur final.',
  'Si au moins une de ces conditions n est pas remplie, le taux normal de TVA sera applicable et le client',
  'supportera la responsabilite quant au paiement de la taxe, des interets et des amendes dus.',
].join('\n');

function toInputDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function parseApiMessage(error: unknown, fallback: string) {
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
  return fallback;
}

function formatLongDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildDraft(detail: FactureDetail): FactureDraft {
  return {
    id: detail.id,
    reference: detail.reference,
    statut: detail.statut,
    date: toInputDate(detail.date),
    dateEcheance: toInputDate(detail.dateEcheance),
    typeFacture: detail.typeFacture ?? 'FINALE',
    acomptePercent: detail.acomptePercent ?? 30,
    tauxTVA: detail.tauxTVA ?? 20,
    referenceDevis: detail.referenceDevis ?? detail.linkedDevis.reference,
    companyNom: detail.companyNom ?? detail.devis?.company?.nom ?? 'Batiflow',
    companyEmail: detail.companyEmail ?? detail.devis?.company?.email ?? '',
    companyTelephone: detail.companyTelephone ?? detail.devis?.company?.telephone ?? '',
    companyAdresse: detail.companyAdresse ?? detail.devis?.company?.adresse ?? '',
    companySiret: detail.companySiret ?? detail.devis?.company?.siret ?? '',
    nomClient: detail.nomClient ?? detail.devis?.client?.nom ?? '',
    prenomClient: detail.prenomClient ?? detail.devis?.client?.prenom ?? '',
    emailClient: detail.emailClient ?? detail.devis?.client?.email ?? '',
    telephoneClient: detail.telephoneClient ?? detail.devis?.client?.telephone ?? '',
    adresseClient:
      detail.adresseClient
      ?? detail.devis?.client?.adresseChantier
      ?? detail.devis?.client?.adresseClient
      ?? '',
    conditionsPaiement:
      detail.conditionsPaiement ?? 'Paiement a 30 jours date de facture.',
    communicationPaiement:
      detail.communicationPaiement ?? `Merci d indiquer ${detail.reference} lors du paiement.`,
    notesLegales: detail.notesLegales ?? DEFAULT_TVA_NOTICE,
    referencePaiement: detail.referencePaiement ?? detail.reference,
    editable: detail.editable,
    lignes: (detail.lignes ?? []).map((line) => ({
      localId: String(line.id),
      id: line.id,
      description: line.description,
      datePrestation: toInputDate(line.datePrestation),
      quantite: line.quantite,
      unite: line.unite,
      prixUnitaireHT: line.prixUnitaireHT,
      tauxTVA: line.tauxTVA,
    })),
  };
}

export default function FactureEditorPage({ scope }: FactureEditorPageProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canSend = user?.role === 'ADMIN' || user?.role === 'ASSISTANTE';

  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draftState, setDraftState] = useState<FactureDraft | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const factureId = Number(id);
  const basePath = scope === 'admin' ? '/admin/factures' : scope === 'assistante' ? '/assistante/factures' : '/technico/factures';

  const factureQuery = useQuery({
    queryKey: ['facture-detail', factureId],
    enabled: Number.isFinite(factureId),
    queryFn: async () => {
      const response = await api.get(`/factures/${factureId}`);
      return response.data as FactureDetail;
    },
  });

  const draft = useMemo(() => {
    if (draftState && draftState.id === factureId) return draftState;
    if (factureQuery.data) return buildDraft(factureQuery.data);
    return null;
  }, [draftState, factureId, factureQuery.data]);

  const setDraft = (updater: (current: FactureDraft | null) => FactureDraft | null) => {
    setDraftState((current) => {
      const base =
        current && current.id === factureId
          ? current
          : factureQuery.data
            ? buildDraft(factureQuery.data)
            : null;
      return updater(base);
    });
  };

  const computedLines = useMemo(() => {
    if (!draft) return [];
    if (draft.typeFacture === 'ACOMPTE' && draft.lignes.length === 0 && factureQuery.data) {
      return [
        {
          localId: 'virtual-acompte',
          description: `Facture d'acompte de ${draft.acomptePercent ?? 30}% pour le devis ${draft.referenceDevis}`,
          datePrestation: draft.date,
          quantite: 1,
          unite: 'FORFAIT',
          prixUnitaireHT: factureQuery.data.montantHT,
          tauxTVA: draft.tauxTVA ?? 20,
          montantHT: factureQuery.data.montantHT,
          montantTVA: factureQuery.data.montantTVA,
          montantTTC: factureQuery.data.montantTTC,
        },
      ];
    }
    return draft.lignes.map((line) => computeFactureLine(line));
  }, [draft, factureQuery.data]);

  const totals = useMemo(() => {
    if (!draft) return { totalHT: 0, totalTVA: 0, totalTTC: 0 };
    if (draft.typeFacture === 'ACOMPTE' && draft.lignes.length === 0 && factureQuery.data) {
      return {
        totalHT: factureQuery.data.montantHT,
        totalTVA: factureQuery.data.montantTVA,
        totalTTC: factureQuery.data.montantTTC,
      };
    }
    return computeFactureTotals(
      draft.lignes,
      draft.typeFacture,
      draft.acomptePercent,
      undefined,
    );
  }, [draft, factureQuery.data]);

  const tvaGroups = useMemo(() => {
    const groups: Record<number, number> = {};
    computedLines.forEach((line) => {
      const rate = line.tauxTVA ?? 20;
      const lineHT = line.montantHT ?? 0;
      const lineTVA = lineHT * (rate / 100);
      groups[rate] = (groups[rate] || 0) + lineTVA;
    });
    return Object.entries(groups).map(([rate, amount]) => ({
      rate: Number(rate),
      amount,
    }));
  }, [computedLines]);

  const locked = !draft || !draft.editable || draft.statut === 'PAYEE' || !isAdmin;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) {
        throw new Error('Facture non chargee.');
      }

      const payload = {
        reference: draft.reference,
        date: draft.date,
        dateEcheance: draft.dateEcheance || null,
        typeFacture: draft.typeFacture,
        acomptePercent: draft.typeFacture === 'ACOMPTE' ? draft.acomptePercent : null,
        tauxTVA: draft.tauxTVA,
        companyNom: draft.companyNom,
        companyEmail: draft.companyEmail,
        companyTelephone: draft.companyTelephone,
        companyAdresse: draft.companyAdresse,
        companySiret: draft.companySiret,
        nomClient: draft.nomClient,
        prenomClient: draft.prenomClient,
        emailClient: draft.emailClient,
        telephoneClient: draft.telephoneClient,
        adresseClient: draft.adresseClient,
        conditionsPaiement: draft.conditionsPaiement,
        communicationPaiement: draft.communicationPaiement,
        notesLegales: draft.notesLegales,
        referencePaiement: draft.referencePaiement,
        lignes: draft.lignes.map((line) => ({
          description: line.description,
          datePrestation: line.datePrestation || undefined,
          quantite: Number(line.quantite),
          unite: line.unite,
          prixUnitaireHT: Number(line.prixUnitaireHT),
          tauxTVA: Number(line.tauxTVA),
        })),
      };

      const response = await api.patch(`/factures/${draft.id}`, payload);
      return response.data as FactureDetail;
    },
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['factures-list'] });
      queryClient.invalidateQueries({ queryKey: ['factures-devis-sources'] });
      queryClient.setQueryData(['facture-detail', factureId], data);
      setDraftState(buildDraft(data));
      setFeedback({ type: 'success', text: 'Facture enregistree avec succes.' });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: parseApiMessage(error, 'Impossible d enregistrer la facture.'),
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!draft) {
        throw new Error('Facture non chargee.');
      }
      const response = await api.post(`/factures/${draft.id}/send-client`, {
        email: draft.emailClient,
      });
      return response.data;
    },
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['facture-detail', factureId] });
      await queryClient.invalidateQueries({ queryKey: ['factures-list'] });
      setFeedback({
        type: 'success',
        text: data?.message ?? 'Facture envoyee au client avec succes.',
      });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: parseApiMessage(error, 'Erreur lors de l envoi de la facture.'),
      });
    },
  });

  const statutMutation = useMutation({
    mutationFn: async (statut: FactureDraft['statut']) => {
      if (!draft) {
        throw new Error('Facture non chargee.');
      }
      const response = await api.patch(`/factures/${draft.id}/statut`, { statut });
      return response.data as FactureDetail;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['factures-list'] });
      queryClient.setQueryData(['facture-detail', factureId], data);
      setDraftState(buildDraft(data));
      setFeedback({ type: 'success', text: 'Statut facture mis a jour.' });
    },
    onError: (error: unknown) => {
      setFeedback({
        type: 'error',
        text: parseApiMessage(error, 'Impossible de changer le statut.'),
      });
    },
  });

  if (factureQuery.isLoading || !draft) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={30} className="animate-spin text-teal-600" />
      </div>
    );
  }

  if (factureQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Impossible de charger la facture.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate(basePath)}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={15} />
            Retour a Mes factures
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Facture {draft.reference}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Devis source: {draft.referenceDevis} | Total TTC: {formatCurrency(totals.totalTTC)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={draft.statut}
            onChange={(event) => {
              const nextStatus = event.target.value as FactureDraft['statut'];
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      statut: nextStatus,
                    }
                  : current,
              );
              statutMutation.mutate(nextStatus);
            }}
            disabled={statutMutation.isPending || !canSend}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="BROUILLON">Brouillon</option>
            <option value="ENVOYEE">Envoyee</option>
            <option value="PAYEE">Payee</option>
            <option value="ANNULEE">Annulee</option>
          </select>

          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer size={15} />
            Exporter PDF
          </button>

          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !canSend}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
              canSend
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-50"
            )}
            title={canSend ? "Envoyer au client par e-mail" : "Non autorisé (réservé à l'Admin ou à l'Assistante)"}
          >
            <Mail size={15} />
            Envoyer au client
          </button>

          {isAdmin && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || locked}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Societe</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.companyNom}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, companyNom: event.target.value } : current))
              }
              disabled={locked}
              placeholder="Nom societe"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.companyEmail}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, companyEmail: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Email societe"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.companyTelephone}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, companyTelephone: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Telephone societe"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.companySiret}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, companySiret: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="SIRET"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              value={draft.companyAdresse}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, companyAdresse: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Adresse societe"
              rows={2}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Client</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.nomClient}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, nomClient: event.target.value } : current))
              }
              disabled={locked}
              placeholder="Nom client"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.prenomClient}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, prenomClient: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Prenom client"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.emailClient}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, emailClient: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Email client"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.telephoneClient}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, telephoneClient: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Telephone client"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              value={draft.adresseClient}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, adresseClient: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Adresse client"
              rows={2}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Bloc facture
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={draft.reference}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, reference: event.target.value } : current))
            }
            disabled={locked}
            placeholder="Numero facture"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={draft.date}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, date: event.target.value } : current))
            }
            disabled={locked}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={draft.dateEcheance}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, dateEcheance: event.target.value } : current
              )
            }
            disabled={locked}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select
            value={draft.typeFacture}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      typeFacture: event.target.value as 'ACOMPTE' | 'FINALE',
                    }
                  : current,
              )
            }
            disabled={locked}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="FINALE">Facture finale</option>
            <option value="ACOMPTE">Facture acompte</option>
          </select>
          <input
            type="number"
            value={draft.acomptePercent}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? { ...current, acomptePercent: Number(event.target.value || 0) }
                  : current
              )
            }
            disabled={locked || draft.typeFacture !== 'ACOMPTE'}
            placeholder="% acompte"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={draft.tauxTVA}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, tauxTVA: Number(event.target.value || 0) } : current
              )
            }
            disabled={locked}
            placeholder="TVA par defaut"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Lignes de facturation
          </h2>
          <button
            onClick={() =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      lignes: [
                        ...current.lignes,
                        {
                          localId: `new-${Date.now()}-${current.lignes.length}`,
                          description: 'Nouvelle ligne',
                          datePrestation: current.date,
                          quantite: 1,
                          unite: 'u',
                          prixUnitaireHT: 0,
                          tauxTVA: current.tauxTVA,
                        },
                      ],
                    }
                  : current,
              )
            }
            disabled={locked}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Plus size={13} />
            Ajouter une ligne
          </button>
        </div>

        <div className="space-y-3">
          {draft.lignes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Aucune ligne facture.
            </p>
          ) : (
            draft.lignes.map((line, index) => {
              const computed = computeFactureLine(line);

              return (
                <div key={line.localId} className="rounded-2xl border border-slate-200 p-3">
                  <div className="grid gap-2 lg:grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_auto]">
                    <input
                      value={line.description}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                lignes: current.lignes.map((currentLine) =>
                                  currentLine.localId === line.localId
                                    ? { ...currentLine, description: event.target.value }
                                    : currentLine,
                                ),
                              }
                            : current,
                        )
                      }
                      disabled={locked}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      value={line.datePrestation ?? ''}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                lignes: current.lignes.map((currentLine) =>
                                  currentLine.localId === line.localId
                                    ? { ...currentLine, datePrestation: event.target.value }
                                    : currentLine,
                                ),
                              }
                            : current,
                        )
                      }
                      disabled={locked}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={line.quantite}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                lignes: current.lignes.map((currentLine) =>
                                  currentLine.localId === line.localId
                                    ? { ...currentLine, quantite: Number(event.target.value || 0) }
                                    : currentLine,
                                ),
                              }
                            : current,
                        )
                      }
                      disabled={locked}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={line.unite}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                lignes: current.lignes.map((currentLine) =>
                                  currentLine.localId === line.localId
                                    ? { ...currentLine, unite: event.target.value }
                                    : currentLine,
                                ),
                              }
                            : current,
                        )
                      }
                      disabled={locked}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      step="any"
                      value={line.prixUnitaireHT}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                lignes: current.lignes.map((currentLine) =>
                                  currentLine.localId === line.localId
                                    ? {
                                        ...currentLine,
                                        prixUnitaireHT: Number(event.target.value || 0),
                                      }
                                    : currentLine,
                                ),
                              }
                            : current,
                        )
                      }
                      disabled={locked}
                      className="input-no-spin rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                lignes: current.lignes.filter(
                                  (currentLine) => currentLine.localId !== line.localId,
                                ),
                              }
                            : current,
                        )
                      }
                      disabled={locked}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-600 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Ligne #{index + 1}</span>
                    <span>
                      HT {formatCurrency(computed.montantHT)} | TVA {formatCurrency(computed.montantTVA)} |
                      TTC {formatCurrency(computed.montantTTC)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conditions et communication
          </h2>
          <div className="space-y-3">
            <textarea
              value={draft.conditionsPaiement}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, conditionsPaiement: event.target.value } : current
                )
              }
              disabled={locked}
              rows={3}
              placeholder="Conditions de paiement"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              value={draft.communicationPaiement}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, communicationPaiement: event.target.value } : current
                )
              }
              disabled={locked}
              rows={2}
              placeholder="Communication libre"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              value={draft.notesLegales}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, notesLegales: event.target.value } : current
                )
              }
              disabled={locked}
              rows={2}
              placeholder="Mentions legales"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={draft.referencePaiement}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, referencePaiement: event.target.value } : current
                )
              }
              disabled={locked}
              placeholder="Reference de paiement"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-900 bg-slate-900 p-4 text-white shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Recapitulatif</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-300">
              <span>Total HT</span>
              <span className="font-medium text-white">{formatCurrency(totals.totalHT)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Total TVA</span>
              <span className="font-medium text-white">{formatCurrency(totals.totalTVA)}</span>
            </div>
            {draft.typeFacture === 'ACOMPTE' && (
              <div className="flex items-center justify-between text-slate-300">
                <span>Acompte</span>
                <span className="font-medium text-white">{draft.acomptePercent}%</span>
              </div>
            )}
            <div className="mt-3 border-t border-slate-700 pt-3 flex items-center justify-between">
              <span className="text-base font-semibold">Total TTC</span>
              <span className="text-2xl font-bold">{formatCurrency(totals.totalTTC)}</span>
            </div>
          </div>
        </div>
      </section>

      {showPrintPreview && (
        <PrintDocumentModal
          title="Facture"
          subtitle="Apercu avant export PDF"
          onClose={() => setShowPrintPreview(false)}
          onPrint={() => window.print()}
        >
          <div className="devis-print-scroll overflow-y-auto bg-[#f4f1eb] py-8 px-4 flex flex-col gap-6 items-center">
            
            {/* PAGE 1: HEADER & ITEMS & ACOMPTES */}
            <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-sm leading-relaxed relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box' }}>
              <div>
                <div className="grid grid-cols-[1fr_1fr] gap-6 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Entreprise</p>
                    <p className="text-base font-bold text-slate-900 mt-1">{draft.companyNom || 'BATIFLOW'}</p>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <p>{draft.companyAdresse}</p>
                      <p>{draft.companyEmail} | {draft.companyTelephone}</p>
                      {draft.companySiret && <p>SIRET: {draft.companySiret}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Coordonnées client</p>
                    <p className="text-base font-bold text-slate-900 mt-1">{`${draft.prenomClient} ${draft.nomClient}`.trim()}</p>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <p>{draft.adresseClient}</p>
                      {draft.telephoneClient && <p>{draft.telephoneClient}</p>}
                      {draft.emailClient && <p>{draft.emailClient}</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">FACTURE</h1>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">Réf: {draft.reference}</p>
                  </div>
                  <div className="text-right text-xs text-slate-600 space-y-0.5">
                    <p>Date d'émission: <span className="font-semibold text-slate-900">{formatLongDate(draft.date)}</span></p>
                    <p>Date d'échéance: <span className="font-semibold text-slate-900">{formatLongDate(draft.dateEcheance)}</span></p>
                    <p>Conditions: <span className="font-semibold text-slate-900">{draft.conditionsPaiement || 'Paiement comptant'}</span></p>
                  </div>
                </div>

                <table className="w-full mt-8 border-collapse text-[11px] leading-relaxed">
                  <thead>
                    <tr className="bg-slate-800 text-white uppercase text-[9px] tracking-wider">
                      <th className="px-3 py-2 text-left font-semibold rounded-l-md">N°</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-right font-semibold">Qte</th>
                      <th className="px-3 py-2 text-right font-semibold">PU HT</th>
                      <th className="px-3 py-2 text-right font-semibold">TVA %</th>
                      <th className="px-3 py-2 text-right font-semibold">Montant TVA</th>
                      <th className="px-3 py-2 text-right font-semibold rounded-r-md">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {computedLines.map((line, index) => {
                      const rate = line.tauxTVA ?? 20;
                      const lineHT = line.montantHT ?? 0;
                      const lineTVA = lineHT * (rate / 100);
                      return (
                        <tr key={line.localId || index}>
                          <td className="px-3 py-2.5 align-top text-slate-400">{index + 1}.</td>
                          <td className="px-3 py-2.5 align-top font-medium text-slate-900">{line.description}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{line.quantite} {line.unite}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(line.prixUnitaireHT)}</td>
                          <td className="px-3 py-2.5 text-right">{rate}%</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(lineTVA)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-950">{formatCurrency(lineHT)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
                <span>Facture Réf: {draft.reference}</span>
                <span>Page 1 / 4</span>
              </div>
            </div>

            {/* PAGE 2: TOTALS, COMM, INFOS BANCAIRES */}
            <div className="a4-page print-page print:shadow-none print:m-0 print:p-[12mm] bg-white text-slate-800 text-sm relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box' }}>
              <div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Réf: {draft.reference}</span>
                  <span className="text-[11px] text-slate-500 font-semibold">Récapitulatif & Paiement</span>
                </div>

                <div className="grid grid-cols-[1.2fr_0.8fr] gap-6 items-start">
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 leading-relaxed text-slate-600">
                      <p className="font-bold text-slate-800 mb-1">Informations bancaires :</p>
                      <p>Veuillez effectuer votre virement sur le compte bancaire de la société.</p>
                      <p className="mt-1 font-semibold text-slate-800">IBAN : LU96 0123 4567 8901 2345</p>
                      <p>BIC/SWIFT : BATIFLLX</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 leading-relaxed text-slate-600">
                      <p className="font-bold text-slate-800 mb-1">Références de paiement :</p>
                      <p>Veuillez utiliser la référence suivante lors de votre virement : <strong className="text-slate-900">{draft.referencePaiement || draft.reference}</strong></p>
                      <p className="mt-1">Notre référence dossier : <strong className="text-slate-900">{draft.referenceDevis}</strong></p>
                    </div>
                  </div>

                  <div className="border border-slate-200 bg-slate-900 text-white rounded-2xl p-4 text-xs space-y-3 shadow-md">
                    <div className="flex justify-between text-slate-300 font-medium">
                      <span>Total HT</span>
                      <span>{formatCurrency(totals.totalHT)}</span>
                    </div>
                    {tvaGroups.map((group) => (
                      <div key={group.rate} className="flex justify-between text-slate-400">
                        <span>TVA {group.rate}%</span>
                        <span>{formatCurrency(group.amount)}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-sm">
                      <span>Total TTC</span>
                      <span>{formatCurrency(totals.totalTTC)}</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between font-extrabold text-base text-yellow-400">
                      <span>Montant total</span>
                      <span>{formatCurrency(totals.totalTTC)}</span>
                    </div>
                  </div>
                </div>

                {draft.notesLegales && (
                  <div className="mt-8 p-3 rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-500 leading-relaxed">
                    <p className="font-semibold text-slate-700 mb-0.5">Mentions légales & TVA :</p>
                    <p>{draft.notesLegales}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
                <span>Facture Réf: {draft.reference}</span>
                <span>Page 2 / 4</span>
              </div>
            </div>

            {/* PAGE 3 & 4: CGV */}
            <CGVDocument
              companyNom={draft.companyNom}
              companyEmail={draft.companyEmail}
              companyTelephone={draft.companyTelephone}
              companyAdresse={draft.companyAdresse}
              companySiret={draft.companySiret}
              pageOffset={3}
            />
          </div>
        </PrintDocumentModal>
      )}
    </div>
  );
}
