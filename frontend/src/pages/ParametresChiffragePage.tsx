import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Save, Settings, UploadCloud } from 'lucide-react';
import api from '@/lib/api';

interface ChiffrageSettingsResponse {
  tvaDefaut: number;
  devise: string;
  margeCiblePourcent: number;
  fraisFixeDeplacement: number;
  pasArrondiPrix: number;
  updatedAt: string | null;
}

interface ValidationIssue {
  type: string;
  message: string;
  prestationId?: number;
  optionId?: number;
}

interface CatalogueValidationResponse {
  isValid: boolean;
  validatedAt: string;
  stats: {
    activeCatégories: number;
    activePrestations: number;
    errors: number;
    warnings: number;
  };
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

interface PublicationStatusResponse {
  lastPublication: {
    publishedAt: string;
    details: unknown;
  } | null;
  chiffrageSettings: ChiffrageSettingsResponse;
}

interface PublicationHistoryItem {
  id: number;
  publishedAt: string;
  publishedBy: {
    id: number;
    fullName: string;
    email: string;
  } | null;
  validationStats: {
    activeCatégories: number | null;
    activePrestations: number | null;
    errors: number | null;
    warnings: number | null;
  } | null;
}

interface ChiffrageSettingsForm {
  tvaDefaut: string;
  devise: string;
  margeCiblePourcent: string;
  fraisFixeDeplacement: string;
  pasArrondiPrix: string;
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
    if (Array.isArray(apiMessage)) return apiMessage.join(', ');
    if (typeof apiMessage === 'string') return apiMessage;
    if (typeof apiMessage === 'object' && apiMessage !== null && 'message' in apiMessage) {
      const nested = apiMessage.message;
      if (typeof nested === 'string') return nested;
    }
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Jamais';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR');
}

export default function ParametresChiffragePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ChiffrageSettingsForm>({
    tvaDefaut: '20',
    devise: 'EUR',
    margeCiblePourcent: '30',
    fraisFixeDeplacement: '0',
    pasArrondiPrix: '0.01',
  });
  const [lastValidation, setLastValidation] = useState<CatalogueValidationResponse | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['chiffrage-settings'],
    queryFn: async () => {
      const res = await api.get('/prestations/admin/chiffrage-settings');
      return res.data as ChiffrageSettingsResponse;
    },
  });

  const { data: publicationStatus } = useQuery({
    queryKey: ['catalogue-publication-status'],
    queryFn: async () => {
      const res = await api.get('/prestations/admin/catalogue-publication-status');
      return res.data as PublicationStatusResponse;
    },
  });

  const { data: publicationHistory, isLoading: loadingPublicationHistory } = useQuery({
    queryKey: ['catalogue-publication-history'],
    queryFn: async () => {
      const res = await api.get('/prestations/admin/catalogue-publication-history');
      return res.data as PublicationHistoryItem[];
    },
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      tvaDefaut: String(settings.tvaDefaut ?? 20),
      devise: settings.devise ?? 'EUR',
      margeCiblePourcent: String(settings.margeCiblePourcent ?? 30),
      fraisFixeDeplacement: String(settings.fraisFixeDeplacement ?? 0),
      pasArrondiPrix: String(settings.pasArrondiPrix ?? 0.01),
    });
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.patch('/prestations/admin/chiffrage-settings', {
        tvaDefaut: Number(form.tvaDefaut),
        devise: form.devise.trim(),
        margeCiblePourcent: Number(form.margeCiblePourcent),
        fraisFixeDeplacement: Number(form.fraisFixeDeplacement),
        pasArrondiPrix: Number(form.pasArrondiPrix),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chiffrage-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['catalogue-publication-status'] }),
      ]);
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/prestations/admin/catalogue-validation');
      return res.data as CatalogueValidationResponse;
    },
    onSuccess: (data) => {
      setLastValidation(data);
      setPublishError(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/prestations/admin/catalogue-publication');
      return res.data as { publishedAt: string; validation: CatalogueValidationResponse };
    },
    onSuccess: async (data) => {
      setLastValidation(data.validation);
      setPublishError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['catalogue-publication-status'] }),
        queryClient.invalidateQueries({ queryKey: ['catalogue-publication-history'] }),
      ]);
    },
    onError: (error) => {
      setPublishError(
        getApiErrorMessage(error, 'Publication impossible: le catalogue contient des erreurs.'),
      );
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPublishError(null);
    saveMutation.mutate();
  }

  const effectiveValidation = lastValidation ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={24} className="text-blue-600" />
            Paramètres de chiffrage
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Configurer les règles globales de calcul et piloter la publication du catalogue.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Règles de calcul globales</h2>

            {loadingSettings ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                Chargement des paramètres...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="TVA par défaut (%)"
                    value={form.tvaDefaut}
                    onChange={(value) => setForm((current) => ({ ...current, tvaDefaut: value }))}
                    type="number"
                    step="0.01"
                  />
                  <Field
                    label="Devise"
                    value={form.devise}
                    onChange={(value) => setForm((current) => ({ ...current, devise: value }))}
                  />
                  <Field
                    label="Marge cible (%)"
                    value={form.margeCiblePourcent}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, margeCiblePourcent: value }))
                    }
                    type="number"
                    step="0.01"
                  />
                  <Field
                    label="Frais fixes de déplacement"
                    value={form.fraisFixeDeplacement}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, fraisFixeDeplacement: value }))
                    }
                    type="number"
                    step="0.01"
                  />
                  <Field
                    label="Pas d'arrondi des prix"
                    value={form.pasArrondiPrix}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, pasArrondiPrix: value }))
                    }
                    type="number"
                    step="0.01"
                  />
                </div>

                {saveMutation.error && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                    {getApiErrorMessage(saveMutation.error, 'Erreur lors de la sauvegarde.')}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl batiflow-gradient text-white text-sm font-medium disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Enregistrer
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Validation et publication du catalogue</h2>
            <p className="text-sm text-gray-500">
              La publication est bloquée tant que la validation détecte des erreurs.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {validateMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Valider le catalogue
              </button>

              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UploadCloud size={16} />
                )}
                Publier le catalogue
              </button>
            </div>

            {publishError && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{publishError}</p>
            )}

            {effectiveValidation && (
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {effectiveValidation.isValid ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-600" />
                  )}
                  <p className="text-sm font-semibold text-gray-900">
                    {effectiveValidation.isValid
                      ? 'Catalogue valide'
                      : 'Catalogue non valide'}
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  Vérifié le {formatDateTime(effectiveValidation.validatedAt)}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <StatChip label="Catégories" value={effectiveValidation.stats.activeCatégories} />
                  <StatChip label="Prestations" value={effectiveValidation.stats.activePrestations} />
                  <StatChip label="Erreurs" value={effectiveValidation.stats.errors} danger />
                  <StatChip label="Alertes" value={effectiveValidation.stats.warnings} />
                </div>

                {effectiveValidation.errors.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    <p className="text-xs font-semibold text-red-700 mb-1">Erreurs bloquantes</p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {effectiveValidation.errors.slice(0, 8).map((error, index) => (
                        <li key={`${error.type}-${index}`}>- {error.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm h-fit">
          <h3 className="text-sm font-semibold text-gray-900">État de publication</h3>
          <p className="text-xs text-gray-500 mt-1">
            Dernière publication du catalogue pour cette entreprise.
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Dernière publication</p>
              <p className="text-gray-900 font-semibold">
                {formatDateTime(publicationStatus?.lastPublication?.publishedAt ?? null)}
              </p>
            </div>

            <div>
              <p className="text-gray-500">Dernière mise à jour des paramètres</p>
              <p className="text-gray-900 font-semibold">
                {formatDateTime(publicationStatus?.chiffrageSettings?.updatedAt ?? settings?.updatedAt ?? null)}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Historique récent
            </p>

            {loadingPublicationHistory ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                <Loader2 size={14} className="animate-spin" />
                Chargement de l'historique...
              </div>
            ) : publicationHistory && publicationHistory.length > 0 ? (
              <div className="mt-3 space-y-3">
                {publicationHistory.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-2.5">
                    <p className="text-xs font-semibold text-gray-900">
                      {formatDateTime(item.publishedAt)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Par {item.publishedBy?.fullName || 'Utilisateur inconnu'}
                    </p>
                    {item.validationStats && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        {item.validationStats.activeCatégories ?? '-'} cat. |{' '}
                        {item.validationStats.activePrestations ?? '-'} prest. |{' '}
                        {item.validationStats.errors ?? '-'} err. |{' '}
                        {item.validationStats.warnings ?? '-'} alertes
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-3">Aucune publication enregistrée.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-2 ${
        danger ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}