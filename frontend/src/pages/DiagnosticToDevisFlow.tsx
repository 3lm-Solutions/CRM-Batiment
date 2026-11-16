// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import {
  ChevronRight,
  CheckCircle2,
  Loader2,
  FileText,
  ClipboardList,
  Settings2,
  Play,
  AlertCircle
} from 'lucide-react';

/**
 * Composant de démonstration du flux complet :
 * Questions → Infos → Options → Devis Auto
 */
export default function DiagnosticToDevisFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [categorieId, setCategorieId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'client' | 'questions' | 'infos' | 'options' | 'review' | 'devis'>('client');
  const [generatedDevisId, setGeneratedDevisId] = useState<number | null>(null);

  // ═══ STEP 1 : Créer session ═══
  const createSessionMutation = useMutation({
    mutationFn: () =>
      api.post('/diagnostic/sessions', {
        clientId: parseInt(clientId),
        categorieId: categorieId ? parseInt(categorieId) : undefined,
      }),
    onSuccess: (res) => {
      setSessionId(res.data.id);
      setCurrentStep('questions');
      queryClient.invalidateQueries({ queryKey: ['session', res.data.id] });
    },
  });

  // ═══ STEP 2 : Récupérer questions ═══
  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['session', sessionId, 'questions'],
    queryFn: () =>
      sessionId ? api.get(`/diagnostic/sessions/${sessionId}/questions`) : null,
    enabled: currentStep === 'questions' && !!sessionId,
  });

  // ═══ STEP 3 : Récupérer infos requises ═══
  const { data: infos, isLoading: infosLoading } = useQuery({
    queryKey: ['session', sessionId, 'infos'],
    queryFn: () =>
      sessionId ? api.get(`/diagnostic/sessions/${sessionId}/infos-requises`) : null,
    enabled: currentStep === 'infos' && !!sessionId,
  });

  // ═══ STEP 4 : Récupérer options ═══
  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ['session', sessionId, 'options'],
    queryFn: () =>
      sessionId ? api.get(`/diagnostic/sessions/${sessionId}/options`) : null,
    enabled: currentStep === 'options' && !!sessionId,
  });

  // ═══ STEP 5 : Récupérer session complète ═══
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () =>
      sessionId ? api.get(`/diagnostic/sessions/${sessionId}`) : null,
    enabled: currentStep === 'review' && !!sessionId,
  });

  // ═══ GÉNÉRER DEVIS ═══
  const generateDevisMutation = useMutation({
    mutationFn: () =>
      api.post('/diagnostic/generer-devis', {
        sessionDiagId: sessionId,
        notes: 'Devis généré automatiquement depuis diagnostic',
      }),
    onSuccess: (res) => {
      setGeneratedDevisId(res.data.devisId);
      setCurrentStep('devis');
      queryClient.invalidateQueries({ queryKey: ['devis'] });
    },
  });

  const sendGeneratedDevisMutation = useMutation({
    mutationFn: () => api.post(`/devis/${generatedDevisId}/send-client`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devis'] }),
  });

  const handleAnswerQuestion = (questionId: number, answer: string) => {
    api.post(`/diagnostic/sessions/${sessionId}/reponses`, {
      questionId,
      contenu: answer,
    });
  };

  const handleFillInfo = (infoId: number, value: string) => {
    api.post(`/diagnostic/sessions/${sessionId}/infos-requises`, {
      infoRequiseId: infoId,
      valeur: value,
    });
  };

  const handleSelectOption = (optionId: number, choixId: number) => {
    api.post(`/diagnostic/sessions/${sessionId}/options`, {
      optionPrestationId: optionId,
      choixOptionId: choixId,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText size={36} className="text-blue-600" />
            Diagnostic → Devis Auto
          </h1>
          <p className="text-slate-600 mt-2">
            Parcourez le flux complet : questions → infos → options → devis professionnel généré automatiquement
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {['client', 'questions', 'infos', 'options', 'review', 'devis'].map((step, i, arr) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all',
                    currentStep === step
                      ? 'bg-blue-600 text-white scale-110'
                      : currentStep > step || ['client', 'questions', 'infos', 'options', 'review', 'devis'].indexOf(currentStep) > i
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-300 text-slate-600',
                  )}
                >
                  {['client', 'questions', 'infos', 'options', 'review', 'devis'].indexOf(currentStep) > i ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-1 mx-2 bg-slate-300" />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Client</span>
            <span>Questions</span>
            <span>Infos</span>
            <span>Options</span>
            <span>Résumé</span>
            <span>Devis</span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* STEP 1: Client & Catégorie */}
          {currentStep === 'client' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900">Sélectionner le client</h2>

              <input
                type="number"
                placeholder="ID Client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <input
                type="number"
                placeholder="ID Catégorie (optionnel)"
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <button
                onClick={() => createSessionMutation.mutate()}
                disabled={!clientId || createSessionMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Play size={20} />
                )}
                Démarrer le diagnostic
              </button>
            </div>
          )}

          {/* STEP 2: Questions */}
          {currentStep === 'questions' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList size={24} className="text-amber-500" />
                Questions diagnostiques
              </h2>

              {questionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-slate-500" size={32} />
                </div>
              ) : questions?.data?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Aucune question pour cette catégorie</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions?.data?.map((q) => (
                    <div key={q.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="font-semibold text-slate-900 mb-2">{q.question}</p>
                      {q.aide && <p className="text-xs text-slate-600 mb-3">{q.aide}</p>}

                      {q.typeReponse === 'CHOIX_UNIQUE' && (
                        <div className="space-y-2">
                          {q.choixPossibles?.map((choix) => (
                            <label key={choix} className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                value={choix}
                                onChange={(e) => handleAnswerQuestion(q.id, e.target.value)}
                                className="mr-2"
                              />
                              <span className="text-slate-700">{choix}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.typeReponse === 'TEXTE' && (
                        <input
                          type="text"
                          placeholder="Votre réponse..."
                          onChange={(e) => handleAnswerQuestion(q.id, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setCurrentStep('infos')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mt-8"
              >
                Continuer <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* STEP 3: Infos Requises */}
          {currentStep === 'infos' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList size={24} className="text-purple-500" />
                Infos requises
              </h2>

              {infosLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-slate-500" size={32} />
                </div>
              ) : (
                <div className="space-y-4">
                  {infos?.data?.map((info) => (
                    <div key={info.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-slate-900">{info.nom}</p>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {info.typeInfo}
                        </span>
                      </div>
                      {info.aide && <p className="text-xs text-slate-600 mb-3">{info.aide}</p>}

                      {info.typeInfo === 'MESURE' && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Valeur"
                            onChange={(e) => handleFillInfo(info.id, e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            placeholder={info.unite || 'm²'}
                            className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                      )}

                      {info.typeInfo === 'PHOTO' && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              // En prod, upload vers Cloudinary/S3 et récupérer l'URL
                              handleFillInfo(info.id, 'photo-url-here');
                            }
                          }}
                          className="w-full"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setCurrentStep('options')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mt-8"
              >
                Continuer <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* STEP 4: Options */}
          {currentStep === 'options' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Settings2 size={24} className="text-green-500" />
                Options de customisation
              </h2>

              {optionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-slate-500" size={32} />
                </div>
              ) : (
                <div className="space-y-6">
                  {options?.data?.map((prestGroup) => (
                    <div key={prestGroup.prestationId}>
                      <p className="font-semibold text-slate-900 mb-3">{prestGroup.prestationNom}</p>
                      <div className="space-y-3">
                        {prestGroup.options.map((opt) => (
                          <div key={opt.id} className="bg-slate-50 rounded-lg p-4">
                            <p className="font-medium text-slate-800 mb-2">{opt.nom}</p>
                            {opt.description && (
                              <p className="text-sm text-slate-600 mb-3">{opt.description}</p>
                            )}
                            <div className="space-y-2">
                              {opt.choix.map((c) => (
                                <label key={c.id} className="flex items-center cursor-pointer p-2 hover:bg-white rounded">
                                  <input
                                    type="radio"
                                    name={`opt-${opt.id}`}
                                    onChange={() => handleSelectOption(opt.id, c.id)}
                                    className="mr-2"
                                  />
                                  <span className="flex-1">{c.nom}</span>
                                  {c.impactPrix !== 0 && (
                                    <span className={cn(
                                      'text-sm font-semibold',
                                      c.impactPrix > 0 ? 'text-red-600' : 'text-green-600'
                                    )}>
                                      {c.impactPrix > 0 ? '+' : ''}{formatCurrency(c.impactPrix)}
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setCurrentStep('review')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mt-8"
              >
                Continuer <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* STEP 5: Review */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900">Résumé du diagnostic</h2>

              {sessionLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-slate-500" size={32} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="font-semibold text-blue-900">Client</p>
                    <p className="text-blue-700">{session?.data?.client?.nom} {session?.data?.client?.prenom}</p>
                  </div>

                  {session?.data?.reponses?.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <p className="font-semibold text-amber-900 mb-2">Questions ({session.data.reponses.length})</p>
                      <div className="space-y-1 text-sm text-amber-800">
                        {session.data.reponses.slice(0, 3).map((r) => (
                          <p key={r.id}>✓ {r.question.question}</p>
                        ))}
                        {session.data.reponses.length > 3 && (
                          <p className="text-amber-700 font-semibold">... et {session.data.reponses.length - 3} autres</p>
                        )}
                      </div>
                    </div>
                  )}

                  {session?.data?.valeursInfos?.length > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <p className="font-semibold text-purple-900 mb-2">Infos remplies ({session.data.valeursInfos.length})</p>
                    </div>
                  )}

                  {session?.data?.selectionsOptions?.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="font-semibold text-green-900 mb-2">Options choisies ({session.data.selectionsOptions.length})</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => generateDevisMutation.mutate()}
                disabled={generateDevisMutation.isPending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:bg-slate-400 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-lg transition-all"
              >
                {generateDevisMutation.isPending ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <FileText size={24} />
                )}
                ✨ Générer devis automatiquement
              </button>
            </div>
          )}

          {/* STEP 6: Devis Généré */}
          {currentStep === 'devis' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <h2 className="text-2xl font-bold text-green-900 flex items-center gap-2">
                  <CheckCircle2 size={32} className="text-green-500" />
                  Devis généré ✓
                </h2>
                <p className="text-green-700 mt-2">
                  Le devis a été créé automatiquement avec tous les prix calculés
                </p>
              </div>

              {generatedDevisId && (
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">ID Devis</p>
                      <p className="text-lg font-bold text-slate-900">{generatedDevisId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Statut</p>
                      <p className="text-lg font-bold text-blue-600">BROUILLON</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button type="button" onClick={() => navigate('/admin/devis', { state: { selectedDevisId: generatedDevisId } })} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">
                      Voir le devis
                    </button>
                    <button type="button" onClick={() => sendGeneratedDevisMutation.mutate()} disabled={sendGeneratedDevisMutation.isPending} className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
                      {sendGeneratedDevisMutation.isPending ? 'Envoi…' : 'Envoyer au client'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
