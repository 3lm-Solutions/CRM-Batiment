import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { DevisInvoice } from '@/components/DevisInvoice';
import type {
  Client,
  DemandeDevis,
  Devis,
  CatalogueCategorieWithCompositions,
  Prestation,
  QuestionDiagnostic,
  OptionPrestation,
} from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import {
  CheckSquare, Square, ChevronRight, Loader2, Calculator,
  Package, Wrench, AlertCircle, CheckCircle2, Plus, Minus, HelpCircle,
  Layers, Ruler, Camera, Eye, ListChecks, MessageSquare, Hash,
  ToggleLeft, CircleDot, CheckCircle, Search, X, FileText,
} from 'lucide-react';

// ÔöÇÔöÇ Types locaux ÔöÇÔöÇ
interface ChecklistItem {
  prestationId: number;
  quantite: number;
  selectedOptions: Map<number, number[]>; // optionId → choixIds[]
  reponsesDiag: Map<number, string | string[] | boolean>; // questionId → réponse
  infosValues: Map<string, string>; // nom → valeur
}

interface PricingResult {
  prixVente: number;
  coutParUnite: number;
  optionImpactParUnite: number;
  minUnitPrice: number;
  maxUnitPrice: number;
}

type ChoiceWithImpact = { nom: string; impactPrix?: number };
type QuestionChoice = string | ChoiceWithImpact;

type Step = 'categories' | 'sous-categories' | 'prestations' | 'clarification' | 'recap';

interface DemandeChecklistContext extends DemandeDevis {
  devis?: Devis[];
}

interface ProjectCategoryMatch {
  category: CatalogueCategorieWithCompositions;
  score: number;
  reasons: string[];
}

const PROJECT_STOP_WORDS = new Set([
  'avec',
  'chez',
  'dans',
  'des',
  'du',
  'pour',
  'projet',
  'travaux',
  'type',
  'client',
  'besoin',
  'maison',
  'appartement',
  'complete',
  'complet',
  'renovation',
]);

// ÔöÇÔöÇ Helpers pour affichage ÔöÇÔöÇ
function allPrestationsInCat(cat: CatalogueCategorieWithCompositions): Prestation[] {
  const fromSousCat = (cat.sousCategories ?? []).flatMap((sc) => sc.prestations ?? []);
  return [...(cat.prestations ?? []), ...fromSousCat];
}

function getClientDisplayName(
  client?: Pick<Client, 'nom' | 'prenom'> | null,
  fallbackClientId?: number,
) {
  if (!client) return fallbackClientId ? `#${fallbackClientId}` : 'Client';
  return `${client.prenom ?? ''} ${client.nom}`.trim() || (fallbackClientId ? `#${fallbackClientId}` : 'Client');
}

function getClientProjectTypes(client?: Client | null) {
  if (!client) return [] as NonNullable<Client['typeProjets']>;
  if ((client.typeProjets?.length ?? 0) > 0) return client.typeProjets ?? [];
  return client.typeProjet ? [client.typeProjet] : [];
}

function normalizeSearchText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitTerms(value?: string | null) {
  return normalizeSearchText(value)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !PROJECT_STOP_WORDS.has(term));
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
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

function matchCategoriesToProject(
  categories: CatalogueCategorieWithCompositions[],
  projectTerms: string[],
) {
  if (projectTerms.length === 0) return [] as ProjectCategoryMatch[];

  return categories
    .map((category) => {
      const haystack = normalizeSearchText(
        [
          category.nom,
          category.description,
          ...(category.questionsDiagnostic ?? []).map((question) => question.question),
          ...(category.sousCategories ?? []).flatMap((sousCategorie) => [
            sousCategorie.nom,
            sousCategorie.description,
            ...(sousCategorie.questionsDiagnostic ?? []).map((question) => question.question),
            ...(sousCategorie.prestations ?? []).flatMap((prestation) => [
              prestation.nom,
              prestation.description,
            ]),
          ]),
          ...(category.prestations ?? []).flatMap((prestation) => [
            prestation.nom,
            prestation.description,
          ]),
        ]
          .filter(Boolean)
          .join(' '),
      );
      const normalizedCategoryName = normalizeSearchText(category.nom);
      const reasons = new Set<string>();
      let score = 0;

      for (const term of projectTerms) {
        if (!term || haystack.length === 0) continue;
        if (normalizedCategoryName.includes(term)) {
          score += term.includes(' ') ? 7 : 4;
          reasons.add(term);
          continue;
        }
        if (haystack.includes(term)) {
          score += term.includes(' ') ? 4 : 2;
          reasons.add(term);
        }
      }

      return {
        category,
        score,
        reasons: Array.from(reasons),
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.category.nom.localeCompare(right.category.nom));
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'CHOIX_UNIQUE': return <CircleDot size={12} />;
    case 'CHOIX_MULTIPLE': return <ListChecks size={12} />;
    case 'TEXTE': return <MessageSquare size={12} />;
    case 'NOMBRE': return <Hash size={12} />;
    case 'BOOLEEN': return <ToggleLeft size={12} />;
    case 'PHOTO': return <Camera size={12} />;
    default: return <HelpCircle size={12} />;
  }
}

function getInfoIcon(type: string) {
  switch (type) {
    case 'MESURE': return <Ruler size={12} className="text-violet-500" />;
    case 'PHOTO': return <Camera size={12} className="text-pink-500" />;
    case 'OBSERVATION': return <Eye size={12} className="text-sky-500" />;
    case 'CHOIX': return <ListChecks size={12} className="text-amber-500" />;
    default: return <HelpCircle size={12} />;
  }
}

function calcCompositionsCostPerUnit(compositions: Prestation['compositions'] = []) {
  return compositions.reduce((sum, comp) => {
    let lineCost = 0;
    if (comp.materiau) lineCost += comp.quantiteParUnite * comp.materiau.prixAchatFixe;
    if (comp.serviceMainOeuvre) lineCost += comp.quantiteParUnite * comp.serviceMainOeuvre.prixUnitaire;
    return sum + lineCost;
  }, 0);
}

function resolveChoiceImpact(presta: Prestation, choix: OptionPrestation['choix'][number]) {
  const explicitImpact = choix.impactPrix ?? 0;
  if (explicitImpact !== 0) return explicitImpact;

  if ((choix.compositions?.length ?? 0) === 0) return 0;

  const baseCostPerUnit = calcCompositionsCostPerUnit(presta.compositions ?? []);
  const choiceCostPerUnit = calcCompositionsCostPerUnit(choix.compositions ?? []);

  return r2(choiceCostPerUnit - baseCostPerUnit);
}

export default function TechnicoChecklist() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const demandeIdParam = searchParams.get('demandeId');
  const devisIdParam = searchParams.get('devisId');
  const demandeId =
    demandeIdParam && Number.isFinite(Number(demandeIdParam)) && Number(demandeIdParam) > 0
      ? Number(demandeIdParam)
      : null;
  const devisIdFromQuery =
    devisIdParam && Number.isFinite(Number(devisIdParam)) && Number(devisIdParam) > 0
      ? Number(devisIdParam)
      : null;
  const devisListPath = location.pathname.startsWith('/admin/') ? '/admin/devis' : '/technico/devis';

  // ÔöÇÔöÇ State principal ÔöÇÔöÇ
  const [step, setStep] = useState<Step>('categories');
  const [selectedDevisId, setSelectedDevisId] = useState<number | null>(devisIdFromQuery);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedSousCatId, setSelectedSousCatId] = useState<number | 'direct' | null>(null);
  const [checkedItems, setCheckedItems] = useState<Map<number, ChecklistItem>>(new Map());
  const [expandedDetail, setExpandedDetail] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showDevisPreview, setShowDevisPreview] = useState(false);
  const [fullCatalogueDemandeId, setFullCatalogueDemandeId] = useState<number | null>(null);
  const [questionResponses, setQuestionResponses] = useState<Map<number, string | string[] | boolean>>(new Map());
  const showFullCatalogue = demandeId !== null && fullCatalogueDemandeId === demandeId;

  // ÔöÇÔöÇ Queries ÔöÇÔöÇ
  const { data: devisData } = useQuery({
    queryKey: ['technico-devis-brouillon'],
    queryFn: async () => {
      const res = await api.get('/devis', { params: { statut: 'BROUILLON', limit: 100 } });
      return (res.data?.data ?? []) as Devis[];
    },
  });

  const {
    data: demandeContext,
    isLoading: loadingDemandeContext,
  } = useQuery({
    queryKey: ['technico-checklist-demande', demandeId],
    enabled: demandeId !== null,
    queryFn: async () => {
      const res = await api.get(`/demandes-devis/${demandeId}`);
      return res.data as DemandeChecklistContext;
    },
  });

  const {
    data: clientContext,
    isLoading: loadingClientContext,
  } = useQuery({
    queryKey: ['technico-checklist-client', demandeContext?.clientId],
    enabled: Boolean(demandeContext?.clientId),
    queryFn: async () => {
      const res = await api.get(`/clients/${demandeContext?.clientId}`);
      return res.data as Client;
    },
  });

  const { data: catalogue, isLoading: loadingCatalogue } = useQuery({
    queryKey: ['catalogue-complet-checklist'],
    queryFn: async () => {
      const res = await api.get('/prestations/catalogue-complet');
      return res.data as CatalogueCategorieWithCompositions[];
    },
  });

  const linkedDevisFromDemande = useMemo(() => {
    return (
      demandeContext?.devis?.find((devis) => devis.statut === 'BROUILLON' || devis.statut === 'REVISE') ??
      null
    );
  }, [demandeContext]);

  const targetedDevisFromDemande = useMemo(() => {
    if (!demandeContext) return null;

    if (devisIdFromQuery) {
      const matchingDevis = demandeContext.devis?.find(
        (devis) =>
          devis.id === devisIdFromQuery &&
          (devis.statut === 'BROUILLON' || devis.statut === 'REVISE'),
      );

      if (matchingDevis) return matchingDevis;
    }

    return linkedDevisFromDemande;
  }, [demandeContext, devisIdFromQuery, linkedDevisFromDemande]);

  const availableDraftDevis = useMemo(() => {
    if (!linkedDevisFromDemande) return devisData ?? [];
    return (devisData ?? []).some((devis) => devis.id === linkedDevisFromDemande.id)
      ? devisData ?? []
      : [linkedDevisFromDemande, ...(devisData ?? [])];
  }, [devisData, linkedDevisFromDemande]);

  async function refreshDevisQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['technico-devis'],
        refetchType: 'all',
      }),
      queryClient.invalidateQueries({
        queryKey: ['technico-devis-brouillon'],
        refetchType: 'all',
      }),
      queryClient.invalidateQueries({
        queryKey: ['devis'],
        refetchType: 'all',
      }),
    ]);
  }

  async function createDraftForDemande(context: DemandeChecklistContext) {
    const res = await api.post('/devis', {
      clientId: context.clientId,
      demandeDevisId: context.id,
      notes: `Créé depuis la demande #${context.id} - ${context.description}`,
    });

    await refreshDevisQueries();
    await queryClient.invalidateQueries({
      queryKey: ['technico-checklist-demande', context.id],
      refetchType: 'all',
    });

    return res.data as Devis;
  }

  //logique de changement de statut après génération du devis pour la demande
  async function convertDemandeAfterQuoteGeneration() {
    if (!demandeContext) return;

    let currentStatut = demandeContext.statut as string;

    if (currentStatut === 'NOUVEAU') {
      await api.patch(`/demandes-devis/${demandeContext.id}/statut`, { statut: 'EN_COURS' });
      currentStatut = 'EN_COURS';
    }

    if (currentStatut === 'EN_COURS' || currentStatut === 'QUALIFIE') {
      await api.patch(`/demandes-devis/${demandeContext.id}/statut`, { statut: 'CONVERTI' });
    }
  }

  function resetStudyAfterSubmit() {
    setSubmitted(false);
    setStep('categories');
    setCheckedItems(new Map());
    setQuestionResponses(new Map());
    setSelectedCatId(null);
    setSelectedSousCatId(null);
    setExpandedDetail(null);
    setSearchQuery('');
  }

  const effectiveSelectedDevisId = demandeContext
    ? targetedDevisFromDemande?.id ?? null
    : selectedDevisId ?? devisIdFromQuery;

  // ÔöÇÔöÇ Mutation submit ÔöÇÔöÇ
  const submitMutation = useMutation({
    mutationFn: async () => {
      let devisId = effectiveSelectedDevisId;

      if (!devisId && demandeContext) {
        const refreshedDemande = await queryClient.fetchQuery({
          queryKey: ['technico-checklist-demande', demandeContext.id],
          queryFn: async () => {
            const res = await api.get(`/demandes-devis/${demandeContext.id}`);
            return res.data as DemandeChecklistContext;
          },
        });

        const existingDraft = refreshedDemande?.devis?.find(
          (devis) => devis.statut === 'BROUILLON' || devis.statut === 'REVISE',
        );
        devisId = existingDraft?.id ?? null;
      }

      if (!devisId && demandeContext) {
        const createdDraft = await createDraftForDemande(demandeContext);
        devisId = createdDraft.id;
      }
      if (!devisId) throw new Error('Sélectionnez un devis');
      const items = Array.from(checkedItems.values()).map(ci => ({
        prestationId: ci.prestationId,
        quantite: ci.quantite,
        selectedOptions: Array.from(ci.selectedOptions.entries()).map(([optionId, choixOptionIds]) => ({
          optionId,
          choixOptionIds,
        })),
      }));
      if (items.length === 0) throw new Error('Cochez au moins une prestation');
      const res = await api.post(`/devis/${devisId}/lignes/checklist`, { items });
      return { payload: res.data, devisId };
    },
    //Soumission et redirection vers l'éditeur de devis
    onSuccess: async () => {
      await refreshDevisQueries();
      if (demandeContext) {
        await convertDemandeAfterQuoteGeneration();
        await queryClient.invalidateQueries({ queryKey: ['technico-demandes'] });
        await queryClient.invalidateQueries({ queryKey: ['demandes-devis'] });
        await queryClient.invalidateQueries({
          queryKey: ['technico-checklist-demande', demandeContext.id],
          refetchType: 'all',
        });
      }
      // Redirection vers l'éditeur de devis
      setSubmitted(true);
      setCheckedItems(new Map());
      setQuestionResponses(new Map());
      setSelectedCatId(null);
      setSelectedSousCatId(null);
      setExpandedDetail(null);
      setSearchQuery('');
      setShowDevisPreview(false);
    },
  });

  const selectedProjectTypes = useMemo(
    () => getClientProjectTypes(clientContext),
    [clientContext],
  );

  const projectTypeLabel = useMemo(
    () => selectedProjectTypes.map((projectType) => projectType.nom).filter(Boolean).join(' / '),
    [selectedProjectTypes],
  );

  const projectNameTerms = useMemo(() => {
    const terms = new Set<string>();

    for (const projectType of selectedProjectTypes) {
      const normalizedProjectName = normalizeSearchText(projectType.nom);
      if (!normalizedProjectName) continue;

      terms.add(normalizedProjectName);
      for (const token of splitTerms(projectType.nom)) {
        terms.add(token);
      }
    }

    return Array.from(terms).sort((left, right) => right.length - left.length);
  }, [selectedProjectTypes]);

  const projectCategoryMatches = useMemo(
    () => matchCategoriesToProject(catalogue ?? [], projectNameTerms),
    [catalogue, projectNameTerms],
  );

  const mappedProjectCategories = useMemo(() => {
    const mappedCategoryIds = new Set<number>();

    for (const projectType of selectedProjectTypes) {
      for (const category of projectType.categories ?? []) {
        if (typeof category.categorieId === 'number') {
          mappedCategoryIds.add(category.categorieId);
        }
      }
    }

    if (mappedCategoryIds.size === 0) return [];

    return (catalogue ?? []).filter((category) => mappedCategoryIds.has(category.id));
  }, [catalogue, selectedProjectTypes]);

  const projectNameCategories = useMemo(() => {
    if (mappedProjectCategories.length > 0) return [];
    return projectCategoryMatches.map((match) => match.category);
  }, [mappedProjectCategories.length, projectCategoryMatches]);

  const projectCategorySource = useMemo(() => {
    if (mappedProjectCategories.length > 0) {
      return { kind: 'mapped' as const, categories: mappedProjectCategories };
    }
    if (projectNameCategories.length > 0) {
      return { kind: 'projectName' as const, categories: projectNameCategories };
    }
    return { kind: 'none' as const, categories: [] as CatalogueCategorieWithCompositions[] };
  }, [mappedProjectCategories, projectNameCategories]);

  const usesMappedProjectCategories = projectCategorySource.kind === 'mapped';
  const filteredProjectCategoryCount = projectCategorySource.categories.length;

  const activeProjectMatches =
    Boolean(demandeContext) &&
    !showFullCatalogue &&
    filteredProjectCategoryCount > 0;

  const projectFilterReasons = useMemo(
    () => projectCategorySource.categories.map((category) => category.nom).slice(0, 4),
    [projectCategorySource],
  );

  // ÔöÇÔöÇ Catégorie courante ÔöÇÔöÇ
  const currentCat = useMemo(
    () => catalogue?.find((c) => c.id === selectedCatId) ?? null,
    [catalogue, selectedCatId],
  );

  const currentSousCat = useMemo(
    () => currentCat?.sousCategories?.find((sc) => sc.id === selectedSousCatId) ?? null,
    [currentCat, selectedSousCatId],
  );

  const currentScopePrestas = useMemo(() => {
    if (!currentCat) return [];
    if (selectedSousCatId === 'direct') return currentCat.prestations ?? [];
    if (selectedSousCatId) return currentSousCat?.prestations ?? [];
    return allPrestationsInCat(currentCat);
  }, [currentCat, currentSousCat, selectedSousCatId]);

  const clarificationQuestions = useMemo(() => {
    if (!currentCat) return [];
    const catQuestions = currentCat.questionsDiagnostic ?? [];
    const scQuestions = currentSousCat?.questionsDiagnostic ?? [];
    return [...catQuestions, ...scQuestions];
  }, [currentCat, currentSousCat]);

  const missingRequiredOptions = useMemo(() => {
    const missing: { presta: Prestation; option: OptionPrestation }[] = [];
    for (const [prestationId, item] of checkedItems) {
      const presta = findPresta(catalogue ?? [], prestationId);
      if (!presta) continue;
      for (const option of presta.options ?? []) {
        if (!option.obligatoire) continue;
        const selected = item.selectedOptions.get(option.id) ?? [];
        if (selected.length === 0) {
          missing.push({ presta, option });
        }
      }
    }
    return missing;
  }, [checkedItems, catalogue]);

  // ÔöÇÔöÇ Actions : items ÔöÇÔöÇ
  const toggleItem = useCallback((prestationId: number) => {
    setCheckedItems((prev) => {
      const next = new Map(prev);
      if (next.has(prestationId)) {
        next.delete(prestationId);
      } else {
        next.set(prestationId, {
          prestationId,
          quantite: 1,
          selectedOptions: new Map(),
          reponsesDiag: new Map(),
          infosValues: new Map(),
        });
      }
      return next;
    });
  }, []);

  const updateQuantite = useCallback((prestationId: number, quantite: number) => {
    if (quantite < 0.01) return;
    setCheckedItems((prev) => {
      const next = new Map(prev);
      const item = next.get(prestationId);
      if (item) next.set(prestationId, { ...item, quantite });
      return next;
    });
  }, []);

  const toggleChoix = useCallback((prestationId: number, optionId: number, choixId: number, multi: boolean) => {
    setCheckedItems((prev) => {
      const next = new Map(prev);
      const item = next.get(prestationId);
      if (!item) return prev;
      const opts = new Map(item.selectedOptions);
      const current = opts.get(optionId) ?? [];
      if (multi) {
        opts.set(optionId, current.includes(choixId) ? current.filter(c => c !== choixId) : [...current, choixId]);
      } else {
        opts.set(optionId, current.includes(choixId) ? [] : [choixId]);
      }
      next.set(prestationId, { ...item, selectedOptions: opts });
      return next;
    });
  }, []);

  const setInfoValue = useCallback((prestationId: number, nom: string, value: string) => {
    setCheckedItems((prev) => {
      const next = new Map(prev);
      const item = next.get(prestationId);
      if (!item) return prev;
      const infos = new Map(item.infosValues);
      infos.set(nom, value);
      next.set(prestationId, { ...item, infosValues: infos });
      return next;
    });
  }, []);

  // ÔöÇÔöÇ Réponses aux questions diagnostiques ÔöÇÔöÇ
  const setQuestionResponse = useCallback((qId: number, value: string | string[] | boolean) => {
    setQuestionResponses(prev => {
      const next = new Map(prev);
      next.set(qId, value);
      return next;
    });
  }, []);

  const toggleQuestionChoice = useCallback((qId: number, choice: string, multi: boolean) => {
    setQuestionResponses(prev => {
      const next = new Map(prev);
      if (multi) {
        const current = (next.get(qId) as string[]) ?? [];
        next.set(qId, current.includes(choice) ? current.filter(c => c !== choice) : [...current, choice]);
      } else {
        next.set(qId, next.get(qId) === choice ? '' : choice);
      }
      return next;
    });
  }, []);

  // ÔöÇÔöÇ Calcul impact des réponses aux questions ÔöÇÔöÇ
  const calcImpactQuestions = useCallback(() => {
    let impactTotal = 0;
    for (const q of clarificationQuestions) {
      const response = questionResponses.get(q.id);
      if (!response) continue;

      // Support pour choix structurés avec impactPrix
      const choices = (q.choixPossibles ?? []) as QuestionChoice[];
      if (Array.isArray(choices)) {
        for (const choiceItem of choices) {
          // Support deux formats: string simple ou {nom, impactPrix}
          let choiceName = '';
          let impactPrix = 0;
          
          if (typeof choiceItem === 'string') {
            choiceName = choiceItem;
          } else if (choiceItem && typeof choiceItem === 'object' && 'nom' in choiceItem) {
            choiceName = choiceItem.nom;
            impactPrix = choiceItem.impactPrix ?? 0;
          }

          // Vérifier si c'est la réponse sélectionnée
          if (typeof response === 'string' && response === choiceName) {
            impactTotal += impactPrix;
          } else if (Array.isArray(response) && response.includes(choiceName)) {
            impactTotal += impactPrix;
          }
        }
      }
    }
    return impactTotal;
  }, [clarificationQuestions, questionResponses]);

  // ÔöÇÔöÇ Obtenir compositions basées sur les choix sélectionnés ÔöÇÔöÇ
  const getCompositionsForItem = useCallback((presta: Prestation, item: ChecklistItem) => {
    // Collecter toutes les compositions des choix sélectionnés
    const choixCompositions: NonNullable<Prestation['compositions']> = [];
    for (const [optionId, choixIds] of item.selectedOptions) {
      const option = presta.options?.find(o => o.id === optionId);
      if (!option) continue;
      for (const cId of choixIds) {
        const choix = option.choix?.find(c => c.id === cId);
        if (choix?.compositions?.length) {
          choixCompositions.push(...(choix.compositions ?? []));
        }
      }
    }
    
    // Si des choix ont des compositions spécifiques, les retourner
    if (choixCompositions.length > 0) {
      return choixCompositions;
    }
    
    // Sinon, retourner les compositions par défaut de la prestation
    return presta.compositions ?? [];
  }, []);

  // ÔöÇÔöÇ Calcul prix avec impact options ÔöÇÔöÇ
  const calcPrixPresta = useCallback((presta: Prestation, item: ChecklistItem): PricingResult => {
    let optionImpactParUnite = 0;
    let minImpactPossible = 0;
    let maxImpactPossible = 0;

    for (const option of presta.options ?? []) {
      const activeChoices = (option.choix ?? []).filter((c) => c.actif);
      const selectedChoixIds = item.selectedOptions.get(option.id) ?? [];

      if (selectedChoixIds.length > 0) {
        const selectedImpact = selectedChoixIds.reduce((sum, choixId) => {
          const choix = activeChoices.find((c) => c.id === choixId);
          if (!choix) return sum;
          return sum + resolveChoiceImpact(presta, choix);
        }, 0);

        optionImpactParUnite += selectedImpact;
        minImpactPossible += selectedImpact;
        maxImpactPossible += selectedImpact;
        continue;
      }

      if (activeChoices.length === 0) continue;

      const computedImpacts = activeChoices.map((c) => resolveChoiceImpact(presta, c));
      const minImpact = Math.min(...computedImpacts);
      const maxImpact = Math.max(...computedImpacts);

      if (option.obligatoire) {
        // Option obligatoire non choisie: on garde toutes les possibilités de ses choix.
        minImpactPossible += minImpact;
        maxImpactPossible += maxImpact;
      } else {
        // Option facultative non choisie: inclure aussi la possibilité de ne rien ajouter (0).
        minImpactPossible += Math.min(0, minImpact);
        maxImpactPossible += Math.max(0, maxImpact);
      }
    }

    const prixVente = (presta.prixVenteMin + minImpactPossible + presta.prixVenteMax + maxImpactPossible) / 2;
    const minUnitPrice = presta.prixVenteMin + minImpactPossible;
    const maxUnitPrice = presta.prixVenteMax + maxImpactPossible;
    const compositionsActives = getCompositionsForItem(presta, item);
    const coutParUnite = calcCompositionsCostPerUnit(compositionsActives);

    return { prixVente, coutParUnite, optionImpactParUnite, minUnitPrice, maxUnitPrice };
  }, [getCompositionsForItem]);

  // ÔöÇÔöÇ Totaux live ÔöÇÔöÇ
  const selectedDevisTauxTVA =
    availableDraftDevis.find((devis) => devis.id === effectiveSelectedDevisId)?.tauxTVA ?? 20;

  const totaux = useMemo(() => {
    let totalVenteHT = 0;
    let totalVenteHTMin = 0;
    let totalVenteHTMax = 0;
    let totalCout = 0;
    const questionImpact = calcImpactQuestions();
    
    for (const [prestationId, item] of checkedItems) {
      const presta = findPresta(catalogue ?? [], prestationId);
      if (!presta) continue;
      const { prixVente, coutParUnite, minUnitPrice, maxUnitPrice } = calcPrixPresta(presta, item);
      // Ajouter l'impact des questions à chaque prestation de cette catégorie/sous-cat
      const prixAvecImpact = prixVente + (questionImpact / Math.max(checkedItems.size, 1));
      const prixMinAvecImpact = minUnitPrice + (questionImpact / Math.max(checkedItems.size, 1));
      const prixMaxAvecImpact = maxUnitPrice + (questionImpact / Math.max(checkedItems.size, 1));
      totalVenteHT += item.quantite * prixAvecImpact;
      totalVenteHTMin += item.quantite * prixMinAvecImpact;
      totalVenteHTMax += item.quantite * prixMaxAvecImpact;
      totalCout += item.quantite * coutParUnite;
    }
    const profit = totalVenteHT - totalCout;
    const marge = totalVenteHT > 0 ? (profit / totalVenteHT) * 100 : 0;
    const totalTVA = totalVenteHT * (selectedDevisTauxTVA / 100);
    const totalTTC = totalVenteHT + totalTVA;
    return {
      totalVenteHT: r2(totalVenteHT),
      totalVenteHTMin: r2(totalVenteHTMin),
      totalVenteHTMax: r2(totalVenteHTMax),
      totalCout: r2(totalCout),
      profit: r2(profit), marge: Math.round(marge * 10) / 10,
      totalTVA: r2(totalTVA), totalTTC: r2(totalTTC),
      questionImpact: r2(questionImpact),
    };
  }, [checkedItems, catalogue, calcPrixPresta, calcImpactQuestions, selectedDevisTauxTVA]);

  const checkedCount = checkedItems.size;
  const canSubmitChecklist =
    checkedCount > 0 && (Boolean(effectiveSelectedDevisId) || Boolean(demandeContext));

  const selectedDevis = useMemo(
    () => availableDraftDevis.find((devis) => devis.id === effectiveSelectedDevisId) ?? null,
    [availableDraftDevis, effectiveSelectedDevisId],
  );

  const previewDevis = useMemo(() => {
    if (!effectiveSelectedDevisId || checkedItems.size === 0) return null;

    const questionImpactShare = (totaux.questionImpact ?? 0) / Math.max(checkedItems.size, 1);

    const lignes = Array.from(checkedItems.entries())
      .map(([prestationId, item], index) => {
        const presta = findPresta(catalogue ?? [], prestationId);
        if (!presta) return null;

        const { prixVente, coutParUnite } = calcPrixPresta(presta, item);
        const unitPrice = r2(prixVente + questionImpactShare);
        const compositions = getCompositionsForItem(presta, item);
        const materiauPrincipal = compositions.find((composition) => composition.materiau)?.materiau;
        const servicePrincipal = compositions.find(
          (composition) => composition.serviceMainOeuvre,
        )?.serviceMainOeuvre;

        const optionLabels = Array.from(item.selectedOptions.entries()).flatMap(
          ([optionId, choixIds]) => {
            const option = presta.options?.find((currentOption) => currentOption.id === optionId);

            return choixIds
              .map((choixId) => option?.choix?.find((choix) => choix.id === choixId))
              .filter(Boolean)
              .map((choix) => `${option?.nom}: ${choix?.nom}`);
          },
        );

        const infoLabels = Array.from(item.infosValues.entries())
          .filter(([, value]) => value.trim().length > 0)
          .map(([name, value]) => `${name}: ${value}`);

        return {
          id: index + 1,
          devisId: effectiveSelectedDevisId,
          prestationId: presta.id,
          description: [presta.nom, ...optionLabels, ...infoLabels].join(' / '),
          quantite: item.quantite,
          unite: presta.unite,
          prixUnitaireVente: unitPrice,
          prixAchat: r2(coutParUnite),
          totalHT: r2(item.quantite * unitPrice),
          coutTotal: r2(item.quantite * coutParUnite),
          ordre: index + 1,
          materiau: materiauPrincipal
            ? { id: materiauPrincipal.id, nom: materiauPrincipal.nom }
            : undefined,
          serviceMainOeuvre: servicePrincipal
            ? { id: servicePrincipal.id, nom: servicePrincipal.nom }
            : undefined,
        };
      })
      .filter(Boolean);

    return {
      id: effectiveSelectedDevisId,
      clientId: selectedDevis?.clientId ?? 0,
      reference: selectedDevis?.reference ?? 'DEV-APERCU',
      statut: selectedDevis?.statut ?? 'BROUILLON',
      totalHT: totaux.totalVenteHT,
      totalTVA: totaux.totalTVA,
      totalTTC: totaux.totalTTC,
      tauxTVA: selectedDevisTauxTVA,
      notes: 'Apercu avant enregistrement des lignes.',
      createdAt: selectedDevis?.createdAt ?? new Date().toISOString(),
      client: selectedDevis?.client,
      lignes,
    } as Devis;
  }, [
    effectiveSelectedDevisId,
    checkedItems,
    selectedDevis,
    totaux,
    catalogue,
    calcPrixPresta,
    getCompositionsForItem,
    selectedDevisTauxTVA,
  ]);

  // ÔöÇÔöÇ Filtrage catégories ÔöÇÔöÇ
  const baseCatalogue = useMemo(
    () => (activeProjectMatches ? projectCategorySource.categories : catalogue ?? []),
    [activeProjectMatches, catalogue, projectCategorySource],
  );

  const filteredCatalogue = useMemo(() => {
    if (!searchQuery.trim()) return baseCatalogue;

    const q = normalizeSearchText(searchQuery);

    return baseCatalogue.filter((category) => {
      const categoryText = normalizeSearchText(category.nom);
      const prestationText = allPrestationsInCat(category)
        .map((prestation) => normalizeSearchText(prestation.nom))
        .join(' ');

      return categoryText.includes(q) || prestationText.includes(q);
    });
  }, [baseCatalogue, searchQuery]);

  const selectedDevisCard = demandeContext ? (
    <LinkedDevisCard
      demande={demandeContext}
      client={clientContext ?? selectedDevis?.client}
      projectTypeLabel={projectTypeLabel}
      selectedDevis={selectedDevis}
      isLoading={loadingDemandeContext || loadingClientContext}
    />
  ) : (
    <DevisSelector
      devisData={availableDraftDevis}
      selectedDevisId={selectedDevisId}
      setSelectedDevisId={setSelectedDevisId}
    />
  );

  // ÔöÇÔöÇ RENDER : STEP CATEGORIES ÔöÇÔöÇ
  if (step === 'categories') {
    return (
      <div className="space-y-6">
        <Header />
        <StudyContextBanner
          demande={demandeContext}
          client={clientContext}
          projectTypeLabel={projectTypeLabel}
          projectTypeCount={selectedProjectTypes.length}
          activeProjectMatches={activeProjectMatches}
          usesMappedProjectCategories={usesMappedProjectCategories}
          matchedCount={filteredProjectCategoryCount}
          reasons={projectFilterReasons}
          showFullCatalogue={showFullCatalogue}
          onToggleCatalogue={() =>
            setFullCatalogueDemandeId((current) => (current === demandeId ? null : demandeId))
          }
        />
        {selectedDevisCard}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            {activeProjectMatches && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {filteredProjectCategoryCount} categorie
                {filteredProjectCategoryCount > 1 ? 's' : ''}{' '}
                {usesMappedProjectCategories ? 'configuree' : 'proposee'}
                {filteredProjectCategoryCount > 1 ? 's' : ''}{' '}
                selon {selectedProjectTypes.length > 1 ? 'les types de projet' : 'le type de projet'}{' '}
                <span className="font-semibold">{projectTypeLabel || 'selectionne'}</span>.
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une catégorie ou prestation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#9683EC] focus:ring-2 focus:ring-[#CCCCFF]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>

            {loadingCatalogue ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#5A4FCF]" size={32} /></div>
            ) : filteredCatalogue.length === 0 ? (
              <div className="rounded-2xl border border-amber-100 bg-white px-5 py-8 text-center shadow-sm">
                <p className="text-sm font-semibold text-gray-900">Aucune categorie ne correspond</p>
                <p className="mt-1 text-sm text-gray-500">
                  Essaie une autre recherche ou affiche tout le catalogue.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCatalogue.map((cat) => {
                  const allPrestas = allPrestationsInCat(cat);
                  const checkedInCat = allPrestas.filter(p => checkedItems.has(p.id)).length;
                  const nbQuestions = cat.questionsDiagnostic?.length ?? 0;
                  const nbSousCat = cat.sousCategories?.length ?? 0;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCatId(cat.id);
                        setSelectedSousCatId(null);
                        setStep('sous-categories');
                      }}
                      className={cn(
                        'bg-white rounded-2xl border shadow-sm p-5 text-left hover:shadow-md hover:border-[#CCCCFF] transition-all group',
                        checkedInCat > 0 ? 'border-[#5A4FCF] bg-[#CCCCFF]/30' : 'border-gray-100',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#9683EC] transition">{cat.nom}</h3>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-[#5A4FCF] transition mt-0.5" />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {nbSousCat > 0 && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{nbSousCat} sous-cat.</span>}
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{allPrestas.length} prestations</span>
                        {nbQuestions > 0 && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{nbQuestions} questions</span>}
                      </div>
                      {checkedInCat > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <CheckCircle size={12} className="text-[#5A4FCF]" />
                          <span className="text-xs font-semibold text-[#9683EC]">{checkedInCat} sélectionnée{checkedInCat > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <RecapSidebar
            checkedItems={checkedItems}
            catalogue={catalogue ?? []}
            totaux={totaux}
            checkedCount={checkedCount}
            calcPrixPresta={calcPrixPresta}
            selectedDevisId={effectiveSelectedDevisId}
            submitted={submitted}
            submitMutation={submitMutation}
            onViewRecap={() => setStep('recap')}
          />
        </div>
      </div>
    );
  }

  // ÔöÇÔöÇ RENDER : STEP SOUS-CATEGORIES ÔöÇÔöÇ
  if (step === 'sous-categories' && currentCat) {
    const sousCategories = currentCat.sousCategories ?? [];
    const directPrestas = currentCat.prestations ?? [];

    return (
      <div className="space-y-6">
        <StepHeader
          title={currentCat.nom}
          subtitle="Choisissez une sous-catégorie pour continuer"
          onBack={() => setStep('categories')}
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sousCategories.map((sc) => {
                const nbQuestions = sc.questionsDiagnostic?.length ?? 0;
                const checkedInSc = (sc.prestations ?? []).filter((p) => checkedItems.has(p.id)).length;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedSousCatId(sc.id);
                      setStep('prestations');
                    }}
                    className={cn(
                      'bg-white rounded-2xl border shadow-sm p-5 text-left hover:shadow-md hover:border-[#CCCCFF] transition-all group',
                      checkedInSc > 0 ? 'border-[#5A4FCF] bg-[#CCCCFF]/30' : 'border-gray-100',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#9683EC] transition">{sc.nom}</h3>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-[#5A4FCF] transition mt-0.5" />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{(sc.prestations ?? []).length} prestations</span>
                      {nbQuestions > 0 && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{nbQuestions} questions</span>}
                    </div>
                  </button>
                );
              })}

              {directPrestas.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedSousCatId('direct');
                    setStep('prestations');
                  }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md hover:border-[#CCCCFF] transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#9683EC] transition">Prestations générales</h3>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-[#5A4FCF] transition mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{directPrestas.length} prestations</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          <RecapSidebar
            checkedItems={checkedItems}
            catalogue={catalogue ?? []}
            totaux={totaux}
            checkedCount={checkedCount}
            calcPrixPresta={calcPrixPresta}
            selectedDevisId={effectiveSelectedDevisId}
            submitted={submitted}
            submitMutation={submitMutation}
            onViewRecap={() => setStep('recap')}
          />
        </div>
      </div>
    );
  }

  // ÔöÇÔöÇ RENDER : STEP PRESTATIONS ÔöÇÔöÇ
  if (step === 'prestations' && currentCat) {
    const titleSuffix = selectedSousCatId === 'direct' ? 'Prestations générales' : (currentSousCat?.nom ?? currentCat.nom);

    return (
      <div className="space-y-6">
        <StepHeader
          title={`${currentCat.nom} • ${titleSuffix}`}
          subtitle="Choix de prestation, détails techniques et options de prix"
          onBack={() => setStep('sous-categories')}
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            {currentScopePrestas.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-6">Aucune prestation dans ce niveau.</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                {currentScopePrestas.map((presta) => (
                  <PrestationRow
                    key={presta.id}
                    presta={presta}
                    checkedItems={checkedItems}
                    expandedDetail={expandedDetail}
                    setExpandedDetail={setExpandedDetail}
                    toggleItem={toggleItem}
                    updateQuantite={updateQuantite}
                    toggleChoix={toggleChoix}
                    setInfoValue={setInfoValue}
                    calcPrixPresta={calcPrixPresta}
                    getCompositionsForItem={getCompositionsForItem}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('sous-categories')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                <Layers size={16} />
                Changer de sous-catégorie
              </button>
            </div>
          </div>

          <RecapSidebar
            checkedItems={checkedItems}
            catalogue={catalogue ?? []}
            totaux={totaux}
            checkedCount={checkedCount}
            calcPrixPresta={calcPrixPresta}
            selectedDevisId={effectiveSelectedDevisId}
            submitted={submitted}
            submitMutation={submitMutation}
            onViewRecap={() => setStep('recap')}
          />
        </div>
      </div>
    );
  }

  // ÔöÇÔöÇ RENDER : STEP CLARIFICATION ÔöÇÔöÇ
  if (step === 'clarification' && currentCat) {
    return (
      <div className="space-y-6">
        <StepHeader
          title={`${currentCat.nom} • Clarification`}
          subtitle="Questions guidées pour lever les choix flous avant le devis"
          onBack={() => setStep('prestations')}
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            {missingRequiredOptions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">Choix flous détectés: options obligatoires non renseignées</p>
                {missingRequiredOptions.map(({ presta, option }) => (
                  <div key={`${presta.id}-${option.id}`} className="bg-white border border-amber-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-800">{presta.nom}</p>
                    <p className="text-xs text-gray-500 mb-2">Sélectionnez une réponse guidée pour « {option.nom} »</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(option.choix ?? []).filter(c => c.actif).map((choix) => (
                        <button
                          key={choix.id}
                          onClick={() => {
                            if (!checkedItems.has(presta.id)) return;
                            toggleChoix(presta.id, option.id, choix.id, false);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border transition bg-white text-gray-700 border-gray-200 hover:border-[#5A4FCF]"
                        >
                          {choix.nom}
                          {choix.impactPrix !== 0 && (
                            <span className="ml-1 text-gray-400">{choix.impactPrix > 0 ? '+' : ''}{choix.impactPrix}€</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {clarificationQuestions.length === 0 ? (
              <p className="text-sm text-gray-400 italic p-6">Aucune question de clarification à ce niveau.</p>
            ) : (
              clarificationQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  value={questionResponses.get(q.id)}
                  onChange={(v) => setQuestionResponse(q.id, v)}
                  onToggleChoice={(choice, multi) => toggleQuestionChoice(q.id, choice, multi)}
                />
              ))
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('prestations')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                <ChevronRight size={16} className="rotate-180" />
                Retour aux détails
              </button>
              <button
                onClick={() => setStep('recap')}
                className="flex-1 py-3 technico-gradient text-white rounded-2xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                Afficher le devis
              </button>
            </div>
          </div>

          <RecapSidebar
            checkedItems={checkedItems}
            catalogue={catalogue ?? []}
            totaux={totaux}
            checkedCount={checkedCount}
            calcPrixPresta={calcPrixPresta}
            selectedDevisId={effectiveSelectedDevisId}
            submitted={submitted}
            submitMutation={submitMutation}
            onViewRecap={() => setStep('recap')}
          />
        </div>
      </div>
    );
  }

  // ÔöÇÔöÇ RENDER : STEP RECAP ÔöÇÔöÇ
  return (
    <div className="space-y-6">
      <StepHeader
        title="Devis professionnel"
        subtitle={`${checkedCount} prestation${checkedCount > 1 ? 's' : ''} — Montant TTC : ${formatCurrency(totaux.totalTTC)}`}
        onBack={() => setStep('categories')}
      />

      <StudyContextBanner
        demande={demandeContext}
        client={clientContext}
        projectTypeLabel={projectTypeLabel}
        projectTypeCount={selectedProjectTypes.length}
        activeProjectMatches={activeProjectMatches}
        usesMappedProjectCategories={usesMappedProjectCategories}
        matchedCount={filteredProjectCategoryCount}
        reasons={projectFilterReasons}
        showFullCatalogue={showFullCatalogue}
        onToggleCatalogue={() =>
          setFullCatalogueDemandeId((current) => (current === demandeId ? null : demandeId))
        }
      />
      {selectedDevisCard}

      {checkedCount === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">Aucune prestation sélectionnée</p>
          <button onClick={() => setStep('categories')} className="mt-3 text-[#5A4FCF] text-sm font-semibold hover:underline">
            Parcourir le catalogue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ÔöÇÔöÇ CONTENU PRINCIPAL : LIGNES DEVIS ÔöÇÔöÇ */}
          <div className="xl:col-span-2 space-y-4">
            {/* Entête tableau */}
            <div className="technico-gradient rounded-2xl p-4 text-white hidden md:block">
              <div className="grid grid-cols-12 gap-3 text-xs font-semibold">
                <div className="col-span-4">Prestation</div>
                <div className="col-span-2">Qté</div>
                <div className="col-span-3">Prix/unité</div>
                <div className="col-span-3 text-right">Total</div>
              </div>
            </div>

            {/* Lignes devis */}
            {Array.from(checkedItems.entries()).map(([prestationId, item]) => {
              const presta = findPresta(catalogue ?? [], prestationId);
              if (!presta) return null;
              const { prixVente } = calcPrixPresta(presta, item);
              const totalLigne = item.quantite * prixVente;

              return (
                <div key={prestationId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                  {/* En-tête ligne */}
                  <div className="p-5 border-b border-gray-50">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-gray-900">{presta.nom}</h4>
                        <p className="text-xs text-gray-500 mt-1">{presta.description}</p>
                      </div>
                      <div className="flex justify-between md:justify-end gap-6 text-right">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Quantité</p>
                          <p className="text-lg font-bold text-gray-900">{item.quantite}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Prix/unité</p>
                          <p className="text-base font-semibold text-[#5A4FCF]">{formatCurrency(prixVente)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Sous-total</p>
                          <p className="text-lg font-extrabold text-gray-900">{formatCurrency(totalLigne)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contenu détail */}
                  <div className="px-5 py-4 space-y-4">
                    {/* Contrôles quantité */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 mr-2">Ajuster quantité :</span>
                      <button onClick={() => updateQuantite(prestationId, item.quantite - 1)} className="p-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><Minus size={14} /></button>
                      <input
                        type="number" min="0.01" step={presta.unite === 'PIECE' || presta.unite === 'FORFAIT' ? '1' : '0.5'} value={item.quantite}
                        onChange={(e) => updateQuantite(prestationId, parseFloat(e.target.value) || 1)}
                        className="w-16 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 outline-none focus:border-[#9683EC]"
                      />
                      <button onClick={() => updateQuantite(prestationId, item.quantite + 1)} className="p-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><Plus size={14} /></button>
                      <span className="text-xs text-gray-400 ml-1">{presta.unite}</span>
                      <button onClick={() => toggleItem(prestationId)} className="ml-auto text-red-400 hover:text-red-600 text-xs font-semibold">✕ Supprimer</button>
                    </div>

                    {/* Options sélectionnées */}
                    {item.selectedOptions.size > 0 && (
                      <div className="bg-[#CCCCFF]/40 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-[#9683EC] uppercase mb-2">Choix sélectionnés</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(item.selectedOptions.entries()).map(([optId, choixIds]) => {
                            const option = presta.options?.find(o => o.id === optId);
                            return choixIds.map(cId => {
                              const choix = option?.choix?.find(c => c.id === cId);
                              return choix ? (
                                <span key={cId} className="text-xs bg-white text-[#9683EC] px-2.5 py-1 rounded-lg border border-[#5A4FCF] font-medium">
                                  <span className="text-[#5A4FCF] mr-1">•</span>
                                  {option?.nom}: <strong>{choix.nom}</strong>
                                  {choix.impactPrix !== 0 && ` → ${choix.impactPrix > 0 ? '+' : ''}${formatCurrency(choix.impactPrix)}`}
                                </span>
                              ) : null;
                            });
                          })}
                        </div>
                      </div>
                    )}

                    {/* Détail matériaux et main d'œuvre */}
                    {item && item.quantite > 0 && getCompositionsForItem(presta, item).length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-gray-700 uppercase mb-3">Détail des matériaux & main d'œuvre</p>
                        <div className="space-y-2">
                          {getCompositionsForItem(presta, item).map(comp => {
                            if (comp.materiau) {
                              const qteTotal = comp.quantiteParUnite * item.quantite;
                              const coutMat = qteTotal * comp.materiau.prixAchatFixe;
                              return (
                                <div key={comp.id} className="flex justify-between text-xs bg-white border border-blue-100 rounded-lg p-2.5">
                                  <div className="flex items-start gap-2 flex-1">
                                    <Package size={12} className="text-blue-500 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="font-medium text-gray-800">{comp.materiau.nom}</p>
                                      <p className="text-[11px] text-gray-500">{comp.quantiteParUnite} {comp.materiau.unite}/unité × {item.quantite} = <strong>{qteTotal} {comp.materiau.unite}</strong></p>
                                    </div>
                                  </div>
                                  <div className="text-right ml-2">
                                    <p className="font-semibold text-blue-600">{formatCurrency(coutMat)}</p>
                                    <p className="text-[10px] text-gray-400">{formatCurrency(comp.materiau.prixAchatFixe)}/{comp.materiau.unite}</p>
                                  </div>
                                </div>
                              );
                            } else if (comp.serviceMainOeuvre) {
                              const coutMO = comp.quantiteParUnite * item.quantite * comp.serviceMainOeuvre.prixUnitaire;
                              return (
                                <div key={comp.id} className="flex justify-between text-xs bg-white border border-[#5A4FCF]/30 rounded-lg p-2.5">
                                  <div className="flex items-start gap-2 flex-1">
                                    <Wrench size={12} className="text-[#5A4FCF] mt-0.5 shrink-0" />
                                    <div>
                                      <p className="font-medium text-gray-800">{comp.serviceMainOeuvre.nom}</p>
                                      <p className="text-[11px] text-gray-500">{comp.quantiteParUnite} {comp.serviceMainOeuvre.unite}/unité × {item.quantite} = <strong>{comp.quantiteParUnite * item.quantite} {comp.serviceMainOeuvre.unite}</strong></p>
                                    </div>
                                  </div>
                                  <div className="text-right ml-2">
                                    <p className="font-semibold text-[#5A4FCF]">{formatCurrency(coutMO)}</p>
                                    <p className="text-[10px] text-gray-400">{formatCurrency(comp.serviceMainOeuvre.prixUnitaire)}/{comp.serviceMainOeuvre.unite}</p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ÔöÇÔöÇ SIDEBAR : TOTAUX + ACTIONS ÔöÇÔöÇ */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden sticky top-6">
              {/* En-tête */}
              <div className="technico-gradient text-white px-5 py-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText size={18} />
                  Récapitulatif
                </h3>
              </div>

              {/* Contenu */}
              <div className="p-5 space-y-4">
                {/* Détail co├╗ts */}
                <div className="space-y-2 pb-4 border-b border-gray-100">
                  <Row label="Nombre de lignes" value={`${checkedCount}`} size="xs" />
                  <Row label="Total quantités" value={Array.from(checkedItems.values()).reduce((s, i) => s + i.quantite, 0).toFixed(2)} size="xs" />
                </div>

                {/* Totaux */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">Total HT</span>
                    <span className="font-bold text-gray-900">{formatCurrency(totaux.totalVenteHT)}</span>
                  </div>
                  {totaux.questionImpact !== 0 && (
                    <div className="flex justify-between text-xs bg-orange-50 -mx-2 px-3 py-2 rounded-lg">
                      <span className="text-orange-700">Questions (+)</span>
                      <span className="font-semibold text-orange-700">{formatCurrency(totaux.questionImpact)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>TVA {selectedDevisTauxTVA}%</span>
                    <span>{formatCurrency(totaux.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between text-lg bg-[#CCCCFF]/40 -mx-3 px-3 py-3 rounded-lg border-t border-gray-100 mt-3">
                    <span className="font-bold text-[#9683EC]">Total TTC</span>
                    <span className="font-extrabold text-[#9683EC]">{formatCurrency(totaux.totalTTC)}</span>
                  </div>
                </div>

                {/* Marges (info interne) */}
                <div className="space-y-1 text-xs pt-3 border-t border-gray-100 bg-gray-50 -mx-3 px-3 py-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Co├╗t total</span>
                    <span className="font-medium text-gray-800">{formatCurrency(totaux.totalCout)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bénéfice</span>
                    <span className={`font-semibold ${totaux.profit >= 0 ? 'text-[#5A4FCF]' : 'text-red-600'}`}> 
                      {formatCurrency(totaux.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Marge</span>
                    <span className={`font-bold ${totaux.marge >= 20 ? 'text-[#5A4FCF]' : totaux.marge >= 10 ? 'text-orange-500' : 'text-red-600'}`}> 
                      {totaux.marge}%
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-3">
                  {submitted ? (
                    <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 size={18} />
                        <span className="text-sm font-semibold">
                          Devis enregistre dans Mes Devis.
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          onClick={() => navigate(devisListPath)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <Eye size={14} />
                          Voir Mes Devis
                        </button>
                        <button
                          onClick={resetStudyAfterSubmit}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Continuer l'etude
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => effectiveSelectedDevisId && setShowDevisPreview(true)}
                        disabled={!effectiveSelectedDevisId || checkedCount === 0}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border',
                          effectiveSelectedDevisId && checkedCount > 0
                            ? 'border-[#5A4FCF] bg-[#CCCCFF]/40 hover:bg-[#CCCCFF]/60 text-[#9683EC]'
                            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed',
                        )}
                      >
                        <Eye size={14} />
                        Aper├ºu Devis
                      </button>

                      <button
                        onClick={() => submitMutation.mutate()}
                        disabled={!canSubmitChecklist || submitMutation.isPending}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
                          canSubmitChecklist
                            ? 'technico-gradient hover:opacity-90 text-white shadow-lg hover:-translate-y-0.5'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                        )}
                      >
                        {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        Valider le devis
                      </button>
                    </>
                  )}

                  {submitMutation.error && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {getApiErrorMessage(
                        submitMutation.error,
                        "Impossible d'enregistrer le devis.",
                      )}
                    </p>
                  )}

                  {!effectiveSelectedDevisId && checkedCount > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {demandeContext
                        ? 'Le devis brouillon sera créé lors de la validation.'
                        : 'Sélectionnez un devis BROUILLON'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aper├ºu Devis */}
      {showDevisPreview && previewDevis && (
        <DevisInvoice
          devis={previewDevis}
          onClose={() => setShowDevisPreview(false)}
          onPrint={() => window.print()}
          onValidate={async () => {
            // Appel API pour valider le devis (statut ENVOYE + envoi email)
            if (!previewDevis?.id) throw new Error('Devis introuvable');
            await submitMutation.mutateAsync();
            // Optionnel: refetch la liste des devis ou maj localement
            setShowDevisPreview(false);
            // Optionnel: notification de succès
          }}
          validateConfirmMessage="Confirmer l'enregistrement de ce devis en brouillon et la conversion de la demande ?"
          validateLoadingLabel="Enregistrement..."
        />
      )}
    </div>
  );
}

// ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ SUB-COMPONENTS ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ

function Header() {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <CheckSquare className="text-[#5A4FCF]" size={24} />
        Checklist Devis
      </h2>
      <p className="text-sm text-gray-400 mt-0.5">
        Parcourez le catalogue, répondez aux questions, sélectionnez les prestations → le devis se génère automatiquement
      </p>
    </div>
  );
}

function StepHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <button onClick={onBack} className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition">
        <ChevronRight size={18} className="rotate-180 text-gray-600" />
      </button>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

function StudyContextBanner({
  demande,
  client,
  projectTypeLabel,
  projectTypeCount,
  activeProjectMatches,
  usesMappedProjectCategories,
  matchedCount,
  reasons,
  showFullCatalogue,
  onToggleCatalogue,
}: {
  demande?: DemandeChecklistContext | null;
  client?: Client | null;
  projectTypeLabel: string;
  projectTypeCount: number;
  activeProjectMatches: boolean;
  usesMappedProjectCategories: boolean;
  matchedCount: number;
  reasons: string[];
  showFullCatalogue: boolean;
  onToggleCatalogue: () => void;
}) {
  if (!demande) return null;

  const clientLabel = getClientDisplayName(client, demande.clientId);

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm text-sky-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-semibold">
            Demande #{demande.id} • {clientLabel}
          </p>
          <p className="text-sky-700">
            {projectTypeLabel
              ? `${projectTypeCount > 1 ? 'Types de projet' : 'Type de projet'}: ${projectTypeLabel}.`
              : "Aucun type de projet n'est renseigne sur ce client."}
          </p>
          {activeProjectMatches && reasons.length > 0 && (
            <p className="text-xs text-sky-700">
              {usesMappedProjectCategories
                ? `Filtre actif sur ${matchedCount} categorie${matchedCount > 1 ? 's' : ''} configuree${matchedCount > 1 ? 's' : ''} pour ${projectTypeCount > 1 ? 'ces types de projet' : 'ce type de projet'}: ${reasons.join(', ')}.`
                : `Filtre actif sur ${matchedCount} categorie${matchedCount > 1 ? 's' : ''} selon le nom du type de projet: ${reasons.join(', ')}.`}
            </p>
          )}
        </div>
        {matchedCount > 0 && (
          <button
            onClick={onToggleCatalogue}
            className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
          >
            {showFullCatalogue ? 'Revenir au filtre projet' : 'Afficher tout le catalogue'}
          </button>
        )}
      </div>
    </div>
  );
}

function LinkedDevisCard({
  demande,
  client,
  projectTypeLabel,
  selectedDevis,
  isLoading,
}: {
  demande: DemandeChecklistContext;
  client?: Client | null;
  projectTypeLabel: string;
  selectedDevis: Devis | null;
  isLoading: boolean;
}) {
  const clientLabel = getClientDisplayName(client, demande.clientId);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Devis cible</p>
          <p className="mt-1 text-sm text-gray-500">
            {selectedDevis
              ? `Le devis ${selectedDevis.reference} est lie a cette demande.`
              : 'Le devis brouillon sera cree a la validation du checklist.'}
          </p>
        </div>
        <span className="rounded-full bg-[#CCCCFF]/40 px-3 py-1 text-xs font-semibold text-[#5A4FCF]">
          {selectedDevis?.reference ?? 'A creer'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">Client</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{clientLabel}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">Projet</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {projectTypeLabel || 'Type non renseigne'}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">Etat</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {isLoading && !selectedDevis
              ? 'Chargement...'
              : selectedDevis
                ? `${selectedDevis.statut} • ${formatCurrency(selectedDevis.totalHT ?? 0)} HT`
                : 'Brouillon non cree'}
          </p>
        </div>
      </div>
    </div>
  );
}

function DevisSelector({ devisData, selectedDevisId, setSelectedDevisId }: {
  devisData: Devis[];
  selectedDevisId: number | null;
  setSelectedDevisId: (id: number | null) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <label className="block text-sm font-semibold text-gray-700 mb-2">Devis cible</label>
      <select
        value={selectedDevisId ?? ''}
        onChange={(e) => setSelectedDevisId(parseInt(e.target.value) || null)}
        className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#9683EC] focus:ring-2 focus:ring-[#CCCCFF]"
      >
        <option value="">Sélectionner un devis BROUILLON...</option>
        {devisData.map((d) => (
          <option key={d.id} value={d.id}>
            {d.reference} — {d.client ? `${d.client.prenom ?? ''} ${d.client.nom}`.trim() : 'Client'} ({formatCurrency(d.totalHT ?? 0)})
          </option>
        ))}
      </select>
    </div>
  );
}

// ÔöÇÔöÇ Question Card ÔöÇÔöÇ
function QuestionCard({ question, value, onChange, onToggleChoice }: {
  question: QuestionDiagnostic;
  value: string | string[] | boolean | undefined;
  onChange: (v: string | string[] | boolean) => void;
  onToggleChoice: (choice: string, multi: boolean) => void;
}) {
  // Helper pour extraire le nom et impact prix d'un choix
  const parseChoice = (choix: QuestionChoice) => {
    if (typeof choix === 'string') {
      return { nom: choix, impactPrix: 0 };
    }
    return { nom: choix.nom, impactPrix: choix.impactPrix ?? 0 };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-lg bg-purple-50 text-purple-600">
          {getTypeIcon(question.typeReponse)}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {question.question}
            {question.obligatoire && <span className="text-red-500 ml-1">*</span>}
          </p>
          {question.aide && <p className="text-xs text-gray-400 mt-0.5">{question.aide}</p>}

          <div className="mt-3">
            {question.typeReponse === 'BOOLEEN' && (
              <div className="flex gap-2">
                {['Oui', 'Non'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => onChange(opt === 'Oui')}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium border transition',
                      value === (opt === 'Oui')
                        ? 'bg-[#5A4FCF] text-white border-[#5A4FCF]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#5A4FCF]',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {question.typeReponse === 'CHOIX_UNIQUE' && (
              <div className="flex flex-wrap gap-2">
                {(question.choixPossibles ?? []).map((choixRaw) => {
                  const choix = parseChoice(choixRaw);
                  return (
                    <button
                      key={choix.nom}
                      onClick={() => onToggleChoice(choix.nom, false)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm font-medium border transition',
                        value === choix.nom
                          ? 'bg-[#5A4FCF] text-white border-[#5A4FCF]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#5A4FCF]',
                      )}
                    >
                      {choix.nom}
                      {choix.impactPrix !== 0 && (
                        <span className={cn('ml-1', value === choix.nom ? 'text-[#CCCCFF]' : 'text-gray-400')}>
                          {choix.impactPrix > 0 ? '+' : ''}{choix.impactPrix}€
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {question.typeReponse === 'CHOIX_MULTIPLE' && (
              <div className="flex flex-wrap gap-2">
                {(question.choixPossibles ?? []).map((choixRaw) => {
                  const choix = parseChoice(choixRaw);
                  const selected = Array.isArray(value) && value.includes(choix.nom);
                  return (
                    <button
                      key={choix.nom}
                      onClick={() => onToggleChoice(choix.nom, true)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm font-medium border transition flex items-center gap-1.5',
                        selected
                          ? 'bg-[#5A4FCF] text-white border-[#5A4FCF]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#5A4FCF]',
                      )}
                    >
                      {selected ? <CheckSquare size={14} /> : <Square size={14} />}
                      {choix.nom}
                      {choix.impactPrix !== 0 && (
                        <span className={cn('ml-1', selected ? 'text-[#CCCCFF]' : 'text-gray-400')}>
                          {choix.impactPrix > 0 ? '+' : ''}{choix.impactPrix}€
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {question.typeReponse === 'TEXTE' && (
              <textarea
                value={(value as string) ?? ''}
                onChange={(e) => onChange(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#9683EC] resize-none"
                placeholder="Votre réponse..."
              />
            )}

            {question.typeReponse === 'NOMBRE' && (
              <input
                type="number"
                value={(value as string) ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#9683EC]"
                placeholder="0"
              />
            )}

            {question.typeReponse === 'PHOTO' && (
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                <Camera size={16} />
                <span>Prise de photo (fonctionnalité à venir)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ÔöÇÔöÇ Prestation Row ÔöÇÔöÇ
function PrestationRow({
  presta, checkedItems, expandedDetail, setExpandedDetail,
  toggleItem, updateQuantite, toggleChoix, setInfoValue, calcPrixPresta, getCompositionsForItem,
}: {
  presta: Prestation;
  checkedItems: Map<number, ChecklistItem>;
  expandedDetail: number | null;
  setExpandedDetail: (id: number | null) => void;
  toggleItem: (id: number) => void;
  updateQuantite: (id: number, q: number) => void;
  toggleChoix: (prestId: number, optId: number, choixId: number, multi: boolean) => void;
  setInfoValue: (prestId: number, nom: string, val: string) => void;
  calcPrixPresta: (presta: Prestation, item: ChecklistItem) => PricingResult;
  getCompositionsForItem: (presta: Prestation, item: ChecklistItem) => NonNullable<Prestation['compositions']>;
}) {
  const isChecked = checkedItems.has(presta.id);
  const item = checkedItems.get(presta.id);
  const isDetailOpen = expandedDetail === presta.id;
  const hasDetails = (presta.compositions?.length ?? 0) > 0 || (presta.options?.length ?? 0) > 0 || (presta.infosRequises?.length ?? 0) > 0;

  const prix = item
    ? calcPrixPresta(presta, item)
    : {
      prixVente: (presta.prixVenteMin + presta.prixVenteMax) / 2,
      coutParUnite: calcCompositionsCostPerUnit(presta.compositions),
      optionImpactParUnite: 0,
      minUnitPrice: presta.prixVenteMin,
      maxUnitPrice: presta.prixVenteMax,
    };

  return (
    <div className={cn('transition', isChecked && 'bg-[#CCCCFF]/40')}>
      <div className="flex items-center gap-3 px-5 py-3">
        {/* Checkbox */}
        <button onClick={() => toggleItem(presta.id)} className="shrink-0 text-[#5A4FCF] hover:text-[#9683EC] transition">
          {isChecked ? <CheckSquare size={20} /> : <Square size={20} className="text-gray-300" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', isChecked ? 'text-gray-900' : 'text-gray-600')}>{presta.nom}</span>
            {hasDetails && (
              <button
                onClick={() => setExpandedDetail(isDetailOpen ? null : presta.id)}
                className="text-[10px] text-[#9683EC] hover:text-[#5A4FCF] font-medium"
              >
                {isDetailOpen ? 'masquer' : 'détail'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{r2(prix.minUnitPrice)}–{r2(prix.maxUnitPrice)} €/{presta.unite}</span>
            {prix.optionImpactParUnite !== 0 && (
              <span className={cn('font-semibold', prix.optionImpactParUnite > 0 ? 'text-[#5A4FCF]' : 'text-rose-600')}>
                options: {prix.optionImpactParUnite > 0 ? '+' : ''}{formatCurrency(prix.optionImpactParUnite)}/{presta.unite}
              </span>
            )}
            {prix.coutParUnite > 0 && <span className="text-orange-500">co├╗t: {prix.coutParUnite.toFixed(2)} €/{presta.unite}</span>}
            {(presta.options?.length ?? 0) > 0 && <span className="text-purple-500">{presta.options!.length} options</span>}
            {(presta.infosRequises?.length ?? 0) > 0 && <span className="text-violet-500">{presta.infosRequises!.length} infos</span>}
          </div>
        </div>

        {/* Quantité */}
        {isChecked && item && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => updateQuantite(presta.id, item.quantite - 1)} className="p-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><Minus size={14} /></button>
            <input
              type="number" min="0.01" step={presta.unite === 'PIECE' || presta.unite === 'FORFAIT' ? '1' : '0.5'}
              value={item.quantite}
              onChange={(e) => updateQuantite(presta.id, parseFloat(e.target.value) || 1)}
              className="w-16 text-center text-sm font-semibold border border-gray-200 rounded-lg py-1 outline-none focus:border-[#9683EC]"
            />
            <button onClick={() => updateQuantite(presta.id, item.quantite + 1)} className="p-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><Plus size={14} /></button>
            <span className="text-xs text-gray-400 ml-1">{presta.unite}</span>
          </div>
        )}

        {/* Sous-total */}
        {isChecked && item && (
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-sm font-bold text-gray-900">{formatCurrency(item.quantite * prix.prixVente)}</p>
          </div>
        )}
      </div>

      {/* ÔöÇÔöÇ Détail étendu : compositions + options + infos requises ÔöÇÔöÇ */}
      {isDetailOpen && item && (
        <div className="px-12 pb-4 space-y-4">
          {/* Compositions (matériaux + MO) */}
          {getCompositionsForItem(presta, item).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Matériaux et Main d'œuvre</p>
              <div className="space-y-1.5 bg-gray-50 rounded-lg p-2">
                {getCompositionsForItem(presta, item).map(comp => {
                  if (comp.materiau) {
                    const qteTotal = comp.quantiteParUnite * item.quantite;
                    const coutMat = qteTotal * comp.materiau.prixAchatFixe;
                    return (
                      <div key={comp.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Package size={12} className="text-blue-400" />
                          <span className="font-medium text-gray-700">{comp.materiau.nom}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>{comp.quantiteParUnite} × {item.quantite} = {qteTotal} {comp.materiau.unite}</span>
                          <span className="font-semibold text-orange-600">{formatCurrency(coutMat)}</span>
                        </div>
                      </div>
                    );
                  } else if (comp.serviceMainOeuvre) {
                    const coutMO = comp.quantiteParUnite * item.quantite * comp.serviceMainOeuvre.prixUnitaire;
                    return (
                      <div key={comp.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Wrench size={12} className="text-[#5A4FCF]" />
                          <span className="font-medium text-gray-700">{comp.serviceMainOeuvre.nom}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>{comp.quantiteParUnite} × {item.quantite} = {comp.quantiteParUnite * item.quantite} {comp.serviceMainOeuvre.unite}</span>
                          <span className="font-semibold text-[#5A4FCF]">{formatCurrency(coutMO)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Options avec choix cliquables */}
          {isChecked && (presta.options?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Options</p>
              <div className="space-y-3">
                {presta.options!.map(option => (
                  <OptionBlock
                    key={option.id}
                    presta={presta}
                    option={option}
                    selectedChoixIds={item?.selectedOptions.get(option.id) ?? []}
                    onToggle={(choixId) => toggleChoix(presta.id, option.id, choixId, false)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Infos requises */}
          {isChecked && (presta.infosRequises?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Informations requises</p>
              <div className="space-y-2">
                {presta.infosRequises!.map(info => (
                  <div key={info.id} className="flex items-center gap-2">
                    {getInfoIcon(info.typeInfo)}
                    <span className="text-xs text-gray-600 min-w-[120px]">
                      {info.nom}{info.obligatoire && <span className="text-red-500">*</span>}
                    </span>
                    <input
                      type={info.typeInfo === 'MESURE' ? 'number' : 'text'}
                      placeholder={info.aide ?? info.nom}
                      value={item?.infosValues.get(info.nom) ?? ''}
                      onChange={(e) => setInfoValue(presta.id, info.nom, e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#9683EC]"
                    />
                    {info.unite && <span className="text-[10px] text-gray-400">{info.unite}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ÔöÇÔöÇ Option Block (choix cliquables) ÔöÇÔöÇ
function OptionBlock({ presta, option, selectedChoixIds, onToggle }: {
  presta: Prestation;
  option: OptionPrestation;
  selectedChoixIds: number[];
  onToggle: (choixId: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">
        {option.nom}
        {option.obligatoire && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(option.choix ?? []).filter(c => c.actif).map(choix => {
          const selected = selectedChoixIds.includes(choix.id);
          const impact = resolveChoiceImpact(presta, choix);
          return (
            <button
              key={choix.id}
              onClick={() => onToggle(choix.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium border transition',
                selected ? 'bg-[#5A4FCF] text-white border-[#5A4FCF]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#5A4FCF]',
              )}
            >
              {choix.nom}
              {impact !== 0 && (
                <span className={cn('ml-1', selected ? 'text-[#CCCCFF]' : 'text-gray-400')}>
                  {impact > 0 ? '+' : ''}{impact}€
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ÔöÇÔöÇ Recap Sidebar ÔöÇÔöÇ
function RecapSidebar({
  checkedItems, catalogue, totaux, checkedCount, calcPrixPresta, onViewRecap,
}: {
  checkedItems: Map<number, ChecklistItem>;
  catalogue: CatalogueCategorieWithCompositions[];
  totaux: {
    totalVenteHT: number;
    totalVenteHTMin: number;
    totalVenteHTMax: number;
    totalTVA: number;
    totalTTC: number;
    totalCout: number;
    profit: number;
    marge: number;
    questionImpact?: number;
  };
  checkedCount: number;
  calcPrixPresta: (p: Prestation, i: ChecklistItem) => PricingResult;
  selectedDevisId: number | null;
  submitted: boolean;
  submitMutation: { mutate: () => void; isPending: boolean; error: Error | null };
  onViewRecap: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-6">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Calculator size={16} className="text-[#5A4FCF]" />
          Récapitulatif
        </h3>

        {checkedCount === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune prestation cochée</p>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {Array.from(checkedItems.entries()).map(([prestationId, item]) => {
                const presta = findPresta(catalogue, prestationId);
                if (!presta) return null;
                const { prixVente } = calcPrixPresta(presta, item);
                return (
                  <div key={prestationId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate max-w-[55%]">{presta.nom}</span>
                    <span className="font-semibold text-gray-900">{item.quantite} × {formatCurrency(prixVente)}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <Row label="Total HT" value={formatCurrency(totaux.totalVenteHT)} bold />
              <Row
                label="Fourchette HT"
                value={`${formatCurrency(totaux.totalVenteHTMin)} – ${formatCurrency(totaux.totalVenteHTMax)}`}
                size="xs"
              />
              {(totaux.questionImpact ?? 0) !== 0 && (
                <Row label="Surco├╗t" value={formatCurrency(totaux.questionImpact ?? 0)} color={(totaux.questionImpact ?? 0) > 0 ? 'text-orange-600' : 'text-emerald-600'} size="xs" />
              )}
              <Row label="TVA" value={formatCurrency(totaux.totalTVA)} />
              <div className="flex justify-between text-sm bg-[#CCCCFF]/40 -mx-2 px-2 py-1.5 rounded-lg">
                <span className="font-bold text-[#9683EC]">Total TTC</span>
                <span className="font-extrabold text-[#9683EC]">{formatCurrency(totaux.totalTTC)}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 mt-3 space-y-1.5">
              <Row label="Co├╗t" value={formatCurrency(totaux.totalCout)} color="text-orange-600" size="xs" />
              <Row label="Bénéfice" value={formatCurrency(totaux.profit)} color={totaux.profit >= 0 ? 'text-[#5A4FCF]' : 'text-red-600'} size="xs" bold />
              <Row label="Marge" value={`${totaux.marge}%`} color={totaux.marge >= 20 ? 'text-[#5A4FCF]' : totaux.marge >= 10 ? 'text-orange-500' : 'text-red-600'} size="xs" bold />
            </div>

            <button
              onClick={onViewRecap}
              className="mt-3 w-full py-2 rounded-xl border border-[#5A4FCF] text-[#9683EC] text-xs font-semibold hover:bg-[#CCCCFF]/40 transition"
            >
              Voir le récapitulatif complet
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ÔöÇÔöÇ Tiny helpers ÔöÇÔöÇ
function Row({ label, value, bold, color, size = 'sm' }: { label: string; value: string; bold?: boolean; color?: string; size?: 'xs' | 'sm' }) {
  return (
    <div className={cn('flex justify-between', size === 'xs' ? 'text-xs' : 'text-sm')}>
      <span className="text-gray-500">{label}</span>
      <span className={cn(bold ? 'font-bold' : 'font-medium', color ?? 'text-gray-900')}>{value}</span>
    </div>
  );
}

function r2(n: number) { return Math.round(n * 100) / 100; }

function findPresta(catalogue: CatalogueCategorieWithCompositions[], id: number): Prestation | undefined {
  for (const cat of catalogue) {
    const p = cat.prestations?.find(p => p.id === id);
    if (p) return p;
    for (const sc of cat.sousCategories ?? []) {
      const sp = sc.prestations?.find(p => p.id === id);
      if (sp) return sp;
    }
  }
  return undefined;
}
