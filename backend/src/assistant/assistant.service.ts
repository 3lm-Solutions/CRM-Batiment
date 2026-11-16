import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service.js';
import { StartAssistantSessionDto } from './dto/start-assistant-session.dto.js';
import { PostAssistantMessageDto } from './dto/post-assistant-message.dto.js';
import {
  SubmitStructuredAssistantDto,
  StructuredOptionChoiceDto,
} from './dto/submit-structured-assistant.dto.js';
import { LeadSource, Prisma, Role } from '../../generated/prisma/client.js';
import { DevisService } from '../devis/devis.service.js';
import { ClientsService } from '../clients/clients.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  AssistantLlmService,
  type ExtractedFields,
} from './assistant-llm.service.js';
import {
  AssistantRagService,
  type RagSnippet,
} from './assistant-rag.service.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { checkSensitiveOutput } from './sensitive-output.filter.js';
type AssistantIntent =
  | 'demande_devis'
  | 'demande_info_service'
  | 'demande_prix'
  | 'information_generale'
  | 'autre';

type CommercialIntent =
  | 'demande_service'
  | 'demande_devis'
  | 'demande_information'
  | 'demande_prix'
  | 'demande_rdv'
  | 'demande_suivi'
  | 'demande_validation'
  | 'autre';

type WorkflowAction = {
  status: string;
  details: string;
  data?: Prisma.InputJsonValue;
};

type ConversationSessionState = {
  nom: string | null;
  telephone: string | null;
  email: string | null;
  projectType: string | null;
  surface: number | null;
  delai: string | null;
  urgent: boolean;
  confirmed: boolean;
  pendingRdv: boolean;
  pendingSuivi: boolean;
  lastReference: string | null;
};

type AssistantLanguage = 'fr' | 'ar';

type AssistantResult = {
  intent: AssistantIntent;
  detected_intents: CommercialIntent[];
  intent_confidence?: number;
  project_type_confidence?: number;
  intent_ranking?: Array<{
    intent: CommercialIntent;
    score: number;
  }>;
  confidence?: AssistantConfidence;
  client_need_summary: string;
  extracted_entities: {
    nom: string;
    telephone: string;
    email: string;
    description: string;
    requested_service: string;
    quantity: number | null;
    urgence: boolean;
    demande_rdv: boolean;
    demande_suivi: boolean;
    demande_validation: boolean;
  };
  existing_project_match: boolean;
  project_to_create_if_not_found: {
    status: 'create_pending_project_type' | 'not_required';
    nom: string;
    description_courte: string;
  };
  quote_action: WorkflowAction;
  checklist_action: WorkflowAction;
  technical_validation_action: WorkflowAction;
  email_action: WorkflowAction;
  needs_clarification: boolean;
  clarification_question: string;
  project_type: string;
  is_known_project: boolean;
  missing_fields: string[];
  project_types?: Array<{
    id: number;
    nom: string;
    description: string | null;
  }>;
  collected_data: {
    nom: string;
    telephone: string;
    email: string;
    description: string;
  };
  extraction_audit?: ExtractionAudit;
  response_message: string;
  guided_question?: {
    field: string;
    question: string;
    type: 'text' | 'choice' | 'number';
    choices?: string[];
  } | null;
  checklist?: string[];
  structured_workflow?: {
    status: StructuredWorkflowStatus;
    project_type: string;
    categories: Array<{ id: number; nom: string; description: string | null }>;
    sous_categories: Array<{
      id: number;
      nom: string;
      description: string | null;
    }>;
    prestations: Array<{
      id: number;
      nom: string;
      description: string | null;
      prixVenteMin: number;
      prixVenteMax: number;
      options: Array<{
        id: number;
        nom: string;
        obligatoire: boolean;
        choix: Array<{ id: number; nom: string; impactPrix: number }>;
      }>;
    }>;
    selected: {
      categoryId: number | null;
      sousCategorieId: number | null;
      prestationId: number | null;
    };
    missing_option_ids: number[];
    can_validate: boolean;
  };
  is_urgent?: boolean;
  devis_id?: number | null;
  rag_sources?: Array<{
    source_type: 'type_projet' | 'categorie' | 'prestation' | 'rag_document';
    title: string;
    score: number;
  }>;
};

type AssistantConfidence = {
  intent: number;
  project_type: number;
  extraction: {
    nom: number;
    telephone: number;
    email: number;
    description: number;
  };
  overall: number;
};

type IntentDetectionResult = {
  intent: AssistantIntent;
  detectedIntents: CommercialIntent[];
  scores: Record<CommercialIntent, number>;
  ranking: Array<{ intent: CommercialIntent; score: number }>;
  confidence: number;
  ambiguous: boolean;
};

type ProjectTypeMatchResult = {
  known: boolean;
  projectType: string;
  suggestedType: string | null;
  confidence: number;
  source: 'exact' | 'alias' | 'token_overlap' | 'hint' | 'none';
};

type ExtractionFieldSource = 'ai' | 'regex' | 'history' | 'message' | 'none';

type ExtractionFieldAudit = {
  value: string;
  source: ExtractionFieldSource;
  confidence: number;
  valid: boolean;
};

type ExtractionAudit = {
  nom: ExtractionFieldAudit;
  telephone: ExtractionFieldAudit;
  email: ExtractionFieldAudit;
  description: ExtractionFieldAudit;
  project_type_hint: ExtractionFieldAudit;
};

type FutureProjectSignal = {
  label: string;
  suggestedType: string | null;
  description: string;
  motsCles: string[];
  createdAt: string;
  prospect: {
    nom: string;
    telephone: string;
    email: string;
  };
  sessionId: number;
};

type ExistingState = {
  collected_data: {
    nom: string;
    telephone: string;
    email: string;
    description: string;
  };
  intent: AssistantIntent;
  project_type: string;
  is_known_project: boolean;
  awaitingConfirmation: boolean;
  awaitingEstimateChoice: boolean;
  guidedAnswers: Record<string, string>;
  currentGuidedStep: number;
  checklistCompleted: boolean;
  isUrgent: boolean;
  devisId: number | null;
  sessionState: ConversationSessionState;
  summarySent: boolean;
  pendingProjectType: string | null;
  awaitingProjectTypeChangeConfirmation: boolean;
};

type GuidedStep = {
  field: string;
  questionFr: string;
  questionAr: string;
  type: 'text' | 'choice' | 'number';
  choices?: string[];
  unit?: string;
};

type StructuredRequestType =
  | 'devis'
  | 'prix'
  | 'categorie'
  | 'service_disponible';

type StructuredWorkflowStatus =
  | 'MISSING_REQUIRED_INFO'
  | 'UNKNOWN_SERVICE_RECORDED'
  | 'NEEDS_CHECKLIST_SELECTION'
  | 'READY_FOR_VALIDATION'
  | 'VALIDATED_AND_PDF_READY';

type ProjectTypeSummary = {
  nom: string;
  description: string | null;
};

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devisService: DevisService,
    private readonly clientsService: ClientsService,
    private readonly assistantLlmService: AssistantLlmService,
    private readonly assistantRagService: AssistantRagService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startSession(dto: StartAssistantSessionDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { id: true, nom: true },
    });

    if (!company) {
      throw new NotFoundException(`Societe #${dto.companyId} introuvable`);
    }

    const session = await this.prisma.chatSession.create({
      data: {
        companyId: dto.companyId,
        besoinStructure: {
          collected_data: {
            nom: '',
            telephone: '',
            email: '',
            description: '',
          },
          session_state: this.createDefaultSessionState(),
          intent: 'autre',
          project_type: '',
          is_known_project: false,
          guided_answers: {},
          current_guided_step: 0,
          checklist_completed: false,
          is_urgent: false,
          devis_id: null,
          summary_sent: false,
          pending_project_type: null,
          awaiting_project_type_change_confirmation: false,
        },
      },
    });

    if (dto.initialMessage?.trim()) {
      return this.postMessage(session.id, {
        companyId: dto.companyId,
        message: dto.initialMessage,
      });
    }

    return {
      session_id: session.id,
      company_id: dto.companyId,
      response_message:
        "Bonjour ! 👋 Je suis **Léa**, votre assistante BatiCRM.\n\nJe peux vous aider pour un devis, un rendez-vous, le suivi de votre demande ou toute question sur nos services.\n\nCliquez sur une suggestion ci-dessous, ou écrivez-moi directement ! 😊",
    };
  }

  async postMessage(
    sessionId: number,
    dto: PostAssistantMessageDto,
  ): Promise<AssistantResult> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, companyId: dto.companyId },
      select: {
        id: true,
        companyId: true,
        clientNom: true,
        clientTelephone: true,
        clientEmail: true,
        besoinStructure: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable pour cette societe');
    }

    await this.prisma.messageChat.create({
      data: {
        sessionId,
        role: 'USER',
        contenu: dto.message,
      },
    });

    const projectTypes = await this.prisma.typeProjet.findMany({
      where: {
        companyId: dto.companyId,
        actif: true,
      },
      select: {
        id: true,
        nom: true,
        description: true,
      },
      orderBy: { nom: 'asc' },
    });

    const state = this.getExistingState(session);
    const previousSessionState = this.createDefaultSessionState({
      ...state.sessionState,
    });
    const normalizedMessage = dto.message.trim();
    const language = this.detectLanguage(normalizedMessage);
    const projectTypeNames = projectTypes.map((type) => type.nom);

    // Extraction intelligente via IA (Mistral/HuggingFace)
    // Fallback automatique vers regex si l'IA échoue
    const aiExtracted = await this.assistantLlmService.extractFieldsWithAI(
      normalizedMessage,
      projectTypeNames,
    );
    const intentFallback =
      state.currentGuidedStep > 0 && !state.checklistCompleted
        ? 'demande_devis'
        : state.intent;
    const aiIntentHint =
      state.currentGuidedStep > 0 && !state.checklistCompleted
        ? undefined
        : aiExtracted?.intent;
    const intentDetection = this.detectIntentWithConfidence(
      normalizedMessage,
      intentFallback,
      aiIntentHint,
    );
    let intent = intentDetection.intent;

    // FIX: si on est en parcours devis guidé (step > 0) et que le client répond
    // avec un type de travaux, on FORCE demande_devis au lieu de basculer vers info_service.
    if (
      (state.currentGuidedStep ?? 0) > 0 &&
      !state.checklistCompleted &&
      intent === 'demande_info_service' &&
      !intentDetection.detectedIntents.includes('demande_rdv')
    ) {
      intent = 'demande_devis';
    }

    // FIX RAG: si le message est une QUESTION informative (ex: "quelle difference
    // entre devis et facture ?"), on force info_service pour que le RAG reponde,
    // au lieu de lancer le parcours devis. On ne le fait PAS en plein parcours guidé.
    const messageForQuestionCheck = this.normalizeForMatch(dto.message);
    const isInformationalQuestion =
      (/\?/.test(dto.message) ||
        /(prix|tarif|co[uû]te?|budget|estimation)/.test(messageForQuestionCheck)) &&
      /(quelle?|quels?|quelles?|comment|combien|pourquoi|difference|c est quoi|ca veut dire|signifie|valide|inclus|inclut|puis[\s-]?je|peut[\s-]?on|est[\s-]?il possible|est[\s-]?ce possible|comment faire|ou puis[\s-]?je|ou trouver|peut[\s-]?elle|peut[\s-]?il|budget|prix|co[uû]te?|tarif|estimation)/.test(
        messageForQuestionCheck,
      ) &&
      !/\b(je veux|j aimerais|je voudrais|creer|faire|preparer|calculer)\b[\s\S]*\bdevis\b/.test(
        messageForQuestionCheck,
      );
    if (
      isInformationalQuestion &&
      intent === 'demande_devis' &&
      (state.currentGuidedStep ?? 0) === 0
    ) {
      intent = 'demande_info_service';
    }
    const detectedIntents = intentDetection.detectedIntents;
    const commercialIntentsFallback = this.detectCommercialIntents({
      message: normalizedMessage,
      aiIntentHint,
      fallbackIntent: intent,
    });
    const detectedIntentsResolved =
      detectedIntents.length > 0 ? detectedIntents : commercialIntentsFallback;

    // FIX: garantir la détection du rendez-vous (son score est trop faible
    // pour passer le seuil). Si le message mentionne un rdv, on l'ajoute.
    const mentionsRdvDirect = /\b(rendez[\s-]?vous|rdv|planifier|visite)\b/i.test(
      normalizedMessage,
    );
    // On maintient le rdv si le message le mentionne OU si on était déjà en parcours rdv
    // (et qu'aucune nouvelle intention claire de devis/prix/suivi n'est exprimée).
    const wasPendingRdv = Boolean(state.sessionState?.pendingRdv);
    const switchesAway =
      /\b(devis|prix|tarif|suivi|service)\b/i.test(normalizedMessage);
    if (mentionsRdvDirect || (wasPendingRdv && !switchesAway)) {
      // On force le parcours rendez-vous : ajouter demande_rdv en tête
      if (!detectedIntentsResolved.includes('demande_rdv')) {
        detectedIntentsResolved.unshift('demande_rdv');
      }
      // ...et retirer demande_devis qui empêche le parcours rdv de se lancer
      const idxDevis = detectedIntentsResolved.indexOf('demande_devis');
      if (idxDevis !== -1) {
        detectedIntentsResolved.splice(idxDevis, 1);
      }
    }

    // Detection / maintien du parcours SUIVI (par mot-cle ou reference DEM-X).
    // Une question informative ("comment suivre un chantier ?") n'est PAS une
    // demande de suivi personnel : on exclut les tournures "comment/quels/que..."
    const isHowToQuestion =
      /\b(comment|quels?|quelles?|qu est ce|c est quoi|pourquoi)\b/i.test(normalizedMessage);
    const mentionsSuiviDirect =
      (!isHowToQuestion &&
        /\b(suivi|suivre|statut|avancement|ou en est)\b/i.test(normalizedMessage)) ||
      /dem-[a-z0-9]{4,10}/i.test(normalizedMessage);
    // Demande explicite de contact humain : "je veux parler a un humain/conseiller"
    const wantsHuman =
      /\b(parler|discuter|contacter|joindre)\b[\s\S]{0,30}\b(humain|conseiller|personne|quelqu un|agent|responsable|commercial|equipe)\b/i.test(
        normalizedMessage,
      ) ||
      /\b(un humain|un conseiller|une vraie personne|un vrai conseiller)\b/i.test(
        normalizedMessage,
      );
    const wasPendingSuivi = Boolean(state.sessionState?.pendingSuivi);
    const switchesAwayFromSuivi =
      /\b(devis|rendez[\s-]?vous|rdv|prix|tarif)\b/i.test(normalizedMessage);
    if (mentionsSuiviDirect || (wasPendingSuivi && !switchesAwayFromSuivi)) {
      if (!detectedIntentsResolved.includes('demande_suivi')) {
        detectedIntentsResolved.unshift('demande_suivi');
      }
      // Le suivi ne doit pas declencher un devis
      const idxDevisSuivi = detectedIntentsResolved.indexOf('demande_devis');
      if (idxDevisSuivi !== -1) {
        detectedIntentsResolved.splice(idxDevisSuivi, 1);
      }
    }

    // Le regex essaie aussi
    const regexExtracted = this.extractFields(normalizedMessage);
    // Le code FUSIONNE les deux
    const extractionPipeline = this.runHybridExtractionPipeline({
      normalizedMessage,
      intent,
      previousData: state.collected_data,
      aiExtracted,
      regexExtracted,
    });
    // FIX-1: sessionState persistant pour ne jamais redemander les infos deja donnees.
    const sessionState = this.extractFromMessage(normalizedMessage, {
      ...state.sessionState,
    });

    // Le nom vient UNIQUEMENT du pipeline hybride, qui a deja valide le candidat
    // (IA + regex + historique) avec isLikelyName. On ne court-circuite plus avec
    // le nom brut de l'IA, qui peut etre une hallucination (ex: "Client Renovation Cuisine").
    if (extractionPipeline.collectedData.nom) {
      sessionState.nom = extractionPipeline.collectedData.nom;
    }
    if (!sessionState.telephone && extractionPipeline.collectedData.telephone) {
      sessionState.telephone = extractionPipeline.collectedData.telephone;
    }
    if (!sessionState.email && extractionPipeline.collectedData.email) {
      sessionState.email = extractionPipeline.collectedData.email;
    }
    // Mémorise / maintient le parcours rendez-vous entre les messages.
    if (detectedIntentsResolved.includes('demande_rdv')) {
      sessionState.pendingRdv = true;
    }
    // Mémorise / maintient le parcours suivi entre les messages.
    // Sauf pour les questions informatives ("comment suivre un chantier ?")
    // qui doivent aller au RAG, pas au suivi personnel.
    if (detectedIntentsResolved.includes('demande_suivi') && !isHowToQuestion) {
      sessionState.pendingSuivi = true;
    }
    const mergedCollectedData = {
      nom: extractionPipeline.collectedData.nom || sessionState.nom || '',
      telephone:
        sessionState.telephone ||
        extractionPipeline.collectedData.telephone ||
        '',
      email: sessionState.email || extractionPipeline.collectedData.email || '',
      description: this.pickBestDescriptionForConversation({
        previousDescription: state.collected_data.description,
        extractedDescription: extractionPipeline.collectedData.description,
        message: normalizedMessage,
      }),
    };

    const projectMatchFromMessage = this.matchProjectTypeWithConfidence(
      normalizedMessage,
      projectTypeNames,
    );
    const projectMatchFromAi = this.matchProjectTypeFromHintWithConfidence(
      extractionPipeline.projectTypeHint,
      projectTypeNames,
    );
    const projectMatchCandidate = this.pickBestProjectTypeCandidate({
      fromMessage: projectMatchFromMessage,
      fromHint: projectMatchFromAi,
    });
    // FIX-2: verrouillage du type de projet a la premiere mention (pas d ecrasement sans confirmation explicite).
    const explicitProjectTypeChange = this.extractExplicitProjectTypeChange(
      normalizedMessage,
      projectTypeNames,
    );
    const hasQuoteKeyword =
      /(devis|estimation|chiffrage|proposition commerciale)/i.test(
        normalizedMessage,
      );
    const quoteIntentSignal = intent === 'demande_devis' || hasQuoteKeyword;
    let awaitingProjectTypeChangeConfirmation =
      state.awaitingProjectTypeChangeConfirmation;
    let pendingProjectType = state.pendingProjectType;

    // "AUTRE" n'est pas un vrai type : on le considère comme "pas encore défini".
    const hasRealProjectType =
      Boolean(sessionState.projectType) && sessionState.projectType !== 'AUTRE';
    // En parcours rendez-vous, on ne verrouille aucun type de projet.
    const isRdvContext = detectedIntentsResolved.includes('demande_rdv');
    if (explicitProjectTypeChange) {
      sessionState.projectType = explicitProjectTypeChange;
      awaitingProjectTypeChangeConfirmation = false;
      pendingProjectType = null;
    } else if (
      !isRdvContext &&
      !hasRealProjectType &&
      projectMatchCandidate.known &&
      quoteIntentSignal
    ) {
      sessionState.projectType = projectMatchCandidate.projectType;
    } else if (
      !isRdvContext &&
      !hasRealProjectType &&
      quoteIntentSignal &&
      projectMatchCandidate.suggestedType
    ) {
      // Evite de verrouiller un faux type inconnu trop tot.
      // On garde uniquement une suggestion raisonnable si elle existe.
      sessionState.projectType = projectMatchCandidate.suggestedType;
    } else if (
      !isRdvContext &&
      !hasRealProjectType &&
      (state.currentGuidedStep ?? 0) > 0 &&
      projectMatchCandidate.suggestedType
    ) {
      // FIX: en parcours devis guidé, si le client donne un type reconnu
      // (ex: "peinture" -> "Peinture / Décoration"), on le verrouille.
      sessionState.projectType = projectMatchCandidate.suggestedType;
    }
    let projectTypeConflict = false;
    const hasExplicitTypeChangeSignal =
      /\b(changer|change|finalement|plutot|au lieu|remplacer|modifier)\b/i.test(
        normalizedMessage,
      );
    if (
      sessionState.projectType &&
      projectMatchCandidate.known &&
      projectMatchCandidate.projectType !== sessionState.projectType &&
      hasExplicitTypeChangeSignal
    ) {
      projectTypeConflict = true;
      pendingProjectType = projectMatchCandidate.projectType;
      awaitingProjectTypeChangeConfirmation = true;
    } else if (
      sessionState.projectType &&
      projectMatchCandidate.known &&
      projectMatchCandidate.projectType !== sessionState.projectType &&
      !hasExplicitTypeChangeSignal
    ) {
      // Evite la question "Souhaitez-vous changer ?" sans demande explicite client.
      awaitingProjectTypeChangeConfirmation = false;
      pendingProjectType = null;
    }

    const projectType = sessionState.projectType || 'AUTRE';

    const projectTypeKnown = projectTypes.some(
      (type) => type.nom === projectType,
    );
    const projectTypeConfidence = projectTypeKnown
      ? Math.max(projectMatchCandidate.confidence, 0.72)
      : projectMatchCandidate.confidence;

    const projectMatch = {
      known: projectTypeKnown,
      projectType: projectTypeKnown ? projectType : '',
      suggestedType:
        projectMatchCandidate.suggestedType ||
        (projectTypeKnown ? projectType : null),
      confidence: Number(projectTypeConfidence.toFixed(3)),
    };
    if ((state.currentGuidedStep ?? 0) > 0 && projectMatch.known) {
      const idxService = detectedIntentsResolved.indexOf('demande_service');
      if (idxService !== -1) {
        detectedIntentsResolved.splice(idxService, 1);
      }
      const idxInfoService = detectedIntentsResolved.indexOf(
        'demande_info_service' as CommercialIntent,
      );
      if (idxInfoService !== -1) {
        detectedIntentsResolved.splice(idxInfoService, 1);
      }
      if (!detectedIntentsResolved.includes('demande_devis')) {
        detectedIntentsResolved.unshift('demande_devis');
      }
    }

    const isAffirmative = this.isAffirmative(normalizedMessage);
    
    const isModificationRequest = this.isModificationRequest(normalizedMessage);
    const awaitingConfirmation = false;
    const awaitingEstimateChoice = false;
    const guidedAnswers = { ...state.guidedAnswers };
    // FIX: maintenir le contexte du parcours devis entre les messages.
    // On récupère le step mémorisé, et on le passe à 1 dès qu'on entre en parcours
    // devis sans type de projet encore défini (le bot va demander le type).
    let currentGuidedStep = state.currentGuidedStep ?? 0;
    const inDevisFlow =
      intent === 'demande_devis' ||
    detectedIntentsResolved.includes('demande_devis');
    if (inDevisFlow && !sessionState.projectType) {
      currentGuidedStep = 1;
    } else if (sessionState.projectType) {
      currentGuidedStep = Math.max(currentGuidedStep, 1);
}
    let checklistCompleted = false;
    const isUrgent =
      sessionState.urgent ||
      state.isUrgent ||
      Boolean(aiExtracted?.isUrgent) ||
      this.isUrgentMessage(normalizedMessage);
    sessionState.urgent = isUrgent;

    let summarySent = state.summarySent;
    let devisId = state.devisId;
    const guidedQuestion: AssistantResult['guided_question'] = null;
    let checklistForResponse: string[] | undefined;
    let structuredWorkflowForResponse: AssistantResult['structured_workflow'];
    const missingFields = this.getMissingFields(
      sessionState,
      mergedCollectedData,
    );
    const devisQualificationMissingFields =
      this.getDevisQualificationMissingFields(
        sessionState,
        mergedCollectedData,
      );

    // FIX-5: ne pas bloquer sur le nom si le client pose d abord une question service.
    const serviceOnlyRequest =
      (intent === 'demande_info_service' ||
        detectedIntentsResolved.includes('demande_service')) &&
      !detectedIntentsResolved.includes('demande_devis');

    const lowConfidenceClarification = this.buildLowConfidenceClarification({
      message: normalizedMessage,
      intent: intentDetection,
      projectTypeConfidence: projectTypeConfidence,
      suggestedProjectType: projectMatch.suggestedType,
      detectedIntents: detectedIntentsResolved,
    });

    const ragRetrieval = await this.assistantRagService.retrieveContext({
      companyId: dto.companyId,
      query: normalizedMessage,
      intent,
      projectType: projectMatch.known ? projectType : undefined,
      limit: 4,
    });
    let responseMessage = '';
    let answeredByRag = false;

    // Si le client a deja confirme une demande mais exprime une NOUVELLE intention
    // (rendez-vous, nouveau devis, suivi), on repart sur un nouveau parcours
    // tout en gardant ses infos (nom, telephone, email).
    const expressesNewIntent =
      detectedIntentsResolved.includes('demande_rdv') ||
      detectedIntentsResolved.includes('demande_devis') ||
      detectedIntentsResolved.includes('demande_suivi') ||
      /\b(rendez[\s-]?vous|rdv|devis|suivi|suivre)\b/i.test(normalizedMessage);
    if (sessionState.confirmed && expressesNewIntent) {
      sessionState.confirmed = false;
      sessionState.pendingSuivi = false;
      summarySent = false;
      // Detection rdv renforcee (intention OU mots-cles)
      const wantsRdvNow =
        detectedIntentsResolved.includes('demande_rdv') ||
        /\b(rendez[\s-]?vous|rdv)\b/i.test(normalizedMessage);
      if (wantsRdvNow) {
        // On force le parcours rdv et on efface le projet du devis precedent.
        sessionState.projectType = null;
        if (!detectedIntentsResolved.includes('demande_rdv')) {
          detectedIntentsResolved.unshift('demande_rdv');
        }
        const idxDevisNew = detectedIntentsResolved.indexOf('demande_devis');
        if (idxDevisNew !== -1) {
          detectedIntentsResolved.splice(idxDevisNew, 1);
        }
        sessionState.pendingRdv = true;
      }

    }
    // Politesse pure (merci, d'accord, ok...) : on repond simplement, sans relancer.
    // On normalise le message pour gerer l'apostrophe (d'accord -> d accord)
    const politeNorm = normalizedMessage
      .toLowerCase()
      .replace(/['’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Le message est-il UNIQUEMENT compose de mots de politesse ?
    const politeWords = [
      'merci', 'd', 'accord', 'ok', 'okay', 'parfait', 'super',
      'tres', 'bien', 'c', 'est', 'bon', 'nickel', 'genial', 'cool',
      'au', 'revoir', 'bonne', 'journee', 'a', 'bientot', 'beaucoup',
    ];
    const tokensPolite = politeNorm.split(' ').filter((w) => w.length > 0);
    const isPolitenessOnly =
      tokensPolite.length > 0 &&
      tokensPolite.every((w) => politeWords.includes(w));
    if (isPolitenessOnly) {
      responseMessage = 'Avec plaisir ! 😊 Bonne journee et a bientot.';
    } else if (
      /dem-[a-z0-9]{4,10}/i.test(normalizedMessage) ||
      (sessionState.pendingSuivi &&
        !isInformationalQuestion &&
        !/\b(devis|rendez[\s-]?vous|rdv|prix|tarif)\b/i.test(normalizedMessage))
    ) {
      // ========== PARCOURS SUIVI (PRIORITAIRE) ==========
      // Une reference DEM-XXX (ou un suivi en cours) => on va au suivi directement,
      // quel que soit l'etat de session (client qui tape la reference sans "bonjour").
      const suiviDirect = await this.buildSuiviResponse({
        companyId: dto.companyId,
        message: normalizedMessage,
        email: sessionState.email,
      });
      if (suiviDirect) {
        responseMessage = suiviDirect;
        answeredByRag = true; // reutilise le flag pour bloquer la liste des projets
      } else {
        responseMessage =
          "Bien sur, je peux verifier l'avancement de votre demande. 📋\n" +
          "Donnez-moi votre reference de suivi ou l'email utilise lors de votre demande.";
      }
    } else if (
      isInformationalQuestion &&
      ragRetrieval.snippets.length > 0 &&
      ragRetrieval.snippets[0].score >= 0.4
    )
      {
      // ========== REPONSE DIRECTE PAR LE RAG (PRIORITAIRE) ==========
      // Question informative + document pertinent => on repond avec le RAG complet,
      // avant toute autre logique (clarification, parcours devis...).
      responseMessage = ragRetrieval.snippets[0].fullText
        .replace(/^Document RAG:\s*[^.]*\.\s*/i, '')
        .replace(/^Cat[ée]gorie:\s*[^.]*\.\s*/i, '')
        .replace(/\s*Mots-cles\s*:.*$/is, '')
        .trim();
      answeredByRag = true;
    } else if (wantsHuman) {
      // ========== DEMANDE DE CONTACT HUMAIN ==========
      // Le client veut parler a quelqu'un : on collecte ses coordonnees
      // via le parcours rdv existant (deja teste et valide).
      sessionState.pendingRdv = true;
      responseMessage =
        'Bien sûr, je comprends ! 😊 Notre équipe peut vous recontacter directement.\n' +
        'Pour cela, donnez-moi simplement :\n' +
        '- Votre nom complet\n' +
        '- Votre téléphone\n' +
        '- Votre email';
      answeredByRag = true; // pas de liste des projets derriere ce message
    } else if (
      isInformationalQuestion &&
      !mentionsSuiviDirect &&
      !sessionState.pendingRdv &&
      !sessionState.pendingSuivi
    ) {
      // ========== FALLBACK RAG : "JE NE SAIS PAS" ==========
      // Question informative mais AUCUN document pertinent (score < 0.4) :
      // reponse honnete + proposition de recontact par un conseiller.
      sessionState.pendingRdv = true;
      responseMessage =
        "Je n'ai pas d'information précise sur ce point dans ma base. 🤔\n" +
        'Mais notre équipe peut vous répondre directement ! Souhaitez-vous être recontacté ?\n' +
        'Si oui, donnez-moi simplement votre nom, votre téléphone et votre email.';
      answeredByRag = true; // pas de liste des projets derriere
    } else if (sessionState.confirmed) {
      responseMessage = this.buildClosureMessage(sessionState);
    } else if (awaitingProjectTypeChangeConfirmation && pendingProjectType) {
      if (isAffirmative) {
        sessionState.projectType = pendingProjectType;
        awaitingProjectTypeChangeConfirmation = false;
        pendingProjectType = null;
        responseMessage =
          "C'est note ! J'ai mis a jour le type de projet. On continue ensemble 👍";
      } else if (isModificationRequest) {
        awaitingProjectTypeChangeConfirmation = false;
        pendingProjectType = null;
        responseMessage =
          'Pas de souci, on garde le type de projet initial. Continuons !';
      } else {
        responseMessage = `J'ai detecte un nouveau type de projet "${pendingProjectType}". Souhaitez-vous changer ? (Oui / Non)`;
      }
    } else if (summarySent) {
      if (isAffirmative) {
        sessionState.confirmed = true;
        responseMessage = this.buildClosureMessage(sessionState);
      } else if (isModificationRequest) {
        summarySent = false;
        responseMessage =
          'Aucun probleme ! Dites-moi simplement ce que vous souhaitez modifier et je mets a jour.';
      } else {
        responseMessage =
          'Tout est bon pour vous ? Repondez "Oui" pour confirmer ou dites-moi ce que vous voulez changer.';
      }
    } else if (
      lowConfidenceClarification &&
      !detectedIntentsResolved.includes('demande_rdv') &&
      !detectedIntentsResolved.includes('demande_suivi') &&
      !((state.currentGuidedStep ?? 0) > 0 && !state.checklistCompleted)
    ) {
      responseMessage = lowConfidenceClarification;
    } else {
      // ========== REPONSE INTELLIGENTE ET CONTEXTUELLE ==========
      responseMessage = await this.buildSmartResponse({
        normalizedMessage,
        language,
        intent,
        detectedIntents: detectedIntentsResolved,
        serviceOnlyRequest,
        projectType,
        projectMatch,
        projectTypeConflict,
        pendingProjectType,
        sessionState,
        previousSessionState,
        mergedCollectedData,
        missingFields,
        isUrgent,
        companyId: dto.companyId,
        projectTypes,
      });

      responseMessage = this.enrichResponseWithRagContext({
        responseMessage,
        snippets: ragRetrieval.snippets,
        language,
        intent,
        detectedIntents: detectedIntentsResolved,
        serviceOnlyRequest,
      });

      const shouldExposeChecklist =
        (intent === 'demande_devis' ||
          detectedIntentsResolved.includes('demande_devis')) &&
        projectMatch.known &&
        Boolean(sessionState.projectType);

      if (shouldExposeChecklist) {
        checklistForResponse = await this.buildDevisChecklistItems({
          companyId: dto.companyId,
          projectType: sessionState.projectType || projectType,
        });
        structuredWorkflowForResponse =
          await this.buildStructuredWorkflowPreview({
            companyId: dto.companyId,
            projectType: sessionState.projectType || projectType,
          });
      }

      // Verifier si on peut passer au recapitulatif
      if (
        devisQualificationMissingFields.length === 0 &&
        sessionState.projectType &&
        !serviceOnlyRequest &&
        intent !== 'demande_info_service' &&
        (intent === 'demande_devis' ||
          detectedIntentsResolved.includes('demande_devis'))
      ) {
        summarySent = true;
        checklistCompleted = true;
        responseMessage = this.buildSummary(
          sessionState,
          mergedCollectedData.description,
        );
      }
    }

    const shouldExposeProjectTypes =
      !answeredByRag &&
      // Jamais de liste si le projet est deja identifie, ou pendant les
      // parcours rdv/suivi, ou pendant la collecte guidee des coordonnees :
      // la liste ne sert qu'au moment de CHOISIR un type de projet.
      !sessionState.projectType &&
      !sessionState.pendingRdv &&
      !sessionState.pendingSuivi &&
      !sessionState.confirmed &&
      (intent === 'demande_info_service' ||
        (intent === 'demande_devis' && !projectMatch.known));
    // ========== FILTRE DE SORTIE (dernier filet de securite) ==========
    // Scanne la reponse finale : si un contenu sensible s'est glisse
    // (montant, marge, cout interne, message de configuration...),
    // on le journalise et on remplace par un message sur.
    const sensitiveCheck = checkSensitiveOutput(responseMessage);
    if (!sensitiveCheck.safe) {
      this.logger.error(
        `Filtre de sortie : contenu sensible bloque (${sensitiveCheck.reasons.join(', ')}) - message remplace avant envoi`,
      );
      responseMessage =
        'Je ne peux pas communiquer cette information ici. 😊 Pour une réponse précise et personnalisée, notre équipe peut vous recontacter : souhaitez-vous me laisser vos coordonnées ?';
    }
    const result: AssistantResult = {
      intent,
      detected_intents: detectedIntentsResolved,
      intent_confidence: Number(intentDetection.confidence.toFixed(3)),
      project_type_confidence: Number(projectTypeConfidence.toFixed(3)),
      intent_ranking: intentDetection.ranking,
      confidence: {
        intent: Number(intentDetection.confidence.toFixed(3)),
        project_type: Number(projectTypeConfidence.toFixed(3)),
        extraction: {
          nom: extractionPipeline.audit.nom.confidence,
          telephone: extractionPipeline.audit.telephone.confidence,
          email: extractionPipeline.audit.email.confidence,
          description: extractionPipeline.audit.description.confidence,
        },
        overall: this.computeOverallConfidence({
          intentConfidence: intentDetection.confidence,
          projectTypeConfidence,
          extractionAudit: extractionPipeline.audit,
        }),
      },
      client_need_summary: '',
      extracted_entities: {
        nom: mergedCollectedData.nom,
        telephone: mergedCollectedData.telephone,
        email: mergedCollectedData.email,
        description: mergedCollectedData.description,
        requested_service: projectMatch.known
          ? projectType
          : projectMatch.suggestedType || '',
        quantity: this.extractRequestedQuantity(normalizedMessage),
        urgence: isUrgent,
        demande_rdv: detectedIntentsResolved.includes('demande_rdv'),
        demande_suivi: detectedIntentsResolved.includes('demande_suivi'),
        demande_validation:
          detectedIntentsResolved.includes('demande_validation'),
      },
      existing_project_match: projectMatch.known,
      project_to_create_if_not_found: {
        status: projectMatch.known
          ? 'not_required'
          : 'create_pending_project_type',
        nom: projectMatch.known
          ? ''
          : this.buildPendingProjectName(
              projectMatch.suggestedType,
              mergedCollectedData.description || normalizedMessage,
            ),
        description_courte: projectMatch.known
          ? ''
          : this.buildPendingProjectDescription(
              mergedCollectedData.description || normalizedMessage,
            ),
      },
      quote_action: {
        status: 'not_required',
        details: 'Aucune action devis necessaire pour cette demande.',
      },
      checklist_action: {
        status: 'not_required',
        details: 'Aucune checklist necessaire pour cette demande.',
      },
      technical_validation_action: {
        status: 'not_required',
        details: 'Aucune validation technico-commerciale necessaire.',
      },
      email_action: {
        status: 'not_required',
        details: 'Aucun email client a envoyer pour le moment.',
      },
      needs_clarification: Boolean(lowConfidenceClarification),
      clarification_question: lowConfidenceClarification || '',
      project_type: projectType,
      is_known_project: projectMatch.known,
      missing_fields: [...missingFields],
      project_types: shouldExposeProjectTypes
        ? projectTypes.map((projectTypeItem) => ({
            id: projectTypeItem.id,
            nom: projectTypeItem.nom,
            description: projectTypeItem.description,
          }))
        : undefined,
      collected_data: mergedCollectedData,
      extraction_audit: extractionPipeline.audit,
      response_message: responseMessage,
      guided_question: guidedQuestion,
      checklist: checklistForResponse,
      structured_workflow: structuredWorkflowForResponse,
      is_urgent: isUrgent,
      devis_id: devisId,
      rag_sources: ragRetrieval.snippets.map((snippet) => ({
        source_type: snippet.sourceType,
        title: snippet.title,
        score: snippet.score,
      })),
    };

    const commercialWorkflow = this.buildCommercialWorkflowPayload({
      detectedIntents: detectedIntentsResolved,
      message: normalizedMessage,
      projectMatchKnown: projectMatch.known,
      projectType,
      suggestedType: projectMatch.suggestedType,
      collectedData: mergedCollectedData,
      missingFields,
      checklistCompleted,
      isUrgent,
      technicalValidationApproved:
        detectedIntentsResolved.includes('demande_validation') &&
        this.isAffirmative(normalizedMessage),
    });

    result.client_need_summary = commercialWorkflow.client_need_summary;
    result.quote_action = commercialWorkflow.quote_action;
    result.checklist_action = commercialWorkflow.checklist_action;
    result.technical_validation_action =
      commercialWorkflow.technical_validation_action;
    result.email_action = commercialWorkflow.email_action;
    result.needs_clarification =
      Boolean(lowConfidenceClarification) ||
      commercialWorkflow.needs_clarification;
    result.clarification_question =
      lowConfidenceClarification || commercialWorkflow.clarification_question;

    const technicoDescription = this.buildTechnicoProspectDescription({
      previousDescription: state.collected_data.description,
      extractedDescription: mergedCollectedData.description,
      currentMessage: normalizedMessage,
      detectedIntents: detectedIntentsResolved,
    });

    const missingContactFields =
      this.getMissingContactFields(mergedCollectedData);
    let registrationMissingFields = this.getRegistrationMissingFields({
      collectedData: mergedCollectedData,
      projectType: sessionState.projectType || projectType,
    });
    // En parcours rendez-vous, le type de projet n'est pas requis pour enregistrer.
    const isRdvRegistration =
      detectedIntentsResolved.includes('demande_rdv') &&
      !detectedIntentsResolved.includes('demande_devis');
    if (isRdvRegistration) {
      registrationMissingFields = registrationMissingFields.filter(
        (field) => field !== 'projectType',
      );
    }
    const hasCommercialIntent =
      intent === 'demande_devis' ||
      detectedIntentsResolved.includes('demande_devis') ||
      detectedIntentsResolved.includes('demande_prix') ||
      detectedIntentsResolved.includes('demande_rdv');
    // On ne cree le prospect qu'APRES confirmation (le "oui"), pour les devis.
    // Les rdv n'exigent pas de confirmation (creation directe apres infos).
    const isRdvRegistrationFlow =
      detectedIntentsResolved.includes('demande_rdv') &&
      !detectedIntentsResolved.includes('demande_devis');
    const confirmationOk = sessionState.confirmed || isRdvRegistrationFlow;
    const shouldUpsertProspect =
      hasCommercialIntent &&
      registrationMissingFields.length === 0 &&
      confirmationOk;
    let prospectId: number | null = null;
    if (shouldUpsertProspect) {
      prospectId = await this.upsertChatbotProspect({
        companyId: dto.companyId,
        collectedData: mergedCollectedData,
        projectType: projectType,
        isKnownProject: projectMatch.known,
        projectTypes,
        notesOverride: technicoDescription,
        isRdv:
          detectedIntentsResolved.includes('demande_rdv') &&
          !detectedIntentsResolved.includes('demande_devis'),
      });
    }

    if (
      shouldUpsertProspect &&
      projectMatch.known &&
      prospectId &&
      !devisId &&
      (intent === 'demande_devis' ||
        detectedIntentsResolved.includes('demande_devis'))
    ) {
      const actorUserId = await this.findInternalActorUserId(dto.companyId);
      if (actorUserId) {
        const draftResult = await this.createOrReuseAssistantDraftDevis({
          companyId: dto.companyId,
          actorUserId,
          prospectId,
          description: technicoDescription || mergedCollectedData.description,
          typeProjetId:
            projectTypes.find((type) => type.nom === projectType)?.id ?? null,
        });
        if (draftResult) {
          devisId = draftResult.devisId;
          sessionState.lastReference = draftResult.reference ?? null;
          if (isAffirmative && sessionState.confirmed) {
            // On regenere le message AVEC la reference, et on met a jour le resultat.
            responseMessage = this.buildClosureMessage(sessionState);
            result.response_message = responseMessage;
          }
        }
      }
    }

    result.devis_id = devisId;
    result.is_urgent = isUrgent;

    const futureProjectSignal = this.buildFutureProjectSignal({
      isKnownProject: projectMatch.known,
      suggestedType: projectMatch.suggestedType,
      normalizedMessage,
      collectedData: mergedCollectedData,
      sessionId,
      motsCles:
        aiExtracted?.motsCles && aiExtracted.motsCles.length > 0
          ? aiExtracted.motsCles
          : this.extractKeywords(normalizedMessage),
    });

    if (futureProjectSignal) {
      await this.registerFutureServiceInRegistry({
        companyId: dto.companyId,
        sessionId,
        signal: futureProjectSignal,
      });
    }
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        clientNom: mergedCollectedData.nom || null,
        clientTelephone: mergedCollectedData.telephone || null,
        clientEmail: mergedCollectedData.email || null,
        besoinStructure: {
          collected_data: mergedCollectedData,
          session_state: sessionState,
          intent,
          project_type: projectType,
          is_known_project: projectMatch.known,
          suggested_project_type: projectMatch.suggestedType ?? null,
          missing_fields: missingFields,
          registration_missing_fields: registrationMissingFields,
          prospect_id: prospectId,
          prospect_saved: prospectId !== null,
          awaiting_confirmation: awaitingConfirmation,
          awaiting_estimate_choice: awaitingEstimateChoice,
          guided_answers: guidedAnswers,
          current_guided_step: currentGuidedStep,
          checklist_completed: checklistCompleted,
          is_urgent: isUrgent,
          devis_id: devisId,
          summary_sent: summarySent,
          pending_project_type: pendingProjectType,
          awaiting_project_type_change_confirmation:
            awaitingProjectTypeChangeConfirmation,
          future_project_signal: futureProjectSignal,
          language,
          updated_at: new Date().toISOString(),
        },
      },
    });

    await this.prisma.messageChat.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        contenu: result.response_message,
        nlpResultat: result,
      },
    });

    return result;
  }

  async getProspects(companyId: number) {
    const prospects = await this.prisma.client.findMany({
      where: {
        companyId,
        source: LeadSource.CHATBOT,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        nom: true,
        prenom: true,
        telephone: true,
        email: true,
        besoin: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        demandesDevis: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            statut: true,
            createdAt: true,
            devis: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                reference: true,
                statut: true,
                createdAt: true,
              },
            },
          },
        },
        typeProjet: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    const items = prospects.map((prospect) => {
      const latestDemande = prospect.demandesDevis[0] ?? null;
      const latestDevis = latestDemande?.devis[0] ?? null;

      return {
        id: prospect.id,
        nom: prospect.nom,
        prenom: prospect.prenom,
        telephone: prospect.telephone,
        email: prospect.email,
        besoin: prospect.besoin,
        notes: prospect.notes,
        createdAt: prospect.createdAt,
        updatedAt: prospect.updatedAt,
        typeProjet: prospect.typeProjet,
        latestDemandeDevis: latestDemande
          ? {
              id: latestDemande.id,
              statut: latestDemande.statut,
              createdAt: latestDemande.createdAt,
            }
          : null,
        latestDevis: latestDevis
          ? {
              id: latestDevis.id,
              reference: latestDevis.reference,
              statut: latestDevis.statut,
              createdAt: latestDevis.createdAt,
            }
          : null,
      };
    });

    return {
      total: items.length,
      items,
    };
  }

  async qualifyProspect(input: {
    prospectId: number;
    companyId: number;
    actorUserId: number;
    description?: string;
    createDevisDraft?: boolean;
  }) {
    const prospect = await this.prisma.client.findFirst({
      where: {
        id: input.prospectId,
        companyId: input.companyId,
        source: LeadSource.CHATBOT,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        notes: true,
        typeProjetId: true,
        demandesDevis: {
          where: {
            source: LeadSource.CHATBOT,
            statut: {
              in: ['NOUVEAU', 'EN_COURS'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            statut: true,
            description: true,
          },
        },
      },
    });

    if (!prospect) {
      throw new NotFoundException(
        'Prospect chatbot introuvable pour cette societe',
      );
    }

    const finalDescription =
      input.description?.trim() ||
      prospect.notes?.trim() ||
      `Demande qualifiee depuis assistant IA pour ${prospect.prenom ? `${prospect.prenom} ` : ''}${prospect.nom}`;

    if (!finalDescription || finalDescription.length < 8) {
      throw new BadRequestException(
        'Description insuffisante pour qualifier le prospect en demande devis',
      );
    }

    const existingOpenDemande = prospect.demandesDevis[0];
    const demande =
      existingOpenDemande &&
      this.normalizeForMatch(existingOpenDemande.description) ===
        this.normalizeForMatch(finalDescription)
        ? await this.prisma.demandeDevis.findUnique({
            where: { id: existingOpenDemande.id },
            select: {
              id: true,
              statut: true,
              description: true,
              createdAt: true,
            },
          })
        : await this.prisma.demandeDevis.create({
            data: {
              companyId: input.companyId,
              clientId: prospect.id,
              createurId: input.actorUserId,
              source: LeadSource.CHATBOT,
              description: finalDescription,
              besoinStructure: {
                origin: 'assistant-ia',
                qualified_by_user_id: input.actorUserId,
                qualified_at: new Date().toISOString(),
                prospect_id: prospect.id,
              },
              statut: 'EN_COURS',
              reference: this.generateReference(),
            },
            select: {
              id: true,
              statut: true,
              description: true,
              createdAt: true,
            },
          });

    if (!demande) {
      throw new NotFoundException(
        'Impossible de recuperer la demande qualifiee',
      );
    }

    const shouldCreateDraft = input.createDevisDraft ?? true;

    if (!prospect.typeProjetId && shouldCreateDraft) {
      throw new BadRequestException(
        'Type de projet non disponible. Generation de devis brouillon impossible.',
      );
    }

    const devis = shouldCreateDraft
      ? await this.devisService.create(
          {
            clientId: prospect.id,
            demandeDevisId: demande.id,
            notes:
              'Devis brouillon initie automatiquement depuis la qualification assistant IA.',
          },
          input.actorUserId,
          input.companyId,
        )
      : null;

    const autoGeneration = devis
      ? await this.autoPopulateDraftDevisFromCatalogue({
          devisId: devis.id,
          companyId: input.companyId,
          typeProjetId: prospect.typeProjetId,
        })
      : {
          attempted: false,
          lignesAjoutees: 0,
          skippedBecauseExistingLines: false,
          source: 'none',
        };

    return {
      prospectId: prospect.id,
      demandeDevis: {
        id: demande.id,
        statut: demande.statut,
        description: demande.description,
        createdAt: demande.createdAt,
      },
      devisBrouillon: devis
        ? {
            id: devis.id,
            reference: devis.reference,
            statut: devis.statut,
            createdAt: devis.createdAt,
          }
        : null,
      autoGeneration,
    };
  }
  async findPotentialDuplicates(input: {
    companyId: number;
    email?: string;
    telephone?: string;
    excludeProspectId?: number;
  }) {
    const normalizedEmail = (input.email ?? '').trim().toLowerCase();
    const normalizedPhone = (input.telephone ?? '').replace(/\D/g, '');

    // Rien d'exploitable : pas de recherche (evite les faux positifs massifs)
    if (!normalizedEmail && normalizedPhone.length < 8) {
      return { duplicates: [] };
    }

    // 1) La base filtre LARGE : candidats par email exact (insensible casse)
    //    ou par telephone contenant la fin du numero normalise.
    const orConditions: object[] = [];
    if (normalizedEmail) {
      orConditions.push({ email: { equals: normalizedEmail, mode: 'insensitive' } });
    }
    if (normalizedPhone.length >= 8) {
      orConditions.push({ telephone: { contains: normalizedPhone.slice(-8) } });
    }

    const candidates = await this.prisma.client.findMany({
      where: {
        companyId: input.companyId,
        ...(input.excludeProspectId
          ? { id: { not: input.excludeProspectId } }
          : {}),
        OR: orConditions,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
        source: true,
        createdAt: true,
      },
      take: 10,
    });

    // 2) Le code verifie EXACTEMENT (normalisation des deux cotes = zero faux positif)
    const duplicates = candidates
      .map((c) => {
        const matchedOn: string[] = [];
        if (
          normalizedEmail &&
          (c.email ?? '').trim().toLowerCase() === normalizedEmail
        ) {
          matchedOn.push('email');
        }
        if (
          normalizedPhone.length >= 8 &&
          (c.telephone ?? '').replace(/\D/g, '') === normalizedPhone
        ) {
          matchedOn.push('telephone');
        }
        return { ...c, matchedOn };
      })
      .filter((c) => c.matchedOn.length > 0);

    return { duplicates };
  }
  async updateProspectNotes(input: {
    prospectId: number;
    companyId: number;
    notes: string;
  }) {
    const prospect = await this.prisma.client.findFirst({
      where: {
        id: input.prospectId,
        companyId: input.companyId,
        source: LeadSource.CHATBOT,
      },
      select: { id: true },
    });

    if (!prospect) {
      throw new NotFoundException(
        'Prospect chatbot introuvable pour cette societe',
      );
    }

    await this.prisma.client.update({
      where: { id: input.prospectId },
      data: { notes: input.notes.slice(0, 2000) },
    });

    return { status: 'updated' };
  }
  async rejectProspect(input: {
    prospectId: number;
    companyId: number;
  }) {
    const prospect = await this.prisma.client.findFirst({
      where: {
        id: input.prospectId,
        companyId: input.companyId,
        source: LeadSource.CHATBOT,
      },
      select: { id: true },
    });

    if (!prospect) {
      throw new NotFoundException(
        'Prospect chatbot introuvable pour cette societe',
      );
    }

    // On marque PERDU les demandes ouvertes de ce prospect (rejet = trace conservee)
    const updated = await this.prisma.demandeDevis.updateMany({
      where: {
        clientId: input.prospectId,
        companyId: input.companyId,
        statut: { in: ['NOUVEAU', 'EN_COURS'] },
      },
      data: { statut: 'PERDU' },
    });

    return { status: 'rejected', demandesRejetees: updated.count };
  }
  async removeProspect(input: {
    prospectId: number;
    currentUser: CurrentUserPayload;
  }) {
    const prospect = await this.prisma.client.findFirst({
      where: {
        id: input.prospectId,
        companyId: input.currentUser.companyId,
        source: LeadSource.CHATBOT,
      },
      select: {
        id: true,
      },
    });

    if (!prospect) {
      throw new NotFoundException(
        'Prospect chatbot introuvable pour cette societe',
      );
    }

    await this.clientsService.remove(prospect.id, input.currentUser);

    return {
      prospectId: prospect.id,
      deleted: true,
    };
  }
  async saveFeedback(input: {
    companyId: number;
    sessionId?: number;
    messageExcerpt?: string;
    rating: string;
  }) {
    const feedback = await this.prisma.assistantFeedback.create({
      data: {
        companyId: input.companyId,
        sessionId: input.sessionId ?? null,
        messageExcerpt: (input.messageExcerpt || '').slice(0, 300) || null,
        rating: input.rating,
      },
    });
    return { id: feedback.id, status: 'saved' };
  }
  private async autoPopulateDraftDevisFromCatalogue(input: {
    devisId: number;
    companyId: number;
    typeProjetId: number | null;
  }): Promise<{
    attempted: boolean;
    lignesAjoutees: number;
    skippedBecauseExistingLines: boolean;
    source:
      | 'type-projet-categories'
      | 'type-projet-name-match'
      | 'company-fallback'
      | 'none';
  }> {
    const existingLinesCount = await this.prisma.ligneDevis.count({
      where: { devisId: input.devisId },
    });

    if (existingLinesCount > 0) {
      return {
        attempted: true,
        lignesAjoutees: 0,
        skippedBecauseExistingLines: true,
        source: 'none',
      };
    }

    const candidates = await this.findSuggestedPrestationsForAutoDraft({
      companyId: input.companyId,
      typeProjetId: input.typeProjetId,
    });

    if (candidates.length === 0) {
      return {
        attempted: true,
        lignesAjoutees: 0,
        skippedBecauseExistingLines: false,
        source: 'none',
      };
    }

    let ordre = 0;
    for (const prestation of candidates) {
      await this.devisService.addLigne(
        input.devisId,
        {
          prestationId: prestation.id,
          quantite: 1,
          ordre,
        },
        input.companyId,
      );
      ordre += 1;
    }

    return {
      attempted: true,
      lignesAjoutees: candidates.length,
      skippedBecauseExistingLines: false,
      source: candidates[0]?.source ?? 'none',
    };
  }

  private async findSuggestedPrestationsForAutoDraft(input: {
    companyId: number;
    typeProjetId: number | null;
  }): Promise<
    Array<{
      id: number;
      source:
        | 'type-projet-categories'
        | 'type-projet-name-match'
        | 'company-fallback';
    }>
  > {
    const allActivePrestations = await this.prisma.prestation.findMany({
      where: {
        companyId: input.companyId,
        actif: true,
      },
      select: {
        id: true,
        nom: true,
        categorieId: true,
      },
      orderBy: { id: 'asc' },
      take: 200,
    });

    if (allActivePrestations.length === 0) {
      return [];
    }

    if (input.typeProjetId) {
      const typeProjet = await this.prisma.typeProjet.findFirst({
        where: {
          id: input.typeProjetId,
          companyId: input.companyId,
          actif: true,
        },
        select: {
          nom: true,
          categories: {
            select: {
              categorieId: true,
            },
          },
        },
      });

      const categoryIds = (typeProjet?.categories ?? []).map(
        (category) => category.categorieId,
      );

      if (categoryIds.length > 0) {
        const categoryMatches = allActivePrestations
          .filter((prestation) => categoryIds.includes(prestation.categorieId))
          .slice(0, 3)
          .map((prestation) => ({
            id: prestation.id,
            source: 'type-projet-categories' as const,
          }));

        if (categoryMatches.length > 0) {
          return categoryMatches;
        }
      }

      const typeTokens = this.tokenize(
        this.normalizeForMatch(typeProjet?.nom ?? ''),
      );
      if (typeTokens.length > 0) {
        const nameMatches = allActivePrestations
          .filter((prestation) => {
            const normalized = this.normalizeForMatch(prestation.nom);
            return typeTokens.some((token) => normalized.includes(token));
          })
          .slice(0, 3)
          .map((prestation) => ({
            id: prestation.id,
            source: 'type-projet-name-match' as const,
          }));

        if (nameMatches.length > 0) {
          return nameMatches;
        }
      }
    }

    return allActivePrestations.slice(0, 2).map((prestation) => ({
      id: prestation.id,
      source: 'company-fallback' as const,
    }));
  }

  async getFutureProjects(companyId: number) {
    const registryResult = await this.getFutureProjectsFromRegistry(companyId);
    if (registryResult) {
      return registryResult;
    }

    const sessions = await this.prisma.chatSession.findMany({
      where: {
        companyId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        besoinStructure: true,
        clientNom: true,
        clientTelephone: true,
        clientEmail: true,
      },
      take: 500,
    });

    const signals: FutureProjectSignal[] = [];

    for (const session of sessions) {
      const raw =
        session.besoinStructure && typeof session.besoinStructure === 'object'
          ? (session.besoinStructure as Record<string, unknown>)
          : null;

      if (!raw) continue;
      if (raw.intent !== 'demande_devis') continue;
      if (raw.is_known_project === true) continue;

      const signalRaw =
        raw.future_project_signal &&
        typeof raw.future_project_signal === 'object'
          ? (raw.future_project_signal as Record<string, unknown>)
          : null;

      const collectedRaw =
        raw.collected_data && typeof raw.collected_data === 'object'
          ? (raw.collected_data as Record<string, unknown>)
          : {};

      const label =
        this.asString(signalRaw?.label) ||
        this.inferUnknownProjectLabel(
          this.asString(collectedRaw.description) ||
            this.asString(raw.project_type),
        );

      if (!label) continue;

      signals.push({
        label,
        suggestedType: this.asString(signalRaw?.suggestedType) || null,
        description:
          this.asString(signalRaw?.description) ||
          this.asString(collectedRaw.description),
        motsCles: Array.isArray(signalRaw?.motsCles)
          ? (signalRaw.motsCles as unknown[])
              .filter((entry) => typeof entry === 'string')
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 1)
          : [],
        createdAt: session.createdAt.toISOString(),
        prospect: {
          nom: this.asString(collectedRaw.nom) || (session.clientNom ?? ''),
          telephone:
            this.asString(collectedRaw.telephone) ||
            (session.clientTelephone ?? ''),
          email:
            this.asString(collectedRaw.email) || (session.clientEmail ?? ''),
        },
        sessionId: session.id,
      });
    }

    const grouped = new Map<
      string,
      {
        label: string;
        suggestedType: string | null;
        frequence: number;
        lastDetectedAt: string;
        latestDescription: string;
        motsCles: string[];
        latestProspect: {
          nom: string;
          telephone: string;
          email: string;
        };
      }
    >();

    for (const signal of signals) {
      const key = this.normalizeForMatch(signal.label);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          label: signal.label,
          suggestedType: signal.suggestedType,
          frequence: 1,
          lastDetectedAt: signal.createdAt,
          latestDescription: signal.description,
          motsCles: [...signal.motsCles],
          latestProspect: signal.prospect,
        });
        continue;
      }

      existing.frequence += 1;
      if (signal.createdAt > existing.lastDetectedAt) {
        existing.lastDetectedAt = signal.createdAt;
        existing.latestDescription = signal.description;
        existing.latestProspect = signal.prospect;
      }

      if (!existing.suggestedType && signal.suggestedType) {
        existing.suggestedType = signal.suggestedType;
      }

      for (const keyword of signal.motsCles) {
        if (!existing.motsCles.includes(keyword)) {
          existing.motsCles.push(keyword);
        }
      }
    }

    const items = [...grouped.values()].sort((a, b) => {
      if (b.frequence !== a.frequence) {
        return b.frequence - a.frequence;
      }
      return b.lastDetectedAt.localeCompare(a.lastDetectedAt);
    });

    return {
      totalSignals: signals.length,
      uniqueProjects: items.length,
      items,
    };
  }

  private async ensureFutureServicesRegistryTable(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS services_futurs (
        id BIGSERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        label_normalized TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        suggested_type TEXT NULL,
        mots_cles JSONB NOT NULL DEFAULT '[]'::jsonb,
        latest_prospect JSONB NOT NULL DEFAULT '{}'::jsonb,
        session_id INTEGER NULL REFERENCES chat_sessions(id) ON DELETE SET NULL,
        frequence INTEGER NOT NULL DEFAULT 1,
        last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS services_futurs_company_label_idx
      ON services_futurs (company_id, label_normalized)
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS services_futurs_company_last_idx
      ON services_futurs (company_id, last_detected_at DESC)
    `);
  }

  private async registerFutureServiceInRegistry(input: {
    companyId: number;
    sessionId: number;
    signal: FutureProjectSignal;
  }): Promise<void> {
    const label = this.asString(input.signal.label).trim();
    const labelNormalized = this.normalizeForMatch(label);
    if (!labelNormalized) {
      return;
    }

    const description = this.asString(input.signal.description).trim();
    const suggestedType = this.asString(input.signal.suggestedType) || null;
    const motsCles = JSON.stringify(
      [...new Set(input.signal.motsCles.map((motCle) => motCle.trim()))].filter(
        (motCle) => motCle.length > 1,
      ),
    );
    const latestProspect = JSON.stringify({
      nom: this.asString(input.signal.prospect.nom),
      telephone: this.asString(input.signal.prospect.telephone),
      email: this.asString(input.signal.prospect.email),
    });

    try {
      await this.ensureFutureServicesRegistryTable();

      await this.prisma.$executeRawUnsafe(
        `
          INSERT INTO services_futurs (
            company_id,
            label,
            label_normalized,
            description,
            suggested_type,
            mots_cles,
            latest_prospect,
            session_id
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
          ON CONFLICT (company_id, label_normalized)
          DO UPDATE SET
            frequence = services_futurs.frequence + 1,
            last_detected_at = now(),
            updated_at = now(),
            description = CASE
              WHEN EXCLUDED.description <> '' THEN EXCLUDED.description
              ELSE services_futurs.description
            END,
            suggested_type = COALESCE(EXCLUDED.suggested_type, services_futurs.suggested_type),
            mots_cles = CASE
              WHEN jsonb_array_length(EXCLUDED.mots_cles) > 0 THEN EXCLUDED.mots_cles
              ELSE services_futurs.mots_cles
            END,
            latest_prospect = EXCLUDED.latest_prospect,
            session_id = COALESCE(EXCLUDED.session_id, services_futurs.session_id)
        `,
        input.companyId,
        label,
        labelNormalized,
        description,
        suggestedType,
        motsCles,
        latestProspect,
        input.sessionId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`Failed to register future service: ${message}`);
    }
  }

  private async getFutureProjectsFromRegistry(companyId: number): Promise<{
    totalSignals: number;
    uniqueProjects: number;
    items: Array<{
      label: string;
      suggestedType: string | null;
      frequence: number;
      lastDetectedAt: string;
      latestDescription: string;
      motsCles: string[];
      latestProspect: {
        nom: string;
        telephone: string;
        email: string;
      };
    }>;
  } | null> {
    try {
      await this.ensureFutureServicesRegistryTable();

      const rows = await this.prisma.$queryRawUnsafe<
        Array<Record<string, unknown>>
      >(
        `
          SELECT
            label,
            suggested_type,
            frequence,
            last_detected_at,
            description,
            mots_cles,
            latest_prospect
          FROM services_futurs
          WHERE company_id = $1
          ORDER BY frequence DESC, last_detected_at DESC
          LIMIT 200
        `,
        companyId,
      );

      if (rows.length === 0) {
        return null;
      }

      const items = rows.map((row) => {
        const motsClesRaw = row.mots_cles;
        const latestProspectRaw = row.latest_prospect;

        let motsCles: string[] = [];
        if (Array.isArray(motsClesRaw)) {
          motsCles = motsClesRaw
            .filter((entry) => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 1);
        } else if (typeof motsClesRaw === 'string') {
          try {
            const parsed = JSON.parse(motsClesRaw) as unknown[];
            if (Array.isArray(parsed)) {
              motsCles = parsed
                .filter((entry) => typeof entry === 'string')
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 1);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`[IA] Mots-cles illisibles (JSON invalide): ${message}`);
            motsCles = [];
          }
        }

        const latestProspectObj =
          latestProspectRaw && typeof latestProspectRaw === 'object'
            ? (latestProspectRaw as Record<string, unknown>)
            : {};

        const detectedAt = row.last_detected_at;
        const lastDetectedAt =
          detectedAt instanceof Date
            ? detectedAt.toISOString()
            : this.asString(detectedAt);

        return {
          label: this.asString(row.label),
          suggestedType: this.asString(row.suggested_type) || null,
          frequence:
            typeof row.frequence === 'number' && Number.isFinite(row.frequence)
              ? row.frequence
              : 1,
          lastDetectedAt,
          latestDescription: this.asString(row.description),
          motsCles,
          latestProspect: {
            nom: this.asString(latestProspectObj.nom),
            telephone: this.asString(latestProspectObj.telephone),
            email: this.asString(latestProspectObj.email),
          },
        };
      });

      return {
        totalSignals: items.reduce(
          (sum, item) => sum + Math.max(1, item.frequence),
          0,
        ),
        uniqueProjects: items.length,
        items,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`Failed to read future services registry: ${message}`);
      return null;
    }
  }

  async getSession(sessionId: number, companyId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, companyId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
          select: {
            id: true,
            role: true,
            contenu: true,
            nlpResultat: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable pour cette societe');
    }

    return session;
  }

  async submitStructuredRequest(
    sessionId: number,
    dto: SubmitStructuredAssistantDto,
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, companyId: dto.companyId },
      select: {
        id: true,
        clientNom: true,
        clientTelephone: true,
        clientEmail: true,
        besoinStructure: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable pour cette societe');
    }

    const requestType = this.normalizeStructuredRequestType(dto.requestType);
    const normalizedService = dto.serviceRequested.trim();
    const normalizedDescription = dto.description?.trim() || '';
    const language = this.detectLanguage(
      `${dto.nom} ${normalizedService} ${normalizedDescription}`,
    );

    const collectedData: AssistantResult['collected_data'] = {
      nom: dto.nom.trim(),
      telephone: this.normalizePhone(dto.telephone),
      email: dto.email.trim().toLowerCase(),
      description: normalizedDescription || normalizedService,
    };

    const missingRequiredFields = this.getStructuredMissingFields(
      normalizedService,
      collectedData,
    );

    const projectTypes = await this.prisma.typeProjet.findMany({
      where: {
        companyId: dto.companyId,
        actif: true,
      },
      select: {
        id: true,
        nom: true,
        description: true,
      },
      orderBy: { nom: 'asc' },
    });
    const projectTypeNames = projectTypes.map((type) => type.nom);
    const availableServices = this.pickDisplayedServices(projectTypeNames);

    const assistantUserPayload = {
      role: 'USER',
      contenu: [
        '[FORM_ASSISTANT]',
        `service=${normalizedService || '-'}`,
        `request_type=${requestType}`,
        `description=${normalizedDescription || '-'}`,
      ].join(' '),
    };

    await this.prisma.messageChat.create({
      data: {
        sessionId,
        ...assistantUserPayload,
      },
    });

    if (missingRequiredFields.length > 0) {
      const responseMessage =
        'Merci de completer les informations obligatoires: ' +
        missingRequiredFields.join(', ');

      await this.persistStructuredWorkflowState({
        sessionId,
        previousState: session.besoinStructure,
        collectedData,
        projectType: 'AUTRE',
        isKnownProject: false,
        suggestedType: null,
        language,
        futureProjectSignal: null,
        missingFields: missingRequiredFields,
        prospectId: null,
        structuredWorkflow: {
          mode: 'form',
          status: 'MISSING_REQUIRED_INFO',
          request_type: requestType,
          service_requested: normalizedService,
        },
      });

      await this.prisma.messageChat.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          contenu: responseMessage,
          nlpResultat: {
            status: 'MISSING_REQUIRED_INFO',
            missing_fields: missingRequiredFields,
          },
        },
      });

      return {
        status: 'MISSING_REQUIRED_INFO' as StructuredWorkflowStatus,
        request_type: requestType,
        missing_fields: missingRequiredFields,
        is_known_project: false,
        project_type: 'AUTRE',
        available_services: availableServices,
        response_message: responseMessage,
      };
    }

    const projectMatch = this.matchProjectType(
      `${normalizedService} ${normalizedDescription}`,
      projectTypeNames,
    );

    const projectType = projectMatch.known ? projectMatch.projectType : 'AUTRE';

    const prospectId = await this.upsertChatbotProspect({
      companyId: dto.companyId,
      collectedData,
      projectType,
      isKnownProject: projectMatch.known,
      projectTypes,
    });

    if (!projectMatch.known) {
      const futureProjectSignal = this.buildFutureProjectSignal({
        isKnownProject: false,
        suggestedType: projectMatch.suggestedType,
        normalizedMessage:
          `${normalizedService} ${normalizedDescription}`.trim(),
        collectedData,
        sessionId,
        motsCles: this.extractKeywords(
          `${normalizedService} ${normalizedDescription}`.trim(),
        ),
      });

      if (futureProjectSignal) {
        await this.registerFutureServiceInRegistry({
          companyId: dto.companyId,
          sessionId,
          signal: futureProjectSignal,
        });
      }

      const responseMessage =
        'Service non disponible dans la liste actuelle. La demande est enregistree dans le tableau des services non classes.\n\n' +
        this.buildProjectTypesListMessage({
          availableProjectTypes: projectTypes,
          intro: 'Types de projet disponibles actuellement :',
          emptyMessage: 'Aucun type de projet actif n est encore configure.',
        });

      await this.persistStructuredWorkflowState({
        sessionId,
        previousState: session.besoinStructure,
        collectedData,
        projectType: 'AUTRE',
        isKnownProject: false,
        suggestedType: projectMatch.suggestedType,
        language,
        futureProjectSignal,
        missingFields: [],
        prospectId,
        structuredWorkflow: {
          mode: 'form',
          status: 'UNKNOWN_SERVICE_RECORDED',
          request_type: requestType,
          service_requested: normalizedService,
          suggested_type: projectMatch.suggestedType,
        },
      });

      await this.prisma.messageChat.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          contenu: responseMessage,
          nlpResultat: {
            status: 'UNKNOWN_SERVICE_RECORDED',
            service_requested: normalizedService,
            suggested_type: projectMatch.suggestedType,
          },
        },
      });

      return {
        status: 'UNKNOWN_SERVICE_RECORDED' as StructuredWorkflowStatus,
        request_type: requestType,
        project_type: 'AUTRE',
        is_known_project: false,
        prospect_id: prospectId,
        available_services: availableServices,
        response_message: responseMessage,
      };
    }

    const matchedType = projectTypes.find((type) => type.nom === projectType);
    if (!matchedType) {
      throw new NotFoundException('Type de projet detecte mais introuvable');
    }

    const typeProjet = await this.prisma.typeProjet.findFirst({
      where: {
        id: matchedType.id,
        companyId: dto.companyId,
        actif: true,
      },
      select: {
        id: true,
        nom: true,
        categories: {
          orderBy: { ordre: 'asc' },
          select: {
            categorie: {
              select: {
                id: true,
                nom: true,
                description: true,
                sousCategories: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    id: true,
                    nom: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const categories = (typeProjet?.categories ?? []).map(
      (item) => item.categorie,
    );
    const categoryIds = categories.map((category) => category.id);

    const selectedCategoryId =
      dto.selectedCategoryId && categoryIds.includes(dto.selectedCategoryId)
        ? dto.selectedCategoryId
        : (categories[0]?.id ?? null);

    const selectedCategory = categories.find(
      (category) => category.id === selectedCategoryId,
    );

    const sousCategories = selectedCategory?.sousCategories ?? [];
    const sousCategoryIds = sousCategories.map((item) => item.id);
    const selectedSousCategorieId =
      dto.selectedSousCategorieId &&
      sousCategoryIds.includes(dto.selectedSousCategorieId)
        ? dto.selectedSousCategorieId
        : null;

    const prestations = await this.prisma.prestation.findMany({
      where: {
        companyId: dto.companyId,
        actif: true,
        categorieId: selectedCategoryId || undefined,
        sousCategorieId: selectedSousCategorieId || undefined,
      },
      orderBy: { nom: 'asc' },
      take: 25,
      select: {
        id: true,
        nom: true,
        description: true,
        prixVenteMin: true,
        prixVenteMax: true,
        options: {
          orderBy: { ordre: 'asc' },
          select: {
            id: true,
            nom: true,
            obligatoire: true,
            choix: {
              where: { actif: true },
              orderBy: { ordre: 'asc' },
              select: {
                id: true,
                nom: true,
                impactPrix: true,
              },
            },
          },
        },
      },
    });

    const selectedPrestation = dto.selectedPrestationId
      ? prestations.find(
          (prestation) => prestation.id === dto.selectedPrestationId,
        ) || null
      : null;

    const selectedOptions = this.normalizeStructuredOptionChoices(
      dto.selectedOptions,
    );
    const selectedOptionMap = new Map(
      selectedOptions.map((item) => [item.optionId, item.choixOptionIds]),
    );

    const mandatoryOptionIds = (selectedPrestation?.options ?? [])
      .filter((option) => option.obligatoire)
      .map((option) => option.id);

    const missingOptionIds = mandatoryOptionIds.filter((optionId) => {
      const selected = selectedOptionMap.get(optionId);
      return !selected || selected.length === 0;
    });

    const checklist = this.buildStructuredChecklist({
      projectType,
      serviceRequested: normalizedService,
      collectedData,
      selectedCategoryName: selectedCategory?.nom || null,
      selectedSousCategoryName:
        sousCategories.find((item) => item.id === selectedSousCategorieId)
          ?.nom || null,
      selectedPrestationName: selectedPrestation?.nom || null,
      selectedOptions,
      prestations,
    });

    const estimatedPriceRange = this.computeEstimatedPriceRange(
      selectedPrestation,
      prestations,
    );

    const hasChecklistCatalogue = prestations.length > 0;
    const canValidate = hasChecklistCatalogue
      ? Boolean(selectedPrestation) && missingOptionIds.length === 0
      : true;

    let status: StructuredWorkflowStatus = 'NEEDS_CHECKLIST_SELECTION';
    let responseMessage = hasChecklistCatalogue
      ? 'Merci. Selectionnez categorie, sous-categorie, prestation et options obligatoires pour finaliser votre devis.'
      : 'Aucune prestation detaillee n est configuree pour ce type. Vous pouvez valider pour generer un devis PDF synthese.';
    let pdfDownloadUrl: string | null = null;
    let generatedDevisId: number | null = null;
    let generatedPdf: {
      fileName: string;
      base64: string;
      generatedAt: string;
    } | null = null;

    if (canValidate) {
      status = 'READY_FOR_VALIDATION';
      responseMessage =
        'Checklist complete. Vous pouvez valider pour generer le PDF du devis synthese.';
    }

    if (dto.confirmValidation && canValidate) {
      status = 'VALIDATED_AND_PDF_READY';
      const generatedAt = new Date().toISOString();
      const fileName = this.buildStructuredPdfFileName(
        collectedData.nom,
        sessionId,
      );
      const pdfBuffer = await this.generateStructuredPdfBuffer({
        sessionId,
        generatedAt,
        requestType,
        projectType,
        serviceRequested: normalizedService,
        collectedData,
        selectedCategoryName: selectedCategory?.nom || null,
        selectedSousCategoryName:
          sousCategories.find((item) => item.id === selectedSousCategorieId)
            ?.nom || null,
        selectedPrestationName: selectedPrestation?.nom || null,
        checklist,
        selectedOptions,
        prestations,
        estimatedPriceRange,
      });

      generatedPdf = {
        fileName,
        generatedAt,
        base64: pdfBuffer.toString('base64'),
      };
      pdfDownloadUrl = `/api/assistant/session/${sessionId}/structured/pdf?companyId=${dto.companyId}`;
      responseMessage =
        'Validation terminee. Votre devis synthese PDF est pret au telechargement.';

      const actorUserId = await this.findInternalActorUserId(dto.companyId);
      if (actorUserId && prospectId) {
        const draftResultPdf = await this.createOrReuseAssistantDraftDevis({
          companyId: dto.companyId,
          actorUserId,
          prospectId,
          description:
            normalizedDescription ||
            `${projectType} - ${selectedPrestation?.nom || normalizedService}`,
          typeProjetId: matchedType.id,
        });
        generatedDevisId = draftResultPdf ? draftResultPdf.devisId : null;
      }
    } else if (dto.confirmValidation && !canValidate) {
      responseMessage =
        'Validation impossible: completez les options obligatoires de la prestation choisie.';
    }

    await this.persistStructuredWorkflowState({
      sessionId,
      previousState: session.besoinStructure,
      collectedData,
      projectType,
      isKnownProject: true,
      suggestedType: projectType,
      language,
      futureProjectSignal: null,
      missingFields: missingOptionIds.map((optionId) => `option:${optionId}`),
      prospectId,
      structuredWorkflow: {
        mode: 'form',
        status,
        request_type: requestType,
        service_requested: normalizedService,
        selected_category_id: selectedCategoryId,
        selected_sous_categorie_id: selectedSousCategorieId,
        selected_prestation_id: selectedPrestation?.id ?? null,
        selected_options: selectedOptions,
        missing_option_ids: missingOptionIds,
        can_validate: canValidate,
        estimated_price_range: estimatedPriceRange,
        checklist,
        pdf: generatedPdf,
        devis_id: generatedDevisId,
      },
    });

    await this.prisma.messageChat.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        contenu: responseMessage,
        nlpResultat: {
          status,
          project_type: projectType,
          selected_category_id: selectedCategoryId,
          selected_sous_categorie_id: selectedSousCategorieId,
          selected_prestation_id: selectedPrestation?.id ?? null,
          missing_option_ids: missingOptionIds,
          can_validate: canValidate,
          pdf_download_url: pdfDownloadUrl,
          devis_id: generatedDevisId,
        },
      },
    });

    return {
      status,
      request_type: requestType,
      project_type: projectType,
      is_known_project: true,
      prospect_id: prospectId,
      available_services: availableServices,
      categories: categories.map((category) => ({
        id: category.id,
        nom: category.nom,
        description: category.description,
      })),
      sous_categories: sousCategories.map((item) => ({
        id: item.id,
        nom: item.nom,
        description: item.description,
      })),
      prestations: prestations.map((prestation) => ({
        id: prestation.id,
        nom: prestation.nom,
        description: prestation.description,
        prixVenteMin: Number(prestation.prixVenteMin),
        prixVenteMax: Number(prestation.prixVenteMax),
        options: prestation.options.map((option) => ({
          id: option.id,
          nom: option.nom,
          obligatoire: option.obligatoire,
          choix: option.choix.map((choice) => ({
            id: choice.id,
            nom: choice.nom,
            impactPrix: Number(choice.impactPrix),
          })),
        })),
      })),
      selected: {
        categoryId: selectedCategoryId,
        sousCategorieId: selectedSousCategorieId,
        prestationId: selectedPrestation?.id ?? null,
        optionChoices: selectedOptions,
      },
      estimated_price_range: estimatedPriceRange,
      checklist,
      missing_option_ids: missingOptionIds,
      can_validate: canValidate,
      devis_id: generatedDevisId,
      pdf_download_url: pdfDownloadUrl,
      response_message: responseMessage,
    };
  }

  async getStructuredPdf(sessionId: number, companyId: number) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, companyId },
      select: {
        id: true,
        besoinStructure: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable pour cette societe');
    }

    const raw =
      session.besoinStructure && typeof session.besoinStructure === 'object'
        ? (session.besoinStructure as Record<string, unknown>)
        : null;

    const structuredWorkflowRaw =
      raw?.structured_workflow && typeof raw.structured_workflow === 'object'
        ? (raw.structured_workflow as Record<string, unknown>)
        : null;

    const pdfRaw =
      structuredWorkflowRaw?.pdf &&
      typeof structuredWorkflowRaw.pdf === 'object'
        ? (structuredWorkflowRaw.pdf as Record<string, unknown>)
        : null;

    const base64 = this.asString(pdfRaw?.base64);
    if (!base64) {
      throw new BadRequestException(
        'Aucun PDF disponible pour cette session. Validez d abord le workflow structure.',
      );
    }

    const fileName =
      this.asString(pdfRaw?.fileName) ||
      this.buildStructuredPdfFileName(`session-${sessionId}`, sessionId);

    return {
      fileName,
      buffer: Buffer.from(base64, 'base64'),
    };
  }

  private normalizeStructuredRequestType(raw?: string): StructuredRequestType {
    const normalized = (raw || '').trim().toLowerCase();

    if (normalized === 'prix') return 'prix';
    if (normalized === 'categorie') return 'categorie';
    if (normalized === 'service_disponible') return 'service_disponible';
    return 'devis';
  }

  private getStructuredMissingFields(
    serviceRequested: string,
    collectedData: AssistantResult['collected_data'],
  ) {
    const missing: string[] = [];

    if (!collectedData.nom) missing.push('nom');
    if (!collectedData.telephone) missing.push('telephone');
    if (!collectedData.email) missing.push('email');
    if (!serviceRequested) missing.push('serviceRequested');

    return missing;
  }

  private normalizeStructuredOptionChoices(
    options: StructuredOptionChoiceDto[] | undefined,
  ) {
    if (!options || options.length === 0) return [];

    return options
      .map((option) => ({
        optionId: Number(option.optionId),
        choixOptionIds: [...new Set((option.choixOptionIds || []).map(Number))],
      }))
      .filter(
        (option) =>
          Number.isFinite(option.optionId) &&
          option.optionId > 0 &&
          option.choixOptionIds.length > 0,
      );
  }

  private async persistStructuredWorkflowState(input: {
    sessionId: number;
    previousState: unknown;
    collectedData: AssistantResult['collected_data'];
    projectType: string;
    isKnownProject: boolean;
    suggestedType: string | null;
    language: 'fr' | 'ar';
    futureProjectSignal: FutureProjectSignal | null;
    missingFields: string[];
    prospectId: number | null;
    structuredWorkflow: Record<string, unknown>;
  }) {
    const previousRaw =
      input.previousState && typeof input.previousState === 'object'
        ? (input.previousState as Record<string, unknown>)
        : {};

    await this.prisma.chatSession.update({
      where: { id: input.sessionId },
      data: {
        clientNom: input.collectedData.nom || null,
        clientTelephone: input.collectedData.telephone || null,
        clientEmail: input.collectedData.email || null,
        besoinStructure: {
          ...previousRaw,
          collected_data: input.collectedData,
          intent: 'demande_devis',
          project_type: input.projectType,
          is_known_project: input.isKnownProject,
          suggested_project_type: input.suggestedType,
          missing_fields: input.missingFields,
          prospect_id: input.prospectId,
          prospect_saved: input.prospectId !== null,
          future_project_signal: input.futureProjectSignal,
          language: input.language,
          structured_workflow: input.structuredWorkflow,
          updated_at: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      },
    });
  }

  private buildStructuredChecklist(input: {
    projectType: string;
    serviceRequested: string;
    collectedData: AssistantResult['collected_data'];
    selectedCategoryName: string | null;
    selectedSousCategoryName: string | null;
    selectedPrestationName: string | null;
    selectedOptions: Array<{ optionId: number; choixOptionIds: number[] }>;
    prestations: Array<{
      id: number;
      nom: string;
      options: Array<{
        id: number;
        nom: string;
        choix: Array<{ id: number; nom: string }>;
      }>;
    }>;
  }) {
    const optionNameById = new Map<number, string>();
    const choixNameById = new Map<number, string>();

    for (const prestation of input.prestations) {
      for (const option of prestation.options) {
        optionNameById.set(option.id, option.nom);
        for (const choix of option.choix) {
          choixNameById.set(choix.id, choix.nom);
        }
      }
    }

    const optionsSummary =
      input.selectedOptions.length > 0
        ? input.selectedOptions.map((option) => {
            const optionName =
              optionNameById.get(option.optionId) ||
              `Option #${option.optionId}`;
            const choicesLabel = option.choixOptionIds
              .map(
                (choiceId) =>
                  choixNameById.get(choiceId) || `Choix #${choiceId}`,
              )
              .join(', ');
            return `${optionName}: ${choicesLabel}`;
          })
        : ['Aucune option selectionnee'];

    return [
      `Client: ${input.collectedData.nom}`,
      `Telephone: ${input.collectedData.telephone}`,
      `Email: ${input.collectedData.email}`,
      `Service demande: ${input.serviceRequested}`,
      `Type detecte: ${input.projectType}`,
      `Categorie: ${input.selectedCategoryName || 'Non selectionnee'}`,
      `Sous-categorie: ${input.selectedSousCategoryName || 'Non selectionnee'}`,
      `Prestation: ${input.selectedPrestationName || 'Non selectionnee'}`,
      `Besoin client: ${input.collectedData.description || 'Non renseigne'}`,
      ...optionsSummary.map((line) => `Option: ${line}`),
    ];
  }

  private computeEstimatedPriceRange(
    selectedPrestation: {
      prixVenteMin: number;
      prixVenteMax: number;
    } | null,
    prestations: Array<{
      prixVenteMin: number;
      prixVenteMax: number;
    }>,
  ) {
    if (selectedPrestation) {
      return {
        min: selectedPrestation.prixVenteMin,
        max: selectedPrestation.prixVenteMax,
      };
    }

    if (prestations.length === 0) {
      return null;
    }

    const min = Math.min(...prestations.map((item) => item.prixVenteMin));
    const max = Math.max(...prestations.map((item) => item.prixVenteMax));

    return { min, max };
  }

  private buildStructuredPdfFileName(nom: string, sessionId: number) {
    const safeName = this.normalizeForMatch(nom || 'client').replace(
      /\s+/g,
      '-',
    );
    const dateToken = new Date().toISOString().slice(0, 10);
    return `devis-assistant-${safeName || 'client'}-${sessionId}-${dateToken}.pdf`;
  }

  private async generateStructuredPdfBuffer(input: {
    sessionId: number;
    generatedAt: string;
    requestType: StructuredRequestType;
    projectType: string;
    serviceRequested: string;
    collectedData: AssistantResult['collected_data'];
    selectedCategoryName: string | null;
    selectedSousCategoryName: string | null;
    selectedPrestationName: string | null;
    checklist: string[];
    selectedOptions: Array<{ optionId: number; choixOptionIds: number[] }>;
    prestations: Array<{ id: number; nom: string }>;
    estimatedPriceRange: { min: number; max: number } | null;
  }) {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer | Uint8Array) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).text('Devis synthese - Assistant IA', { align: 'left' });
    doc.moveDown(0.4);
    doc.fontSize(10).text(`Session: #${input.sessionId}`);
    doc
      .fontSize(10)
      .text(`Date: ${new Date(input.generatedAt).toLocaleString('fr-FR')}`);

    doc.moveDown();
    doc.fontSize(12).text('Informations client', { underline: true });
    doc.fontSize(10).text(`Nom: ${input.collectedData.nom}`);
    doc.fontSize(10).text(`Telephone: ${input.collectedData.telephone}`);
    doc.fontSize(10).text(`Email: ${input.collectedData.email}`);

    doc.moveDown();
    doc.fontSize(12).text('Qualification besoin', { underline: true });
    doc.fontSize(10).text(`Type de demande: ${input.requestType}`);
    doc.fontSize(10).text(`Service demande: ${input.serviceRequested}`);
    doc.fontSize(10).text(`Type de projet detecte: ${input.projectType}`);
    doc
      .fontSize(10)
      .text(`Categorie: ${input.selectedCategoryName || 'Non selectionnee'}`);
    doc
      .fontSize(10)
      .text(
        `Sous-categorie: ${input.selectedSousCategoryName || 'Non selectionnee'}`,
      );
    doc
      .fontSize(10)
      .text(
        `Prestation: ${input.selectedPrestationName || 'Non selectionnee'}`,
      );

    if (input.estimatedPriceRange) {
      doc
        .fontSize(10)
        .text(
          `Prix estime: ${input.estimatedPriceRange.min.toFixed(2)} EUR - ${input.estimatedPriceRange.max.toFixed(2)} EUR`,
        );
    }

    doc.moveDown();
    doc.fontSize(12).text('Checklist client', { underline: true });
    for (const line of input.checklist) {
      doc.fontSize(10).text(`- ${line}`);
    }

    doc.moveDown();
    doc.fontSize(12).text('Options et selections', { underline: true });
    if (input.selectedOptions.length === 0) {
      doc.fontSize(10).text('- Aucune option selectionnee');
    } else {
      for (const option of input.selectedOptions) {
        doc
          .fontSize(10)
          .text(
            `- Option #${option.optionId}: choix ${option.choixOptionIds.join(', ')}`,
          );
      }
    }

    doc.moveDown();
    doc.fontSize(10).text('Prestations candidates:');
    if (input.prestations.length === 0) {
      doc.fontSize(10).text('- Aucune prestation disponible');
    } else {
      for (const prestation of input.prestations.slice(0, 12)) {
        doc.fontSize(10).text(`- #${prestation.id} ${prestation.nom}`);
      }
    }

    doc.moveDown();
    doc
      .fontSize(9)
      .text(
        'Document genere automatiquement par assistant IA. Validation finale recommandee par un conseiller.',
      );

    doc.end();
    return bufferPromise;
  }

  private getExistingState(session: {
    clientNom: string | null;
    clientTelephone: string | null;
    clientEmail: string | null;
    besoinStructure: unknown;
  }): ExistingState {
    const defaultSessionState = this.createDefaultSessionState({
      nom: session.clientNom ?? null,
      telephone: session.clientTelephone ?? null,
      email: session.clientEmail ?? null,
    });

    const emptyState: ExistingState = {
      collected_data: {
        nom: session.clientNom ?? '',
        telephone: session.clientTelephone ?? '',
        email: session.clientEmail ?? '',
        description: '',
      },
      intent: 'autre',
      project_type: '',
      is_known_project: false,
      awaitingConfirmation: false,
      awaitingEstimateChoice: false,
      guidedAnswers: {},
      currentGuidedStep: 0,
      checklistCompleted: false,
      isUrgent: false,
      devisId: null,
      sessionState: defaultSessionState,
      summarySent: false,
      pendingProjectType: null,
      awaitingProjectTypeChangeConfirmation: false,
    };

    if (
      !session.besoinStructure ||
      typeof session.besoinStructure !== 'object'
    ) {
      return emptyState;
    }

    const raw = session.besoinStructure as Record<string, unknown>;
    const rawCollectedData =
      raw.collected_data && typeof raw.collected_data === 'object'
        ? (raw.collected_data as Record<string, unknown>)
        : {};
    const rawSessionState =
      raw.session_state && typeof raw.session_state === 'object'
        ? (raw.session_state as Record<string, unknown>)
        : {};

    const sessionState = this.createDefaultSessionState({
      nom:
        this.asString(rawSessionState.nom) ||
        this.asString(rawCollectedData.nom) ||
        emptyState.sessionState.nom,
      telephone:
        this.asString(rawSessionState.telephone) ||
        this.asString(rawCollectedData.telephone) ||
        emptyState.sessionState.telephone,
      email:
        this.asString(rawSessionState.email) ||
        this.asString(rawCollectedData.email) ||
        emptyState.sessionState.email,
      projectType:
        this.asString(rawSessionState.projectType) ||
        this.asString(raw.project_type) ||
        null,
      surface: this.asNumberOrNull(rawSessionState.surface),
      delai: this.asString(rawSessionState.delai) || null,
      urgent:
        typeof rawSessionState.urgent === 'boolean'
          ? rawSessionState.urgent
          : Boolean(raw.is_urgent),
      confirmed: Boolean(rawSessionState.confirmed),
      pendingRdv: Boolean(rawSessionState.pendingRdv),
      pendingSuivi: Boolean(rawSessionState.pendingSuivi),
      lastReference:
        typeof rawSessionState.lastReference === 'string'
          ? rawSessionState.lastReference
          : null,
    });

    return {
      collected_data: {
        nom:
          this.asString(rawCollectedData.nom) || emptyState.collected_data.nom,
        telephone:
          this.asString(rawCollectedData.telephone) ||
          emptyState.collected_data.telephone,
        email:
          this.asString(rawCollectedData.email) ||
          emptyState.collected_data.email,
        description: this.asString(rawCollectedData.description),
      },
      intent: this.asIntent(raw.intent),
      project_type: this.asString(raw.project_type),
      is_known_project: Boolean(raw.is_known_project),
      awaitingConfirmation: Boolean(raw.awaiting_confirmation),
      awaitingEstimateChoice: Boolean(raw.awaiting_estimate_choice),
      guidedAnswers:
        raw.guided_answers && typeof raw.guided_answers === 'object'
          ? Object.fromEntries(
              Object.entries(raw.guided_answers as Record<string, unknown>)
                .filter((entry) => typeof entry[1] === 'string')
                .map((entry) => [entry[0], (entry[1] as string).trim()]),
            )
          : {},
      currentGuidedStep:
        typeof raw.current_guided_step === 'number' &&
        Number.isFinite(raw.current_guided_step)
          ? Math.max(0, Math.floor(raw.current_guided_step))
          : 0,
      checklistCompleted: Boolean(raw.checklist_completed),
      isUrgent: Boolean(raw.is_urgent),
      devisId:
        typeof raw.devis_id === 'number' && Number.isFinite(raw.devis_id)
          ? raw.devis_id
          : null,
      sessionState,
      summarySent: Boolean(raw.summary_sent),
      pendingProjectType: this.asString(raw.pending_project_type) || null,
      awaitingProjectTypeChangeConfirmation: Boolean(
        raw.awaiting_project_type_change_confirmation,
      ),
    };
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asIntent(value: unknown): AssistantIntent {
    if (
      value === 'demande_devis' ||
      value === 'demande_info_service' ||
      value === 'demande_prix' ||
      value === 'information_generale' ||
      value === 'autre'
    ) {
      return value;
    }
    return 'autre';
  }

  private createDefaultSessionState(
    input?: Partial<ConversationSessionState>,
  ): ConversationSessionState {
    return {
      nom: input?.nom ?? null,
      telephone: input?.telephone ?? null,
      email: input?.email ?? null,
      projectType: input?.projectType ?? null,
      surface:
        typeof input?.surface === 'number' && Number.isFinite(input.surface)
          ? input.surface
          : null,
      delai: input?.delai ?? null,
      urgent: Boolean(input?.urgent),
      confirmed: Boolean(input?.confirmed),
      pendingRdv: Boolean(input?.pendingRdv),
      pendingSuivi: Boolean(input?.pendingSuivi),
      lastReference:
        typeof input?.lastReference === 'string' ? input.lastReference : null,
    };
  }

  private asNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(',', '.').trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private getMissingFields(
    state: ConversationSessionState,
    collectedData?: AssistantResult['collected_data'],
  ): string[] {
    const missing: string[] = [];

    if (!state.projectType) {
      missing.push('projectType');
    }
    if (!state.nom) {
      missing.push('nom');
    }
    if (!state.telephone) {
      missing.push('telephone');
    }
    if (!state.email) {
      missing.push('email');
    }
    if (state.surface == null) {
      missing.push('surface');
    }
    if (!state.delai) {
      missing.push('delai');
    }
    if (collectedData && !collectedData.description.trim()) {
      missing.push('description');
    }

    return missing;
  }

  private getMissingContactFields(
    collectedData: AssistantResult['collected_data'],
  ): string[] {
    const missing: string[] = [];

    if (!collectedData.nom.trim()) {
      missing.push('nom');
    }
    if (!collectedData.telephone.trim()) {
      missing.push('telephone');
    }
    if (!collectedData.email.trim()) {
      missing.push('email');
    }

    return missing;
  }

  private getRegistrationMissingFields(input: {
    collectedData: AssistantResult['collected_data'];
    projectType: string;
  }): string[] {
    const missing = this.getMissingContactFields(input.collectedData);
    const normalizedProjectType = this.normalizeForMatch(input.projectType);

    if (
      !normalizedProjectType ||
      normalizedProjectType === 'autre' ||
      normalizedProjectType === 'unknown'
    ) {
      missing.push('projectType');
    }

    return [...new Set(missing)];
  }

  private getDevisQualificationMissingFields(
    state: ConversationSessionState,
    collectedData: AssistantResult['collected_data'],
  ): string[] {
    const missing: string[] = [];

    if (!state.projectType) missing.push('projectType');
    if (!state.nom) missing.push('nom');
    if (!state.telephone) missing.push('telephone');
    if (!state.email) missing.push('email');

    if (missing.includes('nom') && collectedData.nom.trim()) {
      missing.splice(missing.indexOf('nom'), 1);
    }
    if (missing.includes('telephone') && collectedData.telephone.trim()) {
      missing.splice(missing.indexOf('telephone'), 1);
    }
    if (missing.includes('email') && collectedData.email.trim()) {
      missing.splice(missing.indexOf('email'), 1);
    }

    return missing;
  }

  private extractFromMessage(
    message: string,
    previousState: ConversationSessionState,
  ): ConversationSessionState {
    const next = this.createDefaultSessionState(previousState);
    const extracted = this.extractFields(message);

    if (!next.nom && extracted.nom) {
      next.nom = extracted.nom;
    }
    if (!next.telephone && extracted.telephone) {
      next.telephone = extracted.telephone;
    }
    if (!next.email && extracted.email) {
      next.email = extracted.email;
    }

    const surfaceMatch = message.match(
      /\b(\d{1,4})(?:[.,]\d{1,2})?\s*(m2|m\^2|metres?\s*carres?)\b/i,
    );
    if (surfaceMatch && next.surface == null) {
      const surface = Number.parseFloat(surfaceMatch[1].replace(',', '.'));
      if (Number.isFinite(surface)) {
        next.surface = surface;
      }
    }

    const delayMatch = message.match(
      /\b(\d{1,2}\s*(?:jour|jours|semaine|semaines|mois))\b/i,
    );
    if (delayMatch && !next.delai) {
      next.delai = delayMatch[1].trim();
    }

    if (!next.delai) {
      const normalized = this.normalizeForMatch(message);
      if (/(des que possible|rapidement|urgent|immediat)/.test(normalized)) {
        next.delai = 'des que possible';
      }
    }

    if (this.isUrgentMessage(message)) {
      next.urgent = true;
    }

    return next;
  }

  private buildSummary(
    state: ConversationSessionState,
    description?: string,
  ): string {
    const surfaceText =
      state.surface != null ? `${state.surface} m2` : 'a definir';
    const urgentText = state.urgent ? '⚡ Oui (prioritaire)' : 'Non';
    const descriptionText = description?.trim() || 'a preciser';

    return [
      `Super, j'ai tout ce qu'il faut ! Voici le recapitulatif de votre demande :\n`,
      `📋 Type de projet : ${state.projectType ?? 'a definir'}`,
      `👤 Nom : ${state.nom ?? '-'}`,
      `📱 Telephone : ${state.telephone ?? '-'}`,
      `📧 Email : ${state.email ?? '-'}`,
      `📝 Besoin : ${descriptionText}`,
      `📐 Surface : ${surfaceText}`,
      `⏱️ Delai : ${state.delai ?? 'a definir'}`,
      `🔥 Urgence : ${urgentText}`,
      `\nTout est correct ? Repondez "Oui" pour confirmer ou dites-moi ce qu'il faut changer.`,
    ].join('\n');
  }

  private buildGroupedMissingFieldsMessage(
    state: ConversationSessionState,
  ): string {
    const labels = this.getMissingFields(state).map((field) => {
      switch (field) {
        case 'projectType':
          return 'type de projet';
        case 'nom':
          return 'nom complet';
        case 'telephone':
          return 'telephone';
        case 'email':
          return 'email';
        case 'surface':
          return 'surface approximative (m2)';
        case 'delai':
          return 'delai souhaite';
        case 'description':
          return 'details du besoin';
        default:
          return field;
      }
    });

    if (labels.length === 0) {
      return this.buildSummary(state);
    }

    const intro = state.nom ? `Merci ${state.nom} ! ` : '';

    if (labels.length <= 2) {
      return `${intro}Pour finaliser votre devis, il me manque juste : ${labels.join(' et ')}. 📝`;
    }

    return `${intro}Pour finaliser votre devis, merci de m'envoyer :\n${labels.map((l) => `- ${l}`).join('\n')}`;
  }

  private buildClosureMessage(state: ConversationSessionState): string {
    const nom = state.nom ?? 'cher client';
    const email = state.email ?? 'votre email';
    const delai = state.delai ?? '48h';
    // Si une demande a ete enregistree, on donne sa reference au client
    // pour qu'il puisse suivre l'avancement plus tard.
    const reference = state.lastReference
      ? `\n\n📎 Votre reference de suivi : ${state.lastReference} (gardez-la pour suivre votre demande).`
      : '';
    return `Merci ${nom} ! ✅\n\nVotre dossier est transmis a notre equipe. Vous recevrez votre devis detaille a ${email} sous ${delai}.${reference}\n\nN'hesitez pas a revenir si vous avez des questions. Bonne journee ! 😊`;
  }

  private pickBestDescriptionForConversation(input: {
    previousDescription: string;
    extractedDescription: string;
    message: string;
  }): string {
    const extracted = input.extractedDescription.trim();
    if (extracted.length >= 8) {
      return extracted;
    }

    const previous = input.previousDescription.trim();
    if (previous.length > 0) {
      return previous;
    }

    const message = input.message.trim();
    if (message.length >= 12) {
      return message;
    }

    return '';
  }

  private extractExplicitProjectTypeChange(
    message: string,
    projectTypeNames: string[],
  ): string | null {
    const normalized = this.normalizeForMatch(message);
    const explicitChangeKeywords =
      /(changer|change|finalement|plutot|au lieu|remplacer)/;

    if (!explicitChangeKeywords.test(normalized)) {
      return null;
    }

    const match = this.matchProjectType(message, projectTypeNames);
    return match.known ? match.projectType : null;
  }

  private detectLanguage(message: string): 'fr' | 'ar' {
    return /[\u0600-\u06FF]/.test(message) ? 'ar' : 'fr';
  }

  private detectCommercialIntents(input: {
    message: string;
    aiIntentHint?: AssistantIntent;
    fallbackIntent: AssistantIntent;
  }): CommercialIntent[] {
    return this.detectCommercialIntentsWithScores(input).intents;
  }

  private detectCommercialIntentsWithScores(input: {
    message: string;
    aiIntentHint?: AssistantIntent;
    fallbackIntent: AssistantIntent;
  }): {
    intents: CommercialIntent[];
    scores: Record<CommercialIntent, number>;
    ranking: Array<{ intent: CommercialIntent; score: number }>;
    ambiguous: boolean;
  } {
    const text = this.normalizeForMatch(input.message);
    const raw = input.message.toLowerCase();

    const scores: Record<CommercialIntent, number> = {
      demande_service: 0,
      demande_devis: 0,
      demande_information: 0,
      demande_prix: 0,
      demande_rdv: 0,
      demande_suivi: 0,
      demande_validation: 0,
      autre: 0,
    };

    const patterns: Record<
      Exclude<CommercialIntent, 'autre'>,
      Array<{ regex: RegExp; weight: number }>
    > = {
      demande_devis: [
        {
          regex: /\bdevis\b|chiffrage|estimation|proposition commerciale/,
          weight: 0.7,
        },
        {
          regex: /\b(preparer|faire|obtenir|demander)\b.{0,20}\bdevis\b/,
          weight: 0.25,
        },
      ],
      demande_service: [
        {
          regex:
            /\bservices?\b|prestations?|catalogue|types? de proj(?:et|ect)s?|\btype\s+de\s+proj(?:et|ect)\b/,
          weight: 0.68,
        },
        {
          regex: /\b(que proposez|quels services|offrez-vous|offrez vous)\b/,
          weight: 0.22,
        },
        {
          regex:
            /\b(dispo|disponible|disponibles)\b.{0,28}\b(services?|prestations?|types?\s+de\s+proj(?:et|ect)s?)\b|\b(types?\s+de\s+proj(?:et|ect)s?)\b.{0,28}\b(dispo|disponible|disponibles)\b/,
          weight: 0.36,
        },
        {
          regex:
            /\b(plomberie|peinture|isolation|renovation|fuite|reparation|installation)\b/,
          weight: 0.42,
        },
      ],
      demande_information: [
        {
          regex:
            /qui etes vous|presentation|horaires|adresse|telephone entreprise/,
          weight: 0.62,
        },
        {
          regex: /comment ca marche|informations?|renseignements?/,
          weight: 0.24,
        },
      ],
      demande_prix: [
        {
          regex: /\bprix\b|\btarifs?\b|\bcout\b|\bcombien\b|fourchette|budget/,
          weight: 0.75,
        },
        { regex: /\b(m2|m²|metres? carres?)\b/, weight: 0.12 },
      ],
      demande_rdv: [
        {
          regex: /\brdv\b|rendez vous|visite|disponibilite|planifier/,
          weight: 0.78,
        },
        { regex: /\b(appel|rappeler)\b/, weight: 0.2 },
      ],
      demande_suivi: [
        { regex: /\bsuivi\b|avancement|statut|ou en est|relance/, weight: 0.8 },
        { regex: /reference|dossier|numero de devis/, weight: 0.2 },
      ],
      demande_validation: [
        { regex: /\bvalidation\b|\bvalider\b|approuve|accepte/, weight: 0.82 },
      ],
    };

    for (const [intent, intentPatterns] of Object.entries(patterns) as Array<
      [
        Exclude<CommercialIntent, 'autre'>,
        Array<{ regex: RegExp; weight: number }>,
      ]
    >) {
      for (const rule of intentPatterns) {
        if (rule.regex.test(raw) || rule.regex.test(text)) {
          scores[intent] += rule.weight;
        }
      }
    }

    const hasExplicitDevis = /\bdevis\b|chiffrage|estimation/.test(raw);
    const hasPriceSignal =
      /\bcombien\b|\bprix\b|\btarif\b|\bcout\b|budget/.test(raw);
    const hasServiceOnlySignal =
      /\bjuste\b|\bseulement\b|\buniquement\b/.test(raw) &&
      /\bservices?\b|catalogue|prestations?/.test(raw);

    if (hasPriceSignal && !hasExplicitDevis) {
      scores.demande_prix += 0.14;
      scores.demande_devis = Math.max(0, scores.demande_devis - 0.2);
    }

    if (hasServiceOnlySignal) {
      scores.demande_service += 0.22;
      scores.demande_prix = Math.max(0, scores.demande_prix - 0.15);
      scores.demande_devis = Math.max(0, scores.demande_devis - 0.18);
    }

    const mappedAiIntent = this.mapLegacyIntentToCommercial(input.aiIntentHint);
    if (mappedAiIntent !== 'autre') {
      scores[mappedAiIntent] += 0.18;
    }

    const mappedFallback = this.mapLegacyIntentToCommercial(
      input.fallbackIntent,
    );
    if (mappedFallback !== 'autre') {
      scores[mappedFallback] += 0.12;
    }

    // Boost NLP: ajoute une compréhension tolérante aux fautes/variantes
    // en complément des regex.
    this.applySemanticIntentBoost(scores, text);

    const ranking = (
      Object.entries(scores) as Array<[CommercialIntent, number]>
    )
      .map(([intent, score]) => ({
        intent,
        score: Number(Math.min(1, score).toFixed(3)),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          this.intentPriority(a.intent) - this.intentPriority(b.intent),
      );

    const top = ranking[0];
    const second = ranking[1];
    const ambiguous =
      Boolean(top && second) &&
      top.score >= 0.35 &&
      second.score >= 0.35 &&
      Math.abs(top.score - second.score) < 0.14;

    const intents = ranking
      .filter((entry) => entry.score >= 0.34)
      .slice(0, 4)
      .map((entry) => entry.intent);

    // FIX: le score "rendez-vous" est structurellement trop faible pour passer
    // le seuil de 0.34. Si le message mentionne clairement un rendez-vous,
    // on ajoute demande_rdv directement (sans dépendre du seuil).
    const mentionsRdv = /\b(rendez[\s-]?vous|rdv|prendre\s+rendez|planifier|visite)\b/i.test(
      input.message,
    );
    if (mentionsRdv && !intents.includes('demande_rdv')) {
      intents.unshift('demande_rdv');
    }

    if (intents.length === 0) {
      intents.push(mappedFallback !== 'autre' ? mappedFallback : 'autre');
    }

    return {
      intents,
      scores: Object.fromEntries(
        ranking.map((entry) => [entry.intent, entry.score]),
      ) as Record<CommercialIntent, number>,
      ranking,
      ambiguous,
    };
  }

  private applySemanticIntentBoost(
    scores: Record<CommercialIntent, number>,
    normalizedText: string,
  ) {
    const tokens = this.tokenize(normalizedText).map((token) =>
      this.stemToken(token),
    );
    const tokenSet = new Set(tokens);
    const phrases = this.extractNlpPhrases(normalizedText);

    const serviceLexicon = [
      'service',
      'prestation',
      'catalogue',
      'dispo',
      'disponible',
      'project',
      'projet',
      'type',
    ];
    const devisLexicon = ['devis', 'chiffrage', 'estimation'];
    const prixLexicon = ['prix', 'tarif', 'cout', 'combien', 'budget'];
    const rdvLexicon = ['rdv', 'rendez', 'rendez-vous', 'rendezvous', 'visite', 'planifier'];
    const suiviLexicon = ['suivi', 'statut', 'avancement', 'relance'];

    const serviceScore = this.computeLexiconHitRatio(tokenSet, serviceLexicon);
    const devisScore = this.computeLexiconHitRatio(tokenSet, devisLexicon);
    const prixScore = this.computeLexiconHitRatio(tokenSet, prixLexicon);
    const rdvScore = this.computeLexiconHitRatio(tokenSet, rdvLexicon);
    const suiviScore = this.computeLexiconHitRatio(tokenSet, suiviLexicon);

    if (serviceScore > 0) scores.demande_service += 0.28 * serviceScore;
    if (devisScore > 0) scores.demande_devis += 0.32 * devisScore;
    if (prixScore > 0) scores.demande_prix += 0.32 * prixScore;
    if (rdvScore > 0) scores.demande_rdv += 0.28 * rdvScore;
    if (suiviScore > 0) scores.demande_suivi += 0.28 * suiviScore;
    const hasTypeProjetPhrase = phrases.some((phrase) =>
      this.fuzzyIncludes(phrase, ['type projet', 'type project'], 1),
    );
    const hasServiceAskPhrase = phrases.some((phrase) =>
      this.fuzzyIncludes(
        phrase,
        ['services disponibles', 'liste services', 'service dispo'],
        2,
      ),
    );

    if (hasTypeProjetPhrase && hasServiceAskPhrase) {
      scores.demande_service += 0.36;
      scores.demande_devis = Math.max(0, scores.demande_devis - 0.1);
    } else if (hasTypeProjetPhrase) {
      scores.demande_service += 0.22;
    }
  }

  private computeLexiconHitRatio(
    tokenSet: Set<string>,
    lexicon: string[],
  ): number {
    const normalizedLexicon = lexicon.map((entry) => this.stemToken(entry));
    const hits = normalizedLexicon.filter((entry) =>
      this.hasFuzzyToken(tokenSet, entry),
    ).length;
    return hits / Math.max(1, normalizedLexicon.length);
  }

  private hasFuzzyToken(tokenSet: Set<string>, target: string): boolean {
    if (tokenSet.has(target)) return true;

    for (const token of tokenSet) {
      if (this.levenshteinDistance(token, target) <= 1) {
        return true;
      }
    }

    return false;
  }

  private extractNlpPhrases(normalizedText: string): string[] {
    const words = normalizedText
      .split(' ')
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
    const phrases: string[] = [];

    for (let i = 0; i < words.length; i += 1) {
      const twoGram = words.slice(i, i + 2).join(' ').trim();
      const threeGram = words.slice(i, i + 3).join(' ').trim();
      if (twoGram) phrases.push(twoGram);
      if (threeGram.split(' ').length === 3) phrases.push(threeGram);
    }

    return phrases;
  }

  private fuzzyIncludes(
    input: string,
    candidates: string[],
    maxDistance: number,
  ): boolean {
    return candidates.some((candidate) => {
      if (input.includes(candidate)) return true;
      return this.levenshteinDistance(input, candidate) <= maxDistance;
    });
  }

  private stemToken(token: string): string {
    return token
      .replace(/(ements|ement|ations|ation|euses|euse|eaux|eau|ees|es|s)$/i, '')
      .replace(/(ables|able|istes|iste|iques|ique)$/i, '')
      .trim();
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = new Array<number>(b.length + 1)
      .fill(0)
      .map((_, i) => i);
    const curr = new Array<number>(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + cost,
        );
      }
      for (let j = 0; j <= b.length; j += 1) {
        prev[j] = curr[j];
      }
    }

    return prev[b.length];
  }

  private mapLegacyIntentToCommercial(
    intent?: AssistantIntent,
  ): CommercialIntent {
    if (intent === 'demande_devis') return 'demande_devis';
    if (intent === 'demande_info_service') return 'demande_service';
    if (intent === 'demande_prix') return 'demande_prix';
    if (intent === 'information_generale') return 'demande_information';
    return 'autre';
  }

  private mapCommercialIntentToLegacy(
    intent: CommercialIntent,
  ): AssistantIntent {
    if (intent === 'demande_devis') return 'demande_devis';
    if (intent === 'demande_prix') return 'demande_prix';
    if (intent === 'demande_service') return 'demande_info_service';
    if (intent === 'demande_information') return 'information_generale';
    return 'autre';
  }

  private intentPriority(intent: CommercialIntent): number {
    const priorities: CommercialIntent[] = [
      'demande_validation',
      'demande_devis',
      'demande_prix',
      'demande_service',
      'demande_rdv',
      'demande_suivi',
      'demande_information',
      'autre',
    ];
    const index = priorities.indexOf(intent);
    return index === -1 ? priorities.length : index;
  }

  private extractRequestedQuantity(message: string): number | null {
    const match = message.match(/\b(\d{1,4})\b/);
    if (!match) return null;

    const quantity = Number.parseInt(match[1], 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    return quantity;
  }

  private buildPendingProjectName(
    suggestedType: string | null,
    fallbackText: string,
  ): string {
    const suggestion = (suggestedType || '').trim();
    if (suggestion) {
      return suggestion.slice(0, 80);
    }

    return this.inferUnknownProjectLabel(fallbackText).slice(0, 80);
  }

  private buildPendingProjectDescription(text: string): string {
    const simplified = text.replace(/\s+/g, ' ').trim();
    if (!simplified) {
      return 'Besoin client a valider avec le technico-commercial.';
    }

    const words = simplified.split(' ').slice(0, 18);
    return words.join(' ').slice(0, 160);
  }

  private buildCommercialWorkflowPayload(input: {
    detectedIntents: CommercialIntent[];
    message: string;
    projectMatchKnown: boolean;
    projectType: string;
    suggestedType: string | null;
    collectedData: AssistantResult['collected_data'];
    missingFields: string[];
    checklistCompleted: boolean;
    isUrgent: boolean;
    technicalValidationApproved: boolean;
  }): {
    client_need_summary: string;
    quote_action: WorkflowAction;
    checklist_action: WorkflowAction;
    technical_validation_action: WorkflowAction;
    email_action: WorkflowAction;
    needs_clarification: boolean;
    clarification_question: string;
  } {
    const workflowIntents = new Set(input.detectedIntents);
    const requiresPresalesWorkflow =
      workflowIntents.has('demande_service') ||
      workflowIntents.has('demande_devis') ||
      workflowIntents.has('demande_prix') ||
      workflowIntents.has('demande_validation');

    let quoteAction: WorkflowAction = {
      status: 'not_required',
      details: 'Aucune generation de devis demandee.',
    };
    let checklistAction: WorkflowAction = {
      status: 'not_required',
      details: 'Checklist non requise.',
    };
    let technicalValidationAction: WorkflowAction = {
      status: 'not_required',
      details: 'Validation technico-commerciale non requise.',
    };
    let emailAction: WorkflowAction = {
      status: 'not_required',
      details: 'Aucun email client a preparer.',
    };

    if (requiresPresalesWorkflow && input.projectMatchKnown) {
      quoteAction = {
        status: 'generate_quote',
        details:
          input.missingFields.length > 0
            ? 'Preparation du devis enclenchee, informations complementaires encore requises.'
            : 'Donnees devis preparees pour generation.',
        data: {
          project_type: input.projectType,
          missing_fields: input.missingFields,
        },
      };

      checklistAction = {
        status: 'launch_checklist',
        details: input.checklistCompleted
          ? 'Checklist deja completee.'
          : 'Checklist adaptee au type de projet a lancer.',
        data: {
          project_type: input.projectType,
          checklist_completed: input.checklistCompleted,
        },
      };

      technicalValidationAction = {
        status: 'send_to_technico',
        details: input.technicalValidationApproved
          ? 'Validation technico-commerciale marquee comme acceptee.'
          : 'Dossier a transmettre au technico-commercial pour validation.',
        data: {
          validation_state: input.technicalValidationApproved
            ? 'approved'
            : 'pending',
        },
      };

      emailAction = input.technicalValidationApproved
        ? {
            status: 'send_email',
            details:
              'Validation acceptee, preparation de l envoi email client.',
          }
        : {
            status: 'pending_technical_validation',
            details:
              'Envoi email en attente de validation technico-commerciale.',
          };
    }

    if (requiresPresalesWorkflow && !input.projectMatchKnown) {
      quoteAction = {
        status: 'wait_project_type_validation',
        details:
          'Type de projet non confirme en base: devis final bloque jusqu a validation ou mapping.',
      };
      checklistAction = {
        status: 'wait_project_type_validation',
        details:
          'Checklist en attente de creation/validation du type de projet.',
      };
      technicalValidationAction = {
        status: 'not_required',
        details:
          'Validation technico apres creation ou mapping du type de projet.',
      };
      emailAction = {
        status: 'not_ready',
        details:
          'Email client non prepare tant que le type de projet n est pas valide.',
      };
    }

    const clarification = this.buildClarificationForWorkflow({
      detectedIntents: input.detectedIntents,
      knownProject: input.projectMatchKnown,
      suggestedType: input.suggestedType,
      missingFields: input.missingFields,
      collectedData: input.collectedData,
      message: input.message,
    });

    return {
      client_need_summary: this.buildClientNeedSummary({
        collectedData: input.collectedData,
        projectType: input.projectType,
        knownProject: input.projectMatchKnown,
        detectedIntents: input.detectedIntents,
        isUrgent: input.isUrgent,
      }),
      quote_action: quoteAction,
      checklist_action: checklistAction,
      technical_validation_action: technicalValidationAction,
      email_action: emailAction,
      needs_clarification: clarification.needsClarification,
      clarification_question: clarification.question,
    };
  }

  private buildClientNeedSummary(input: {
    collectedData: AssistantResult['collected_data'];
    projectType: string;
    knownProject: boolean;
    detectedIntents: CommercialIntent[];
    isUrgent: boolean;
  }): string {
    const intentLabel = input.detectedIntents.join(', ');
    const projectLabel = input.knownProject
      ? input.projectType
      : 'non_confirme';
    const needLabel =
      input.collectedData.description ||
      'Besoin encore incomplet, qualification en cours.';

    return [
      `Intentions: ${intentLabel}`,
      `Projet: ${projectLabel}`,
      `Urgence: ${input.isUrgent ? 'oui' : 'non'}`,
      `Besoin: ${needLabel}`,
    ].join(' | ');
  }

  private buildTechnicoProspectDescription(input: {
    previousDescription: string;
    extractedDescription: string;
    currentMessage: string;
    detectedIntents: CommercialIntent[];
  }): string {
    const lines: string[] = [];
    const normalizedSeen = new Set<string>();

    const addUnique = (value: string) => {
      const compact = value.replace(/\s+/g, ' ').trim();
      if (!compact) return;

      const normalized = this.normalizeForMatch(compact);
      if (!normalized || normalizedSeen.has(normalized)) return;

      normalizedSeen.add(normalized);
      lines.push(compact);
    };

    const hasServiceIntent =
      input.detectedIntents.includes('demande_service') ||
      this.isServiceIntentText(input.previousDescription) ||
      this.isServiceIntentText(input.currentMessage);

    const hasQuoteIntent =
      input.detectedIntents.includes('demande_devis') ||
      this.isDevisIntentText(input.extractedDescription) ||
      this.isDevisIntentText(input.currentMessage);

    if (hasServiceIntent) {
      addUnique('Quels sont les services disponibles ?');
    }

    if (hasQuoteIntent) {
      addUnique('Demande de devis pour des travaux.');
    }

    addUnique(input.previousDescription);
    addUnique(input.extractedDescription);

    return lines.join(' ').slice(0, 350);
  }

  private isServiceIntentText(value: string): boolean {
    const normalized = this.normalizeForMatch(value);
    if (!normalized) return false;

    return /(service|services|prestations|catalogue|dispo|disponible|disponibles|type\s+de\s+proj(?:et|ect)|types?\s+de\s+proj(?:et|ect)s?)/i.test(
      normalized,
    );
  }

  private isDevisIntentText(value: string): boolean {
    const normalized = this.normalizeForMatch(value);
    if (!normalized) return false;

    return /(devis|chiffrage|estimation|travaux|renovation|installation|projet)/i.test(
      normalized,
    );
  }

  private buildClarificationForWorkflow(input: {
    detectedIntents: CommercialIntent[];
    knownProject: boolean;
    suggestedType: string | null;
    missingFields: string[];
    collectedData: AssistantResult['collected_data'];
    message: string;
  }): { needsClarification: boolean; question: string } {
    const intents = new Set(input.detectedIntents);

    if (
      input.detectedIntents.length === 1 &&
      input.detectedIntents[0] === 'autre'
    ) {
      return {
        needsClarification: true,
        question:
          'Pouvez-vous preciser votre demande principale: service, devis, prix, rdv, suivi ou validation ?',
      };
    }

    if (intents.has('demande_devis') && intents.has('demande_suivi')) {
      return {
        needsClarification: true,
        question:
          'Souhaitez-vous un nouveau devis ou le suivi d un dossier deja existant ?',
      };
    }

    if (
      intents.has('demande_suivi') &&
      !/(reference|numero|num|dossier)/i.test(input.message)
    ) {
      return {
        needsClarification: true,
        question: 'Pouvez-vous indiquer la reference du dossier a suivre ?',
      };
    }

    if (!input.knownProject) {
      if (input.suggestedType) {
        return {
          needsClarification: true,
          question: `Confirmez-vous le type de projet "${input.suggestedType}" ?`,
        };
      }

      return {
        needsClarification: true,
        question:
          'Quel service exact souhaitez-vous pour que je cree un type de projet provisoire ?',
      };
    }

    if (intents.has('demande_devis') && input.missingFields.length > 0) {
      const firstMissing = input.missingFields[0];
      const labels: Record<string, string> = {
        projectType: 'le type de projet',
        nom: 'votre nom complet',
        telephone: 'votre telephone',
        email: 'votre email',
        surface: 'la surface approximative en m2',
        delai: 'le delai souhaite',
        description: 'une description courte du besoin',
      };

      return {
        needsClarification: true,
        question: `Pouvez-vous me donner ${labels[firstMissing] || firstMissing} ?`,
      };
    }

    if (!input.collectedData.description && intents.has('demande_service')) {
      return {
        needsClarification: true,
        question: 'Pouvez-vous decrire le besoin en une phrase simple ?',
      };
    }

    return {
      needsClarification: false,
      question: '',
    };
  }

  private buildLowConfidenceClarification(input: {
    message: string;
    intent: IntentDetectionResult;
    projectTypeConfidence: number;
    suggestedProjectType: string | null;
    detectedIntents: CommercialIntent[];
  }): string | null {
    const devisScore = input.intent.scores.demande_devis ?? 0;
    const prixScore = input.intent.scores.demande_prix ?? 0;
    const serviceScore = input.intent.scores.demande_service ?? 0;
    const suiviScore = input.intent.scores.demande_suivi ?? 0;
    const rdvScore = input.intent.scores.demande_rdv ?? 0;
    const hasClearBusinessKeyword =
      /\b(devis|chiffrage|estimation|prix|tarif|services?|prestations?|suivi|rdv|rendez[\s-]?vous)\b/i.test(
        input.message,
      );
    const normalizedIdentity = this.sanitizeName(input.message);
    const hasIdentityOnlySignal =
      this.isLikelyName(normalizedIdentity) &&
      !hasClearBusinessKeyword &&
      !this.isLikelyEmail(this.sanitizeEmail(input.message)) &&
      !this.isLikelyPhone(this.sanitizePhone(input.message));

    if (input.intent.ambiguous) {
      if (devisScore >= 0.4 && prixScore >= 0.4) {
        return 'Vous souhaitez plutot un devis complet ou juste une estimation de prix ?';
      }

      if (suiviScore >= 0.35 && rdvScore >= 0.35) {
        return 'Souhaitez-vous un suivi de dossier ou planifier un rendez-vous ?';
      }

      if (serviceScore >= 0.35 && devisScore >= 0.35) {
        return 'Souhaitez-vous la liste de nos services ou demarrer une demande de devis ?';
      }
    }

    if (
      input.intent.confidence < 0.44 &&
      !hasClearBusinessKeyword &&
      !hasIdentityOnlySignal
    ) {
      return 'Je serais ravie de vous aider ! 😊 Que souhaitez-vous faire ?\n- **Demander un devis**\n- **Prendre rendez-vous**\n- **Suivre votre demande**\n- **Découvrir nos services**';
    }

    if (
      (input.detectedIntents.includes('demande_devis') ||
        input.intent.intent === 'demande_devis') &&
      input.projectTypeConfidence < 0.36
    ) {
      return input.suggestedProjectType
        ? `Je peux continuer. Confirmez-vous le type de projet "${input.suggestedProjectType}" ?`
        : 'Pour avancer, pouvez-vous preciser le type de travaux principal (ex: peinture, plomberie, isolation) ?';
    }

    return null;
  }

  private computeOverallConfidence(input: {
    intentConfidence: number;
    projectTypeConfidence: number;
    extractionAudit: ExtractionAudit;
  }): number {
    const extractionAvg =
      (input.extractionAudit.nom.confidence +
        input.extractionAudit.telephone.confidence +
        input.extractionAudit.email.confidence +
        input.extractionAudit.description.confidence) /
      4;

    const overall =
      input.intentConfidence * 0.45 +
      input.projectTypeConfidence * 0.3 +
      extractionAvg * 0.25;

    return Number(Math.min(1, Math.max(0, overall)).toFixed(3));
  }

  private detectIntent(
    message: string,
    fallback: AssistantIntent,
    aiHint?: AssistantIntent,
  ): AssistantIntent {
    return this.detectIntentWithConfidence(message, fallback, aiHint).intent;
  }

  private detectIntentWithConfidence(
    message: string,
    fallback: AssistantIntent,
    aiHint?: AssistantIntent,
  ): IntentDetectionResult {
    const commercial = this.detectCommercialIntentsWithScores({
      message,
      aiIntentHint: aiHint,
      fallbackIntent: fallback,
    });

    const top = commercial.ranking[0] ?? { intent: 'autre' as const, score: 0 };
    const mappedIntent = this.mapCommercialIntentToLegacy(top.intent);
    const fallbackIntent = fallback || 'autre';

    const intent =
      mappedIntent !== 'autre'
        ? mappedIntent
        : aiHint && aiHint !== 'autre'
          ? aiHint
          : fallbackIntent;

    const confidence =
      mappedIntent !== 'autre'
        ? top.score
        : aiHint && aiHint !== 'autre'
          ? 0.42
          : 0.32;

    return {
      intent,
      detectedIntents: commercial.intents,
      scores: commercial.scores,
      ranking: commercial.ranking,
      confidence: Number(Math.min(1, confidence).toFixed(3)),
      ambiguous: commercial.ambiguous,
    };
  }

  // ============================================================
  // FIX: Extraction du nom améliorée
  // Gère les cas comme "amal saidani2.Je veux..."
  // ============================================================
  private extractFields(message: string) {
    const normalizedEmailSyntax = message
      .replace(/\s*\[at\]\s*/gi, '@')
      .replace(/\s*\(at\)\s*/gi, '@')
      .replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*\(dot\)\s*/gi, '.');

    // Ex: "amal saidani2.Je veux..." -> "amal saidani. Je veux..."
    const cleanedMessage = normalizedEmailSyntax
      .replace(/[;,|]/g, ' ')
      .replace(/(\p{L})\d+\./gu, '$1. ')
      .replace(/(\p{L})(\d{6,15})/gu, '$1 $2')
      .replace(/(\d{2,})(\p{L})/gu, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(?:\+?\d(?:[\s().-]*\d){7,14})/;

    const emailMatch = cleanedMessage.match(emailRegex);
    const phoneMatch = cleanedMessage.match(phoneRegex);

    // 2. Patterns de détection du nom (enrichis)
    const namePatterns = [
      // Patterns explicites
      /(?:je m'appelle|mon nom est|nom\s*:\s*|ana smiti|ismi)\s+([a-zA-ZÀ-ÿ\s'-]{2,60})/i,
      /(?:je suis|c'est)\s+([a-zA-ZÀ-ÿ\s'-]{2,60})/i,
      // Prénom + Nom au début du message avant ponctuation ou mot-clé
      /^([a-zA-ZÀ-ÿ'-]{2,30}\s+[a-zA-ZÀ-ÿ'-]{2,30})(?:\s*[\d.,!?]|\s+(?:je|j'|bonjour|bonsoir|salut|je veux|j'ai))/i,
    ];

    let nom = '';
    for (const pattern of namePatterns) {
      const match = cleanedMessage.match(pattern);
      if (match?.[1]) {
        // Nettoyer: enlever chiffres résiduels et ponctuation
        nom = match[1]
          .replace(/\d+/g, '')
          .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (nom.length >= 3) break;
        nom = '';
      }
    }

    // 3. Fallback: si message court sans email/téléphone, tenter extraction directe
    if (!nom && !emailMatch && !phoneMatch) {
      const normalizedNameCandidate = cleanedMessage
        .replace(/\d+/g, ' ') // supprimer les chiffres
        .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const words = normalizedNameCandidate
        .split(' ')
        .map((word) => word.trim())
        .filter((word) => word.length > 1);

      if (
        words.length >= 2 &&
        words.length <= 4 &&
        normalizedNameCandidate.length <= 60
      ) {
        nom = normalizedNameCandidate;
      }
    }

    if (!nom) {
      const prefix = cleanedMessage
        .split(
          /\b(je veux|j ai besoin|besoin|devis|prix|combien|service|travaux)\b/i,
        )[0]
        ?.trim();

      if (prefix && prefix.length <= 60 && !/\d{6,}/.test(prefix)) {
        const candidate = prefix
          .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const words = candidate.split(' ').filter((word) => word.length > 1);
        if (words.length >= 2 && words.length <= 4) {
          nom = candidate;
        }
      }
    }

    // Si le client envoie "nom + email" (sans format explicite "je m'appelle"),
    // extraire le nom depuis le texte avant l'email/telephone.
    if (!nom && (emailMatch || phoneMatch)) {
      const beforeContact = cleanedMessage
        .replace(emailRegex, ' ')
        .replace(phoneRegex, ' ')
        .split(/\b(je veux|j ai besoin|besoin|devis|prix|combien|service|travaux)\b/i)[0]
        ?.trim();

      if (beforeContact) {
        const candidate = beforeContact
          .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const words = candidate.split(' ').filter((word) => word.length > 1);
        if (words.length >= 2 && words.length <= 4) {
          nom = candidate;
        }
      }
    }

    const contactOnlyMessage =
      (Boolean(emailMatch) || Boolean(phoneMatch)) &&
      !/(devis|travaux|peinture|isolation|renovation|plomberie|je veux|besoin|projet|rendez|rdv|suivi|prix|service|tarif)/i.test(
        cleanedMessage,
      );

    const descriptionCandidate = cleanedMessage
      .replace(emailRegex, ' ')
      .replace(phoneRegex, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const descriptionHasNeedSignal =
      /(devis|travaux|peinture|isolation|renovation|plomberie|service|prix|suivi|rdv|rendez|besoin|projet|fuite|reparation)/i.test(
        descriptionCandidate,
      );

    const description =
      !contactOnlyMessage &&
      (descriptionHasNeedSignal || descriptionCandidate.length >= 18)
        ? descriptionCandidate
        : '';
    const validatedNom = this.isLikelyName(this.sanitizeName(nom)) ? nom : '';

    return {
      nom: validatedNom,
      telephone: phoneMatch ? this.normalizePhone(phoneMatch[0]) : '',
      email: emailMatch ? emailMatch[0].trim() : '',
      description,
    };
  }

  private normalizePhone(raw: string): string {
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith('+');
    const digitsOnly = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digitsOnly}` : digitsOnly;
  }

  private runHybridExtractionPipeline(input: {
    normalizedMessage: string;
    intent: AssistantIntent;
    previousData: AssistantResult['collected_data'];
    aiExtracted: ExtractedFields | null;
    regexExtracted: {
      nom: string;
      telephone: string;
      email: string;
      description: string;
    };
  }) {
    const aiName = this.sanitizeName(input.aiExtracted?.nom || '');
    const regexName = this.sanitizeName(input.regexExtracted.nom || '');
    const nameAudit = this.pickBestCandidate({
      candidates: [
        { value: aiName, source: 'ai', confidence: 0.92 },
        { value: regexName, source: 'regex', confidence: 0.84 },
        {
          value: this.sanitizeName(input.previousData.nom),
          source: 'history',
          confidence: 0.72,
        },
      ],
      validator: (value) => this.isLikelyName(value),
    });
  
    const aiPhone = this.sanitizePhone(input.aiExtracted?.telephone || '');
    const regexPhone = this.sanitizePhone(input.regexExtracted.telephone || '');
    const phoneAudit = this.pickBestCandidate({
      candidates: [
        { value: aiPhone, source: 'ai', confidence: 0.93 },
        { value: regexPhone, source: 'regex', confidence: 0.88 },
        {
          value: this.sanitizePhone(input.previousData.telephone),
          source: 'history',
          confidence: 0.75,
        },
      ],
      validator: (value) => this.isLikelyPhone(value),
    });

    const aiEmail = this.sanitizeEmail(input.aiExtracted?.email || '');
    const regexEmail = this.sanitizeEmail(input.regexExtracted.email || '');
    const emailAudit = this.pickBestCandidate({
      candidates: [
        { value: aiEmail, source: 'ai', confidence: 0.94 },
        { value: regexEmail, source: 'regex', confidence: 0.9 },
        {
          value: this.sanitizeEmail(input.previousData.email),
          source: 'history',
          confidence: 0.78,
        },
      ],
      validator: (value) => this.isLikelyEmail(value),
    });

    const aiDescription = this.sanitizeDescription(
      input.aiExtracted?.description || '',
    );
    const regexDescription = this.sanitizeDescription(
      input.regexExtracted.description || '',
    );
    const messageDescription = this.sanitizeDescription(
      input.normalizedMessage,
    );
    const descriptionAudit = this.pickBestCandidate({
      candidates: [
        {
          value: this.sanitizeDescription(input.previousData.description),
          source: 'history',
          confidence: 0.7,
        },
        { value: aiDescription, source: 'ai', confidence: 0.86 },
        { value: regexDescription, source: 'regex', confidence: 0.8 },
        {
          value: input.intent === 'demande_devis' ? messageDescription : '',
          source: 'message',
          confidence: 0.62,
        },
      ],
      validator: (value) => this.isUsefulDescription(value),
    });

    const projectTypeHintValue = this.sanitizeProjectTypeHint(
      input.aiExtracted?.projectType || '',
    );
    const projectTypeHintAudit: ExtractionFieldAudit = projectTypeHintValue
      ? {
          value: projectTypeHintValue,
          source: 'ai',
          confidence: 0.74,
          valid: true,
        }
      : {
          value: '',
          source: 'none',
          confidence: 0,
          valid: false,
        };

    return {
      projectTypeHint: projectTypeHintAudit.value,
      audit: {
        nom: nameAudit,
        telephone: phoneAudit,
        email: emailAudit,
        description: descriptionAudit,
        project_type_hint: projectTypeHintAudit,
      } satisfies ExtractionAudit,
      collectedData: {
        nom: nameAudit.value,
        telephone: phoneAudit.value,
        email: emailAudit.value,
        description: descriptionAudit.value,
      },
    };
  }

  private pickBestCandidate(input: {
    candidates: Array<{
      value: string;
      source: Exclude<ExtractionFieldSource, 'none'>;
      confidence: number;
    }>;
    validator: (value: string) => boolean;
  }): ExtractionFieldAudit {
    for (const candidate of input.candidates) {
      const value = (candidate.value || '').trim();
      if (!value) {
        continue;
      }

      if (input.validator(value)) {
        return {
          value,
          source: candidate.source,
          confidence: candidate.confidence,
          valid: true,
        };
      }
    }

    return {
      value: '',
      source: 'none',
      confidence: 0,
      valid: false,
    };
  }
  // Genere une reference de suivi aleatoire et non devinable (ex: DEM-A7X9K2).
  // On evite les caracteres ambigus (I, O, 0, 1) pour la lisibilite.
  private generateReference(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `DEM-${code}`;
  }
  private sanitizeName(value: string): string {
    let cleaned = value
      .replace(/\d+/g, ' ')
      .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Coupe le nom dès qu'on rencontre un mot parasite (ex: "Karim mon telephone" -> "Karim")
    const stopWords = [
      'mon', 'ma', 'mes', 'numero', 'numéro', 'telephone', 'téléphone',
      'tel', 'email', 'mail', 'adresse', 'gmail', 'com', 'le', 'la',
      'est', 'cest', 'voici', 'rendez', 'rdv', 'devis',
    ];
    const words = cleaned.split(' ');
    const result: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lower = word.toLowerCase();
      // Particule de nom francais : "la" apres "de" fait partie du nom
      // (ex: "de la Fontaine"), on ne coupe pas dans ce cas.
      const isParticleAfterDe =
        lower === 'la' && i > 0 && words[i - 1].toLowerCase() === 'de';
      if (stopWords.includes(lower) && !isParticleAfterDe) {
        break; // on s'arrête au premier mot parasite
      }
      result.push(word);
    }
    return result.join(' ').trim();
  }

  private sanitizePhone(value: string): string {
    if (!value.trim()) {
      return '';
    }

    return this.normalizePhone(value);
  }

  private sanitizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private sanitizeDescription(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private sanitizeProjectTypeHint(value: string): string {
    const compact = value.trim().replace(/\s+/g, ' ');
    if (!compact) {
      return '';
    }

    const normalized = this.normalizeForMatch(compact);
    const ignored = new Set([
      'autre',
      'unknown',
      'non classe',
      'service',
      'projet',
      'devis',
      'travaux',
    ]);

    if (ignored.has(normalized)) {
      return '';
    }

    return compact.slice(0, 80);
  }

  private isLikelyName(value: string): boolean {
    const words = value
      .split(' ')
      .map((word) => word.trim())
      .filter((word) => word.length > 1);
    const normalized = this.normalizeForMatch(value);
    const forbidden = new Set([
      'client',
      'prospect',
      'utilisateur',
      'user',
      'inconnu',
      'unknown',
      'test',
      'demo',
      'n a',
      'na',
      'non renseigne',
    ]);
    const nonPersonNamePatterns = [
      /\b(maison|appartement|villa|immeuble|batiment|chantier)\b/,
      /\b(toiture|isolation|plomberie|peinture|renovation|travaux|carrelage)\b/,
      /\b(individuelle|collectif|collective|residentiel|residentielle)\b/,
      /\b(revetement|sol|menuiserie|maconnerie|electricite|demolition|desamiantage)\b/,
      /\b(amenagement|exterieur|extension|surelevation|construction|couverture)\b/,
      /\b(faience|platrerie|sanitaire|cuisine|salle|bain|decoration|terrasse|gros)\b/,
    ];
    const hasNonPersonSignal = nonPersonNamePatterns.some((pattern) =>
      pattern.test(normalized),
    );
    // Mots d'intention, de demande, et formes interrogatives : ce ne sont pas des noms.
    const hasIntentSignal =
      /\b(je|j|tu|vous|moi|me|m)\b/.test(normalized) ||
      /\b(veux|voudrais|souhaite|besoin|demande|aimerais|cherche|peux|peut|pouvez|pouvoir|faire|creer|crees?|calculer|modifier|ajouter|transformer|aider|aide)\b/.test(
        normalized,
      ) ||
      /\b(devis|prix|tarif|service|prestations?|projet|rdv|rendez|suivi|facture|chantier|remise|surface|budget|cout|estimation)\b/.test(
        normalized,
      ) ||
      // Mots interrogatifs (comment, combien, quel...) : signe d'une question.
      /\b(comment|combien|quel|quelle|quels|quelles|pourquoi|est ce que|est|ou|quand|peux tu|pouvez vous)\b/.test(
        normalized,
      ) ||
      // Phrase qui se termine par un point d'interrogation = question, pas un nom.
      /\?/.test(value);
    // Formules de politesse / acquiescement : ce ne sont pas des noms.
    const hasPolitenessSignal =
      /\b(merci|accord|ok|oui|non|parfait|bonjour|bonsoir|salut|super|cool|bien|tres bien|d accord)\b/.test(
        normalized,
      );
    // Mots de refus / negation / minimisation : "pas important", "peu importe",
    // "c'est pas grave", "rien"... ne sont jamais des noms de personnes.
    const hasRefusalSignal =
      /\b(pas|rien|aucun|aucune|jamais|important|importe|grave|egal|osef|sais pas|sait pas|confidentiel|prive|secret|nsp)\b/.test(
        normalized,
      );

    // Regle metier: exiger nom + prenom pour valider le champ nom.
    return (
      words.length >= 2 &&
      words.length <= 5 &&
      value.length >= 5 &&
      !forbidden.has(normalized) &&
      !hasNonPersonSignal &&
      !hasIntentSignal &&
      !hasPolitenessSignal &&
      !hasRefusalSignal
    );
  }

  private isLikelyPhone(value: string): boolean {
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length >= 8 && digitsOnly.length <= 15;
  }

  private isLikelyEmail(value: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  }

  private isUsefulDescription(value: string): boolean {
    if (!value || value.length < 12) {
      return false;
    }

    return !this.isContactOnlyMessage(value);
  }

  private isContactOnlyMessage(message: string): boolean {
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
      message,
    );
    const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(message);
    const hasNeedKeyword =
      /(devis|travaux|peinture|isolation|renovation|plomberie|je veux|besoin|projet|pose|installation|reparation)/i.test(
        message,
      );

    return (hasEmail || hasPhone) && !hasNeedKeyword;
  }

  private isAffirmative(message: string): boolean {
    const normalized = this.normalizeForMatch(message);
    return ['oui', 'ok', 'daccord', 'd accord', 'yes', 'valide'].some(
      (token) => normalized === token || normalized.startsWith(`${token} `),
    );
  }

  private isModificationRequest(message: string): boolean {
    const normalized = this.normalizeForMatch(message);
    return ['modifier', 'modif', 'non', 'corriger'].some(
      (token) => normalized === token || normalized.includes(` ${token} `),
    );
  }

  private buildNeedSummary(description: string, projectType: string) {
    const normalized = this.normalizeForMatch(description);

    const zoneKeywords = [
      'salon',
      'plafond',
      'chambre',
      'cuisine',
      'salle de bain',
      'facade',
      'mur',
    ];
    const zones = zoneKeywords.filter((zone) =>
      normalized.includes(this.normalizeForMatch(zone)),
    );

    const surfaceMatch = description.match(/(\d+(?:[.,]\d+)?)\s*(m2|m²)/i);
    const colorMatch = description.match(
      /(?:couleur\s*[:-]?\s*)?(blanc(?:he)?|beige|gris|bleu|vert|rouge|noir)/i,
    );
    const finitionMatch = description.match(
      /(mate?|matte?|satin(?:ee)?|brillant(?:e)?)/i,
    );
    const delaiMatch = description.match(/(\d+)\s*jours?/i);

    return {
      travaux: projectType || 'Non precise',
      zone: zones.length > 0 ? zones.join(' + ') : 'Non precisee',
      surface: surfaceMatch
        ? `${surfaceMatch[1].replace(',', '.')} m2`
        : 'Non precisee',
      couleur: colorMatch ? colorMatch[1] : 'Non precisee',
      finition: finitionMatch ? finitionMatch[1] : 'Non precisee',
      delai: normalized.includes('urgent')
        ? delaiMatch
          ? `${delaiMatch[1]} jours (urgent)`
          : 'Urgent'
        : delaiMatch
          ? `${delaiMatch[1]} jours`
          : 'Non precise',
    };
  }

  private pickDisplayedServices(availableProjectTypes: string[]): string[] {
    const preferred = ['Peinture', 'Isolation', 'Renovation', 'Plomberie'];
    const normalizedAvailable = new Map(
      availableProjectTypes.map((name) => [this.normalizeForMatch(name), name]),
    );

    const prioritized = preferred
      .map((name) => normalizedAvailable.get(this.normalizeForMatch(name)))
      .filter((name): name is string => Boolean(name));

    const fallback = availableProjectTypes.filter(
      (name) => !prioritized.includes(name),
    );

    return [...prioritized, ...fallback];
  }

  private pickDisplayedProjectTypes(
    availableProjectTypes: ProjectTypeSummary[],
  ): ProjectTypeSummary[] {
    const displayedNames = this.pickDisplayedServices(
      availableProjectTypes.map((projectType) => projectType.nom),
    );

    return displayedNames
      .map((name) =>
        availableProjectTypes.find((projectType) => projectType.nom === name),
      )
      .filter((projectType): projectType is ProjectTypeSummary =>
        Boolean(projectType),
      );
  }

  private formatProjectTypeDescription(
    projectType: ProjectTypeSummary,
  ): string {
    const description = projectType.description?.trim();
    if (description) return description;
    return `Travaux lies a ${projectType.nom}`;
  }

  private buildProjectTypesListMessage(input: {
    availableProjectTypes: ProjectTypeSummary[];
    intro?: string;
    outro?: string;
    emptyMessage?: string;
    limit?: number;
  }): string {
    const projectTypes =
      typeof input.limit === 'number'
        ? input.availableProjectTypes.slice(0, input.limit)
        : input.availableProjectTypes;

    if (projectTypes.length === 0) {
      return (
        input.emptyMessage ||
        'Aucun type de projet actif n est encore configure dans cette societe.'
      );
    }

    return [
      input.intro || 'Types de projet disponibles actuellement :',
      ...projectTypes.map(
        (projectType) =>
          `- ${projectType.nom} : ${this.formatProjectTypeDescription(projectType)}`,
      ),
      input.outro,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }

  private matchProjectType(message: string, projectTypes: string[]) {
    const result = this.matchProjectTypeWithConfidence(message, projectTypes);
    return {
      known: result.known,
      projectType: result.projectType,
      suggestedType: result.suggestedType,
    };
  }

  private matchProjectTypeWithConfidence(
    message: string,
    projectTypes: string[],
  ): ProjectTypeMatchResult {
    const normalizedMessage = this.normalizeForMatch(message);
    const tokens = this.tokenize(normalizedMessage);
    const tokenSet = new Set(tokens.map((token) => this.stemToken(token)));

    for (const projectType of projectTypes) {
      const normalizedType = this.normalizeForMatch(projectType);
      if (this.messageMatchesProjectType(normalizedMessage, normalizedType)) {
        return {
          known: true,
          projectType,
          suggestedType: projectType,
          confidence: 0.9,
          source: normalizedMessage.includes(normalizedType)
            ? 'exact'
            : 'alias',
        };
      }
    }

    let bestScore = 0;
    let bestType = '';

    for (const projectType of projectTypes) {
      const typeTokens = this.tokenize(this.normalizeForMatch(projectType)).map(
        (token) => this.stemToken(token),
      );
      if (typeTokens.length === 0) continue;

      const overlap = typeTokens.filter((token) =>
        this.hasFuzzyToken(tokenSet, token),
      ).length;
      const score = overlap / typeTokens.length;

      if (score > bestScore) {
        bestScore = score;
        bestType = projectType;
      }
    }

    if (bestScore >= 0.6 && bestType) {
      return {
        known: true,
        projectType: bestType,
        suggestedType: bestType,
        confidence: Number((0.6 + bestScore * 0.35).toFixed(3)),
        source: 'token_overlap',
      };
    }

    return {
      known: false,
      projectType: '',
      suggestedType: bestType || null,
      confidence: bestType ? Number((bestScore * 0.6).toFixed(3)) : 0.2,
      source: bestType ? 'token_overlap' : 'none',
    };
  }

  private matchProjectTypeFromHint(hint: string, projectTypes: string[]) {
    const result = this.matchProjectTypeFromHintWithConfidence(
      hint,
      projectTypes,
    );
    return result
      ? {
          known: result.known,
          projectType: result.projectType,
          suggestedType: result.suggestedType,
        }
      : null;
  }

  private matchProjectTypeFromHintWithConfidence(
    hint: string,
    projectTypes: string[],
  ): ProjectTypeMatchResult | null {
    const normalizedHint = this.normalizeForMatch(hint);
    if (!normalizedHint) {
      return null;
    }

    for (const projectType of projectTypes) {
      const normalizedType = this.normalizeForMatch(projectType);
      if (
        normalizedHint === normalizedType ||
        normalizedHint.includes(normalizedType) ||
        normalizedType.includes(normalizedHint)
      ) {
        return {
          known: true,
          projectType,
          suggestedType: projectType,
          confidence: 0.84,
          source: 'hint',
        };
      }
    }

    const hintTokens = this.tokenize(normalizedHint).map((token) =>
      this.stemToken(token),
    );
    const hintTokenSet = new Set(hintTokens);
    let bestScore = 0;
    let bestType = '';

    for (const projectType of projectTypes) {
      const typeTokens = this.tokenize(this.normalizeForMatch(projectType)).map(
        (token) => this.stemToken(token),
      );
      if (typeTokens.length === 0 || hintTokens.length === 0) {
        continue;
      }

      const overlap = typeTokens.filter((token) =>
        this.hasFuzzyToken(hintTokenSet, token),
      ).length;
      const score = overlap / typeTokens.length;

      if (score > bestScore) {
        bestScore = score;
        bestType = projectType;
      }
    }

    if (bestScore >= 0.6 && bestType) {
      return {
        known: true,
        projectType: bestType,
        suggestedType: bestType,
        confidence: Number((0.58 + bestScore * 0.3).toFixed(3)),
        source: 'hint',
      };
    }

    const compactHint = hint.trim().replace(/\s+/g, ' ').slice(0, 80);
    return {
      known: false,
      projectType: '',
      suggestedType: compactHint || bestType || null,
      confidence: bestType ? Number((bestScore * 0.55).toFixed(3)) : 0.24,
      source: 'hint',
    };
  }

  private pickBestProjectTypeCandidate(input: {
    fromMessage: ProjectTypeMatchResult;
    fromHint: ProjectTypeMatchResult | null;
  }): ProjectTypeMatchResult {
    if (!input.fromHint) {
      return input.fromMessage;
    }

    if (input.fromHint.known && !input.fromMessage.known) {
      return input.fromHint;
    }

    if (input.fromMessage.known && !input.fromHint.known) {
      return input.fromMessage;
    }

    return input.fromHint.confidence >= input.fromMessage.confidence
      ? input.fromHint
      : input.fromMessage;
  }

  private messageMatchesProjectType(
    normalizedMessage: string,
    normalizedType: string,
  ): boolean {
    if (normalizedMessage.includes(normalizedType)) {
      return true;
    }

    const aliases: Array<{ trigger: string; matches: string[] }> = [
      { trigger: 'peinture', matches: ['peindre', 'peinture'] },
      { trigger: 'isolation', matches: ['isoler', 'isolation'] },
      { trigger: 'plomberie', matches: ['plombier', 'plomberie'] },
    ];

    // Cas special "renovation X" : le mot "renovation" seul ne suffit pas,
    // il faut aussi le mot distinctif (maison, appartement, cuisine, salle de bain...).
    if (normalizedType.includes('renovation')) {
      const renovationKeywords = [
        'maison', 'appartement', 'cuisine', 'salle', 'bain',
      ];
      // On garde uniquement les mots distinctifs presents dans CE type
      const typeKeywords = renovationKeywords.filter((kw) =>
        normalizedType.includes(kw),
      );
      // Le message doit mentionner "renovation" ET le bon mot distinctif
      const mentionsRenovation = /renov/.test(normalizedMessage);
      const mentionsDistinctive = typeKeywords.some((kw) =>
        normalizedMessage.includes(kw),
      );
      if (mentionsRenovation && mentionsDistinctive) {
        return true;
      }
    }

    for (const alias of aliases) {
      if (!normalizedType.includes(alias.trigger)) {
        continue;
      }

      if (
        alias.matches.some((keyword) => normalizedMessage.includes(keyword))
      ) {
        return true;
      }
    }

    return false;
  }

  private normalizeForMatch(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'je',
      'veux',
      'une',
      'un',
      'de',
      'du',
      'des',
      'la',
      'le',
      'les',
      'pour',
      'dans',
      'avec',
      'sur',
      'mon',
      'ma',
      'mes',
      'votre',
      'projet',
      'travaux',
    ]);

    return text
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token));
  }

  private inferUnknownProjectLabel(text: string): string {
    const normalized = text.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return 'Projet non classe';
    }

    if (normalized.length <= 120) {
      return normalized;
    }

    return `${normalized.slice(0, 117)}...`;
  }

  private buildFutureProjectSignal(input: {
    isKnownProject: boolean;
    suggestedType: string | null;
    normalizedMessage: string;
    collectedData: AssistantResult['collected_data'];
    sessionId: number;
    motsCles: string[];
  }) {
    if (input.isKnownProject) {
      return null;
    }

    return {
      label: this.inferUnknownProjectLabel(
        input.collectedData.description || input.normalizedMessage,
      ),
      suggestedType: input.suggestedType,
      description: input.collectedData.description || input.normalizedMessage,
      motsCles: input.motsCles,
      createdAt: new Date().toISOString(),
      prospect: {
        nom: input.collectedData.nom,
        telephone: input.collectedData.telephone,
        email: input.collectedData.email,
      },
      sessionId: input.sessionId,
    };
  }
  // Recherche une demande pour le suivi, par reference (DEM-X) ou par email.
  private async buildSuiviResponse(input: {
    companyId: number;
    message: string;
    email?: string | null;
  }): Promise<string | null> {
    const message = (input.message || '').trim();
    const email = (input.email || '').toLowerCase().trim();
    const refMatchDebug = message.match(/dem[\s-]?([a-z0-9]{4,10})/i);

    // 1. On cherche une reference aleatoire dans le message (ex: "DEM-2J488F")
    // Une reference ressemble a DEM-2J488F : tiret obligatoire + 6 caracteres alphanumeriques.
    const refMatch = message.match(/dem-([a-z0-9]{5,8})/i);
    const reference = refMatch ? `DEM-${refMatch[1].toUpperCase()}` : null;

    // Il faut au moins une reference OU un email pour identifier la demande
    if (!reference && !email) {
      return null;
    }

    // 2. On cherche la demande par reference aleatoire (secrete, non devinable).
    //    Plus besoin de l'email : la reference aleatoire prouve deja l'identite.
    let demande = null;
    if (reference) {
      demande = await this.prisma.demandeDevis.findFirst({
        where: {
          reference,
          companyId: input.companyId,
        },
        select: {
          id: true,
          reference: true,
          statut: true,
          description: true,
          client: { select: { nom: true } },
        },
      });
    }

    // 3. Si pas trouve par reference, on essaie par email
    if (!demande && email) {
      const client = await this.prisma.client.findFirst({
        where: { companyId: input.companyId, email },
        select: { id: true, nom: true },
      });
      if (client) {
        demande = await this.prisma.demandeDevis.findFirst({
          where: { clientId: client.id, companyId: input.companyId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            statut: true,
            description: true,
            client: { select: { nom: true } },
          },
        });
      }
    }

    // 4. Aucune demande trouvee
    if (!demande) {
      return (
        'Je ne trouve aucune demande correspondante. Verifiez votre reference (ex: DEM-14) ' +
        'ou votre email, ou contactez-nous directement si le probleme persiste. 📋'
      );
    }

    // 5. On traduit le statut en francais lisible
    const statutLabels: Record<string, string> = {
      NOUVEAU: 'Nouvelle demande recue ✨',
      EN_COURS: 'En cours de traitement 🔧',
      QUALIFIE: 'Qualifiee, devis en preparation 📝',
      CONVERTI: 'Devis envoye / converti ✅',
      PERDU: 'Cloturee',
    };
    const statutLisible = statutLabels[demande.statut] || demande.statut;
    const nomClient = demande.client?.nom || 'cher client';

    return (
      `Bonjour ${nomClient} ! 📋\n\n` +
      `Voici l'etat de votre demande ${demande.reference || 'DEM-' + demande.id} :\n` +
      `- ${demande.description}\n` +
      `- Statut : ${statutLisible}\n\n` +
      `Notre equipe reste a votre disposition pour toute question. 😊`
    );
  }
  private async upsertChatbotProspect(input: {
    companyId: number;
    collectedData: AssistantResult['collected_data'];
    projectType: string;
    isKnownProject: boolean;
    projectTypes: Array<{ id: number; nom: string }>;
    notesOverride?: string;
    isRdv?: boolean;
  }): Promise<number> {
    const normalizedEmail = input.collectedData.email.toLowerCase();
    const normalizedPhone = input.collectedData.telephone;
    // Nom propre : on rejette les noms pollués par le regex (ex: "Nour mon telephone")
    // On nettoie toujours le nom (coupe les mots parasites comme "mon telephone")
    const cleanName = this.sanitizeName(input.collectedData.nom);

    // Fusion uniquement si l'email correspond : l'email identifie la personne.
    // Un telephone identique avec un email different = personne differente
    // (couple, fixe partage, entreprise...) => on cree un nouveau client
    // au lieu d'ecraser l'identite de l'existant.
    // Les telephones partages restent detectables via check-duplicates (back-office).
    const existing = normalizedEmail
      ? await this.prisma.client.findFirst({
          where: {
            companyId: input.companyId,
            email: normalizedEmail,
          },
          select: {
            id: true,
            besoin: true,
          },
        })
      : null;
    // Calcul du besoin : si le client avait deja un devis et demande un rdv
    // (ou l'inverse), on combine en DEVIS_RENDEZ_VOUS.
    const nouveauBesoin = input.isRdv ? 'RENDEZ_VOUS' : 'DEVIS';
    const ancienBesoin = existing?.besoin ?? null;
    let besoinValue: string = nouveauBesoin;
    if (ancienBesoin && ancienBesoin !== nouveauBesoin) {
      besoinValue = 'DEVIS_RENDEZ_VOUS';
    } else if (ancienBesoin === 'DEVIS_RENDEZ_VOUS') {
      besoinValue = 'DEVIS_RENDEZ_VOUS';
    }
    const matchedTypeProjet = input.isKnownProject
      ? input.projectTypes.find(
          (projectType) => projectType.nom === input.projectType,
        )
      : undefined;

    if (existing) {
      await this.prisma.client.update({
        where: { id: existing.id },
        data: {
          nom: cleanName,
          telephone: normalizedPhone,
          email: normalizedEmail,
          besoin: besoinValue,
          notes: input.notesOverride || input.collectedData.description,
          source: LeadSource.CHATBOT,
          typeProjetId: matchedTypeProjet?.id ?? null,
        },
      });

      return existing.id;
    }

    const created = await this.prisma.client.create({
      data: {
        companyId: input.companyId,
        nom: cleanName,
        telephone: normalizedPhone,
        email: normalizedEmail,
        source: LeadSource.CHATBOT,
        besoin: besoinValue,
        notes: input.notesOverride || input.collectedData.description,
        typeProjetId: matchedTypeProjet?.id,
      },
      select: { id: true },
    });

    return created.id;
  }

  private isUrgentMessage(message: string): boolean {
    return /urgent|vite|rapidement|asap|aujourd hui|aujourd'hui|demain|fuite|panne|casse|immediat/i.test(
      message,
    );
  }

  private extractKeywords(text: string): string[] {
    const normalized = this.normalizeForMatch(text);
    if (!normalized) {
      return [];
    }

    const tokens = this.tokenize(normalized);
    const unique: string[] = [];

    for (const token of tokens) {
      if (!unique.includes(token)) {
        unique.push(token);
      }
      if (unique.length >= 6) {
        break;
      }
    }

    return unique;
  }

  private async buildServiceOrPriceResponse(input: {
    intent: 'demande_info_service' | 'demande_prix';
    companyId: number;
    projectType: string;
    suggestedType: string | null;
    message: string;
    projectTypes: Array<{
      id: number;
      nom: string;
      description: string | null;
    }>;
  }): Promise<string> {
    const availabilityCheck = this.resolveServiceAvailabilityCheck({
      message: input.message,
      projectTypes: input.projectTypes,
      targetTypeHint:
        input.projectType !== 'AUTRE'
          ? input.projectType
          : input.suggestedType || '',
    });
    if (availabilityCheck.isAvailabilityQuery) {
      return this.buildAvailabilityAnswer({
        inputMessage: input.message,
        projectTypes: input.projectTypes,
        fallbackTargetType:
          input.projectType !== 'AUTRE'
            ? input.projectType
            : input.suggestedType || '',
      });
    }

    const targetType =
      input.projectType !== 'AUTRE'
        ? input.projectType
        : input.suggestedType || '';

    if (input.intent === 'demande_info_service') {
      if (
        targetType &&
        this.isDetailedServiceRequest(input.message, targetType)
      ) {
        return this.buildDetailedServiceResponse({
          companyId: input.companyId,
          targetType,
          projectTypes: input.projectTypes,
        });
      }

      return this.buildProjectTypesListMessage({
        availableProjectTypes: input.projectTypes,
        intro: 'Types de projet disponibles actuellement :',
        outro:
          'Dites-moi le type de projet qui vous interesse et je vous guide ensuite vers un devis.',
      });
    }

    const targetTypeForPrice = targetType || input.projectTypes[0]?.nom || '';

    if (!targetTypeForPrice) {
      return 'Je peux donner des fourchettes de prix par service. Dites-moi d abord le type de projet souhaite.';
    }

    const typeProjet = input.projectTypes.find(
      (type) => type.nom === targetTypeForPrice,
    );
    if (!typeProjet) {
      return `Je n ai pas trouve le service "${targetTypeForPrice}" dans le catalogue actuel.`;
    }

    const typeWithCatalogue = await this.prisma.typeProjet.findFirst({
      where: {
        id: typeProjet.id,
        companyId: input.companyId,
        actif: true,
      },
      select: {
        categories: {
          select: {
            categorie: {
              select: {
                prestations: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  take: 8,
                  select: {
                    nom: true,
                    prixVenteMin: true,
                    prixVenteMax: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const prestations = (typeWithCatalogue?.categories ?? [])
      .flatMap((entry) => entry.categorie.prestations)
      .slice(0, 8);

    if (prestations.length === 0) {
      return `Le service ${targetTypeForPrice} existe, mais aucune prestation tarifee n est encore configuree.`;
    }

    return [
      `Prix de vente indicatifs pour ${targetTypeForPrice} :`,
      ...prestations.map(
        (prestation) =>
          `- ${prestation.nom}: ${prestation.prixVenteMin.toFixed(2)} EUR a ${prestation.prixVenteMax.toFixed(2)} EUR`,
      ),
      'Si vous voulez, je prepare maintenant votre devis personnalise.',
    ].join('\n');
  }

  private resolveServiceAvailabilityCheck(input: {
    message: string;
    projectTypes: Array<{ nom: string }>;
    targetTypeHint?: string;
  }): {
    isAvailabilityQuery: boolean;
    isAvailable: boolean;
  } {
    const normalizedMessage = this.normalizeForMatch(input.message);
    if (!this.isServiceAvailabilityQuery(normalizedMessage)) {
      return { isAvailabilityQuery: false, isAvailable: false };
    }

    const projectTypeNames = input.projectTypes.map((item) => item.nom);
    const fromMessage = this.matchProjectTypeWithConfidence(
      input.message,
      projectTypeNames,
    );
    if (fromMessage.known) {
      return { isAvailabilityQuery: true, isAvailable: true };
    }

    if (input.targetTypeHint && input.targetTypeHint !== 'AUTRE') {
      const fromHint = this.matchProjectTypeFromHintWithConfidence(
        input.targetTypeHint,
        projectTypeNames,
      );
      if (fromHint?.known) {
        return { isAvailabilityQuery: true, isAvailable: true };
      }
    }

    return { isAvailabilityQuery: true, isAvailable: false };
  }

  private buildAvailabilityAnswer(input: {
    inputMessage: string;
    projectTypes: Array<{ nom: string }>;
    fallbackTargetType?: string;
  }): string {
    const availableNames = input.projectTypes.map((item) => item.nom).filter(Boolean);
    if (availableNames.length === 0) {
      return 'Aucun service n est disponible pour le moment dans le catalogue.';
    }

    const fromMessage = this.matchProjectTypeWithConfidence(
      input.inputMessage,
      availableNames,
    );

    if (fromMessage.known && fromMessage.projectType !== 'AUTRE') {
      return [
        `Service demande: ${fromMessage.projectType}`,
        'Resultat comparaison: disponible dans la base.',
        'Souhaitez-vous les details (categories, prestations, tarifs) pour ce service ?',
      ].join('\n');
    }

    const fallback = input.fallbackTargetType?.trim();
    if (fallback && fallback !== 'AUTRE') {
      const fromHint = this.matchProjectTypeFromHintWithConfidence(
        fallback,
        availableNames,
      );
      if (fromHint?.known && fromHint.projectType !== 'AUTRE') {
        return [
          `Service demande: ${fromHint.projectType}`,
          'Resultat comparaison: disponible dans la base.',
          'Souhaitez-vous les details (categories, prestations, tarifs) pour ce service ?',
        ].join('\n');
      }
    }

    const normalizedMessage = this.normalizeForMatch(input.inputMessage);
    const candidate = this.extractServiceCandidateFromMessage(normalizedMessage);
    if (candidate) {
      const near = this.findNearestProjectType(candidate, availableNames);
      if (near) {
        return [
          `Service demande: ${candidate}`,
          'Resultat comparaison: non disponible dans la base.',
          `Service existant le plus proche: ${near}.`,
          this.buildProjectTypesListMessage({
            availableProjectTypes: input.projectTypes.map((item, index) => ({
              id: index + 1,
              nom: item.nom,
              description: null,
            })),
            intro: 'Liste des services disponibles :',
          }),
        ].join('\n');
      }
      return [
        `Service demande: ${candidate}`,
        'Resultat comparaison: non disponible dans la base.',
        this.buildProjectTypesListMessage({
          availableProjectTypes: input.projectTypes.map((item, index) => ({
            id: index + 1,
            nom: item.nom,
            description: null,
          })),
          intro: 'Liste des services disponibles :',
        }),
      ].join('\n');
    }

    return this.buildProjectTypesListMessage({
      availableProjectTypes: input.projectTypes.map((item, index) => ({
        id: index + 1,
        nom: item.nom,
        description: null,
      })),
      intro: 'Liste des services disponibles :',
    });
  }

  private extractServiceCandidateFromMessage(normalizedMessage: string): string | null {
    if (!normalizedMessage) return null;

    const tokens = this.tokenize(normalizedMessage).filter((token) => token.length > 2);
    const stopwords = new Set([
      'ce',
      'cette',
      'cet',
      'ces',
      'de',
      'des',
      'est',
      'que',
      'quoi',
      'pour',
      'avec',
      'dans',
      'nous',
      'vous',
      'service',
      'services',
      'dispo',
      'disponible',
      'disponibilite',
      'existe',
      'prix',
      'tarif',
      'tarifs',
      'bonjour',
      'salut',
      'svp',
      'stp',
      'merci',
      'moment',
    ]);

    const filtered = tokens.filter((token) => !stopwords.has(token));
    if (filtered.length === 0) return null;
    return filtered.slice(0, 4).join(' ');
  }

  private findNearestProjectType(
    candidate: string,
    projectTypeNames: string[],
  ): string | null {
    const candidateTokens = new Set(this.tokenize(candidate));
    let bestName: string | null = null;
    let bestScore = 0;

    for (const name of projectTypeNames) {
      const tokens = new Set(this.tokenize(this.normalizeForMatch(name)));
      if (tokens.size === 0) continue;

      let overlap = 0;
      for (const token of candidateTokens) {
        if (tokens.has(token)) overlap += 1;
      }

      const score = overlap / Math.max(candidateTokens.size, tokens.size);
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    }

    return bestScore >= 0.34 ? bestName : null;
  }

  private isServiceAvailabilityQuery(normalizedMessage: string): boolean {
    if (!normalizedMessage) return false;

    return /\b(dispo|disponible|disponibilite|existe|available|kayn|kayna|mawjud)\b/i.test(
      normalizedMessage,
    );
  }

  private isDetailedServiceRequest(
    message: string,
    targetType: string,
  ): boolean {
    const normalized = this.normalizeForMatch(message);
    const typeNormalized = this.normalizeForMatch(targetType);

    if (!typeNormalized || !normalized.includes(typeNormalized)) {
      return false;
    }

    const detailSignals = [
      'detail',
      'details',
      'plus',
      'precise',
      'preciser',
      'sous categorie',
      'sous categories',
      'option',
      'options',
      'choix',
      'prix',
      'tarif',
      'tarifs',
    ];

    return detailSignals.some((signal) => normalized.includes(signal));
  }

  private async buildDetailedServiceResponse(input: {
    companyId: number;
    targetType: string;
    projectTypes: Array<{ id: number; nom: string }>;
  }): Promise<string> {
    const typeProjet = input.projectTypes.find(
      (type) => type.nom === input.targetType,
    );

    if (!typeProjet) {
      return `Je n ai pas trouve le service "${input.targetType}" dans le catalogue actuel.`;
    }

    const typeWithDetails = await this.prisma.typeProjet.findFirst({
      where: {
        id: typeProjet.id,
        companyId: input.companyId,
        actif: true,
      },
      select: {
        nom: true,
        categories: {
          orderBy: { ordre: 'asc' },
          select: {
            categorie: {
              select: {
                nom: true,
                sousCategories: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    id: true,
                    nom: true,
                  },
                },
                prestations: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    nom: true,
                    sousCategorieId: true,
                    prixVenteMin: true,
                    prixVenteMax: true,
                    options: {
                      orderBy: { ordre: 'asc' },
                      select: {
                        nom: true,
                        obligatoire: true,
                        choix: {
                          where: { actif: true },
                          orderBy: { ordre: 'asc' },
                          select: {
                            nom: true,
                            impactPrix: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!typeWithDetails) {
      return `Je n ai pas trouve le service "${input.targetType}" dans le catalogue actuel.`;
    }

    const lines: string[] = [
      `Details du service ${typeWithDetails.nom}:`,
      'Prix affiches: prix de vente uniquement (prix d achat non communiques).',
    ];

    for (const categoryEntry of typeWithDetails.categories) {
      const category = categoryEntry.categorie;
      lines.push(`\nCategorie: ${category.nom}`);

      if (category.sousCategories.length > 0) {
        lines.push(
          `Sous-categories: ${category.sousCategories.map((item) => item.nom).join(', ')}`,
        );
      }

      if (category.prestations.length === 0) {
        lines.push('- Aucune prestation active pour cette categorie.');
        continue;
      }

      for (const prestation of category.prestations) {
        const sousCategorieName = category.sousCategories.find(
          (item) => item.id === prestation.sousCategorieId,
        )?.nom;

        lines.push(
          `- ${prestation.nom}${sousCategorieName ? ` [${sousCategorieName}]` : ''}: ${prestation.prixVenteMin.toFixed(2)} EUR a ${prestation.prixVenteMax.toFixed(2)} EUR`,
        );

        for (const option of prestation.options) {
          const optionPrefix = option.obligatoire
            ? `  Option obligatoire: ${option.nom}`
            : `  Option: ${option.nom}`;
          lines.push(optionPrefix);

          if (option.choix.length === 0) {
            lines.push('    - Aucun choix configure');
            continue;
          }

          for (const choix of option.choix) {
            lines.push(
              `    - ${choix.nom}: impact ${choix.impactPrix >= 0 ? '+' : ''}${choix.impactPrix.toFixed(2)} EUR`,
            );
          }
        }
      }
    }

    lines.push(
      '\nSi vous voulez, je peux maintenant vous guider et preparer automatiquement votre devis a partir de votre description.',
    );

    return lines.join('\n');
  }

  private async getGuidedStepsForProject(
    projectType: string,
    companyId: number,
  ): Promise<GuidedStep[]> {
    const genericStepsByType: Record<string, GuidedStep[]> = {
      peinture: [
        {
          field: 'surface',
          questionFr: 'Quelle surface approximative (en m2) ?',
          questionAr: 'ما هي المساحة التقريبية (بالمتر المربع)؟',
          type: 'number',
          unit: 'm2',
        },
        {
          field: 'zone',
          questionFr: 'Interieur, exterieur ou les deux ?',
          questionAr: 'داخلي أم خارجي أم الاثنين؟',
          type: 'choice',
          choices: ['Interieur', 'Exterieur', 'Les deux'],
        },
      ],
      plomberie: [
        {
          field: 'zone',
          questionFr: 'Ou se situe le besoin (cuisine, salle de bain, autre) ?',
          questionAr: 'أين يقع الاحتياج (مطبخ، حمام، آخر)؟',
          type: 'text',
        },
        {
          field: 'detail',
          questionFr: 'Installation, reparation ou remplacement ?',
          questionAr: 'تركيب أم إصلاح أم استبدال؟',
          type: 'choice',
          choices: ['Installation', 'Reparation', 'Remplacement'],
        },
      ],
      isolation: [
        {
          field: 'zone',
          questionFr: 'Quelle zone doit etre isolee ?',
          questionAr: 'ما هي المنطقة التي يجب عزلها؟',
          type: 'choice',
          choices: ['Toiture', 'Murs', 'Sol', 'Autre'],
        },
        {
          field: 'surface',
          questionFr: 'Surface approximative (en m2) ?',
          questionAr: 'المساحة التقريبية (بالمتر المربع)؟',
          type: 'number',
          unit: 'm2',
        },
      ],
    };

    const commonSteps: GuidedStep[] = [
      {
        field: 'adresse',
        questionFr: 'Quelle est l adresse du chantier ?',
        questionAr: 'ما هو عنوان الورشة؟',
        type: 'text',
      },
      {
        field: 'delai',
        questionFr: 'Quel delai souhaitez-vous ?',
        questionAr: 'ما هو الأجل الذي ترغب به؟',
        type: 'text',
      },
    ];

    const projectTypeNormalized = this.normalizeForMatch(projectType);
    const genericKey = Object.keys(genericStepsByType).find((key) =>
      projectTypeNormalized.includes(key),
    );

    const genericSteps = genericKey ? genericStepsByType[genericKey] : [];

    const typeProjet = await this.prisma.typeProjet.findFirst({
      where: {
        companyId,
        actif: true,
        nom: projectType,
      },
      select: {
        categories: {
          orderBy: { ordre: 'asc' },
          select: {
            categorie: {
              select: {
                id: true,
                nom: true,
                sousCategories: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: { nom: true },
                },
              },
            },
          },
        },
      },
    });

    const dbSteps: GuidedStep[] = [];
    for (const categoryEntry of typeProjet?.categories ?? []) {
      const category = categoryEntry.categorie;
      if (category.sousCategories.length === 0) {
        continue;
      }

      dbSteps.push({
        field: `categorie_${category.id}`,
        questionFr: `Pour ${category.nom}, quel sous-type vous interesse ?`,
        questionAr: `بالنسبة لـ ${category.nom}، ما النوع الفرعي الذي يهمك؟`,
        type: 'choice',
        choices: category.sousCategories.map((subCategory) => subCategory.nom),
      });
    }

    return dbSteps.length > 0
      ? [...dbSteps, ...commonSteps]
      : [...genericSteps, ...commonSteps];
  }

  private extractGuidedAnswer(message: string, step: GuidedStep): string {
    if (step.type === 'number') {
      const match = message.match(/(\d+(?:[.,]\d+)?)/);
      if (match) {
        const value = match[1].replace(',', '.');
        return step.unit ? `${value} ${step.unit}` : value;
      }
    }

    if (step.type === 'choice' && step.choices && step.choices.length > 0) {
      const normalized = this.normalizeForMatch(message);
      const matched = step.choices.find((choice) =>
        normalized.includes(this.normalizeForMatch(choice)),
      );
      if (matched) {
        return matched;
      }
    }

    return message.trim().slice(0, 220);
  }

  private buildGuidedQuestionMessage(
    question: NonNullable<AssistantResult['guided_question']>,
  ): string {
    if (!question.choices || question.choices.length === 0) {
      return question.question;
    }

    return [
      question.question,
      ...question.choices.map((choice, index) => `${index + 1}. ${choice}`),
    ].join('\n');
  }

  private buildGuidedChecklist(input: {
    projectType: string;
    collectedData: AssistantResult['collected_data'];
    guidedAnswers: Record<string, string>;
  }): string[] {
    const checklist: string[] = [
      `Client: ${input.collectedData.nom}`,
      `Telephone: ${input.collectedData.telephone}`,
      `Email: ${input.collectedData.email}`,
      `Projet: ${input.projectType}`,
      `Besoin: ${input.collectedData.description || 'Non renseigne'}`,
    ];

    for (const [field, value] of Object.entries(input.guidedAnswers)) {
      if (!value) {
        continue;
      }
      checklist.push(`${field}: ${value}`);
    }

    return checklist;
  }

  private buildGuidedChecklistSummary(
    checklist: string[],
    language: AssistantLanguage,
  ): string {
    if (language === 'ar') {
      return [
        'ممتاز، هذا ملخص طلبك:',
        ...checklist.map((line) => `- ${line}`),
        'هل تؤكد هذه المعلومات؟ (نعم / تعديل)',
      ].join('\n');
    }

    return [
      'Parfait, voici le recapitulatif de votre besoin:',
      ...checklist.map((line) => `- ${line}`),
      'Confirmez-vous ces informations ? (Oui / Modifier)',
    ].join('\n');
  }

  private async findInternalActorUserId(
    companyId: number,
  ): Promise<number | null> {
    const actor = await this.prisma.user.findFirst({
      where: {
        companyId,
        actif: true,
        role: {
          in: [Role.ADMIN, Role.TECHNICO, Role.CHEF_CHANTIER],
        },
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    return actor?.id ?? null;
  }

  private async createOrReuseAssistantDraftDevis(input: {
    companyId: number;
    actorUserId: number;
    prospectId: number;
    description: string;
    typeProjetId: number | null;
  }): Promise<{ devisId: number; demandeId: number; reference: string | null } | null> {
    try {
      const existingDemande = await this.prisma.demandeDevis.findFirst({
        where: {
          companyId: input.companyId,
          clientId: input.prospectId,
          source: LeadSource.CHATBOT,
          statut: { in: ['NOUVEAU', 'EN_COURS'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reference: true },
      });

      const demandeRecord = existingDemande
        ? existingDemande
        : await this.prisma.demandeDevis.create({
            data: {
              companyId: input.companyId,
              clientId: input.prospectId,
              createurId: input.actorUserId,
              source: LeadSource.CHATBOT,
              description:
                input.description ||
                'Demande qualifiee automatiquement par assistant IA',
              statut: 'EN_COURS',
              besoinStructure: {
                origin: 'assistant-ia-auto',
                created_by: input.actorUserId,
                created_at: new Date().toISOString(),
              },
              reference: this.generateReference(),
            },
            select: { id: true, reference: true },
          });
      const demandeId = demandeRecord.id;
      const demandeReference = demandeRecord.reference;

      const devis = await this.devisService.create(
        {
          clientId: input.prospectId,
          demandeDevisId: demandeId,
          notes:
            'Devis brouillon genere automatiquement depuis le chatbot assistant.',
        },
        input.actorUserId,
        input.companyId,
      );

      await this.autoPopulateDraftDevisFromCatalogue({
        devisId: devis.id,
        companyId: input.companyId,
        typeProjetId: input.typeProjetId,
      });

      return { devisId: devis.id, demandeId, reference: demandeReference };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[IA] Echec creation devis brouillon assistant (prospect ${input.prospectId}): ${message}`,
      );
      return null;
    }
  }

  private async dispatchUrgentNotification(input: {
    companyId: number;
    sessionId: number;
    devisId: number | null;
    projectType: string;
    collectedData: AssistantResult['collected_data'];
    message: string;
  }) {
    const urgentComment = input.message
      .replace(/\b(oui|yes|urgent|asap|ok)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    await this.notificationsService.createInternalNotification({
      companyId: input.companyId,
      entite: input.devisId ? 'devis' : 'chat_session',
      entiteId: input.devisId ?? input.sessionId,
      action: 'NOTIFICATION_ASSISTANT_URGENT_DEVIS',
      category: 'SUPPLIER_STATUS',
      level: 'warning',
      title: `Demande urgente assistant IA - ${input.collectedData.nom || 'Client'}`,
      message:
        `Prioritaire: ${input.projectType}. ` +
        `Client: ${input.collectedData.nom || '-'} / ${input.collectedData.telephone || '-'} / ${input.collectedData.email || '-'}. ` +
        `Besoin: ${input.collectedData.description || '-'}.`,
      metadata: {
        origin: 'assistant-ia',
        urgent: true,
        sessionId: input.sessionId,
        devisId: input.devisId,
        comment: urgentComment || null,
      },
    });

    if (input.devisId) {
      const devis = await this.prisma.devis.findFirst({
        where: { id: input.devisId, companyId: input.companyId },
        select: { notes: true },
      });

      const urgentNote = [
        `[URGENT CHATBOT ${new Date().toISOString()}]`,
        urgentComment || 'Client demande un traitement urgent.',
      ].join(' ');

      await this.prisma.devis.update({
        where: { id: input.devisId },
        data: {
          notes: [devis?.notes?.trim() || '', urgentNote]
            .filter((entry) => entry.length > 0)
            .join('\n'),
        },
      });
    }
  }

  // ============================================================
  // SMART RESPONSE: Reponse intelligente et contextuelle
  // ============================================================
  private async buildSmartResponse(input: {
    normalizedMessage: string;
    language: 'fr' | 'ar';
    intent: AssistantIntent;
    detectedIntents: CommercialIntent[];
    serviceOnlyRequest: boolean;
    projectType: string;
    projectMatch: {
      known: boolean;
      projectType: string;
      suggestedType: string | null;
    };
    projectTypeConflict: boolean;
    pendingProjectType: string | null;
    sessionState: ConversationSessionState;
    previousSessionState: ConversationSessionState;
    mergedCollectedData: AssistantResult['collected_data'];
    missingFields: string[];
    isUrgent: boolean;
    companyId: number;
    projectTypes: Array<{
      id: number;
      nom: string;
      description: string | null;
    }>;
  }): Promise<string> {
    const msg = input.normalizedMessage.toLowerCase();
    const state = input.sessionState;
    const data = input.mergedCollectedData;
    const missing = input.missingFields;

    // ---------- 1. Salutations simples ----------
    if (this.isGreeting(msg) && !state.projectType && !data.nom) {
      return 'Bonjour ! 😊 Je peux vous aider pour un devis, des prix, un suivi, ou la liste de nos services.';
    }

    // ---------- 2. Remerciements ----------
    if (this.isThanks(msg)) {
      return 'Avec plaisir. Je reste disponible si vous avez une autre question. 😊';
    }

    // ---------- 3. Demande d'information sur les services ----------
    if (input.serviceOnlyRequest) {
      const serviceResponse = await this.buildServiceOrPriceResponse({
        intent: 'demande_info_service',
        companyId: input.companyId,
        projectType: input.projectType,
        suggestedType: input.projectMatch.suggestedType,
        message: input.normalizedMessage,
        projectTypes: input.projectTypes,
      });
      return serviceResponse;
    }

    // ---------- 4. Demande de prix ----------
    if (
      input.intent === 'demande_prix' &&
      !input.detectedIntents.includes('demande_devis')
    ) {
      return await this.buildServiceOrPriceResponse({
        intent: 'demande_prix',
        companyId: input.companyId,
        projectType: input.projectType,
        suggestedType: input.projectMatch.suggestedType,
        message: input.normalizedMessage,
        projectTypes: input.projectTypes,
      });
    }

    // ---------- 5. Conflit type de projet ----------
    if (input.projectTypeConflict && input.pendingProjectType) {
      return `J'ai compris que vous parlez de "${input.pendingProjectType}", mais on avait commence avec "${state.projectType}". Lequel souhaitez-vous ? (${state.projectType} / ${input.pendingProjectType})`;
    }

    // ---------- 5.b Flux checklist DB pilote par choix client ----------
    const dbDrivenChecklistResponse = await this.buildDbDrivenChecklistResponse({
      companyId: input.companyId,
      intent: input.intent,
      detectedIntents: input.detectedIntents,
      projectType: input.projectType,
      projectKnown: input.projectMatch.known,
      message: input.normalizedMessage,
    });
    // Ne pas court-circuiter le parcours rendez-vous avec la checklist devis.
    const isRdvFlow =
      input.detectedIntents.includes('demande_rdv') &&
      !input.detectedIntents.includes('demande_devis');
    if (dbDrivenChecklistResponse && !isRdvFlow) {
      return dbDrivenChecklistResponse;
    }
    // ---------- 6. Demande RDV ----------
    if (
      input.detectedIntents.includes('demande_rdv') &&
      !input.detectedIntents.includes('demande_devis')
    ) {
      const parts: string[] = [
        "Bien sur ! Pour planifier un rendez-vous, j'ai besoin de quelques infos :",
      ];
      // Le client a-t-il tente un numero trop court (4 a 7 chiffres) ?
      // Si oui, on explique pourquoi on redemande (evite la boucle silencieuse).
      const compactMsg = input.normalizedMessage.replace(/[\s.\-()]/g, '');
      const attemptedShortPhone =
        !data.telephone && /(^|\D)\d{4,7}(\D|$)/.test(compactMsg);
      // Un email tente mais invalide (contient un @ mais mal forme) ?
      const attemptedBadEmail =
        !data.email &&
        /\S+@\S*/.test(input.normalizedMessage) &&
        !/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
          input.normalizedMessage,
        );
      if (!data.nom) parts.push('- Votre nom complet');
      if (!data.telephone)
        parts.push(
          attemptedShortPhone
            ? '- Votre numero de telephone (⚠️ celui indique semble incomplet : 8 chiffres minimum)'
            : '- Votre numero de telephone',
        );
      if (!data.email)
        parts.push(
          attemptedBadEmail
            ? '- Votre email (⚠️ celui indique semble incorrect, ex: nom@domaine.com)'
            : '- Votre email',
        );
      if (parts.length === 1) {
        return `Parfait ${data.nom} ! Votre demande de rendez-vous a ete notee. Notre equipe vous contactera rapidement au ${data.telephone || data.email}. 📅`;
      }
      return parts.join('\n');
    }

    // ---------- 7. Demande de suivi ----------
    if (input.detectedIntents.includes('demande_suivi')) {
      // On tente de retrouver la demande par reference (DEM-X) ou email.
      const suiviResult = await this.buildSuiviResponse({
        companyId: input.companyId,
        message: input.normalizedMessage,
        email: input.sessionState.email,
      });
      if (suiviResult) {
        return suiviResult;
      }
      // Pas encore de reference/email fournis : on les demande.
      return (
        'Bien sur, je peux verifier l\'avancement de votre demande. 📋\n' +
        'Donnez-moi votre reference de suivi (ex: DEM-14) ou l\'email utilise lors de votre demande.'
      );
    }

    // ---------- 8. Information generale / questions ----------
    if (input.intent === 'information_generale') {
      return 'Nous realisons des travaux de batiment (renovation, peinture, isolation, plomberie...). Souhaitez-vous les services, les prix, ou un devis ?';
    }

    // ---------- 9. Projet non connu en base ----------
    if (
      (input.intent === 'demande_devis' ||
        input.detectedIntents.includes('demande_devis')) &&
      !input.projectMatch.known &&
      state.projectType &&
      state.projectType !== 'AUTRE'
    ) {
      const suggestion = input.projectMatch.suggestedType
        ? `\nLe plus proche dans notre catalogue : **${input.projectMatch.suggestedType}**. Souhaitez-vous continuer avec celui-ci ?`
        : '';
      return [
        `Je comprends votre besoin de "${state.projectType}". Ce type n'est pas encore dans notre catalogue, mais j'enregistre votre demande pour notre equipe.`,
        suggestion,
        '',
        this.buildProjectTypesListMessage({
          availableProjectTypes: this.pickDisplayedProjectTypes(
            input.projectTypes,
          ),
          intro: 'Nos services disponibles actuellement :',
          emptyMessage: 'Le catalogue est en cours de mise a jour.',
        }),
      ]
        .filter(Boolean)
        .join('\n');
    }

    // ---------- 10. Construction de la reponse contextuelle ----------
    const contextualResponse = this.buildContextualResponse({
      message: input.normalizedMessage,
      language: input.language,
      intent: input.intent,
      detectedIntents: input.detectedIntents,
      projectType: input.projectType,
      projectMatch: input.projectMatch,
      sessionState: state,
      previousSessionState: input.previousSessionState,
      collectedData: data,
      missingFields: missing,
      isUrgent: input.isUrgent,
      projectTypes: input.projectTypes,
    });

    const shouldGuideDevis =
      (input.intent === 'demande_devis' ||
        input.detectedIntents.includes('demande_devis')) &&
      input.projectMatch.known &&
      Boolean(input.sessionState.projectType);

    if (!shouldGuideDevis) {
      return contextualResponse;
    }

    const guidance = await this.buildDevisQualificationGuidance({
      companyId: input.companyId,
      projectType: input.sessionState.projectType || input.projectType,
    });

    if (!guidance) {
      return contextualResponse;
    }

    return `${contextualResponse}\n\n${guidance}`;
  }

  private buildContextualResponse(input: {
    message: string;
    language: 'fr' | 'ar';
    intent: AssistantIntent;
    detectedIntents: CommercialIntent[];
    projectType: string;
    projectMatch: {
      known: boolean;
      projectType: string;
      suggestedType: string | null;
    };
    sessionState: ConversationSessionState;
    previousSessionState: ConversationSessionState;
    collectedData: AssistantResult['collected_data'];
    missingFields: string[];
    isUrgent: boolean;
    projectTypes: Array<{
      id: number;
      nom: string;
      description: string | null;
    }>;
  }): string {
    const state = input.sessionState;
    const previousState = input.previousSessionState;
    const data = input.collectedData;
    const missing = input.missingFields.filter((f) => f !== 'projectType');
    const devisMissing = this.getDevisQualificationMissingFields(state, data);
    const isDevisFlow =
      input.intent === 'demande_devis' ||
      input.detectedIntents.includes('demande_devis');

    // Construire un accusé de réception de ce qu'on a compris
    const understood: string[] = [];
    if (data.nom && !previousState.nom)
      understood.push(`votre nom (${data.nom})`);
    if (data.telephone && !previousState.telephone)
      understood.push('votre telephone');
    if (data.email && !previousState.email) understood.push('votre email');
    if (data.description) understood.push(`votre besoin`);

    const acknowledgment =
      understood.length > 0 ? `J'ai bien note ${understood.join(', ')}. ` : '';

    // Si le client vient de se presenter (nom donne)
    if (data.nom && !previousState.nom && missing.length > 0) {
      const hasContact = data.telephone || data.email;
      if (!hasContact) {
        return `${acknowledgment}Ravi de vous connaitre ${data.nom} ! 😊 Pour bien vous accompagner, pourriez-vous me donner votre telephone et votre email ?`;
      }
    }

    // Si le client a donne des infos de contact mais pas de besoin
    if (
      data.nom &&
      (data.telephone || data.email) &&
      !data.description &&
      isDevisFlow
    ) {
      return `Merci ${data.nom} ! Quel type de travaux souhaitez-vous realiser ? Decrivez votre projet librement, je m'adapte. 🏠`;
    }

    // Si on n'a pas le type de projet mais on a un besoin
    if (!state.projectType && data.description && isDevisFlow) {
      return [
        `Je comprends votre besoin : "${data.description}".`,
        'Pour mieux vous orienter, quel type de travaux principal ?',
        '',
        this.buildProjectTypesListMessage({
          availableProjectTypes: this.pickDisplayedProjectTypes(
            input.projectTypes,
          ),
          intro: 'Nos services :',
        }),
      ].join('\n');
    }

    // Si on a le projet mais il manque des infos client
    if (state.projectType && devisMissing.length > 0 && isDevisFlow) {
      const projectAck = input.projectMatch.known
        ? `Parfait, projet "${state.projectType}" bien identifie ! ✅`
        : `J'ai note votre besoin de "${state.projectType}".`;

      // Detection des tentatives invalides pour expliquer le refus (anti-boucle) :
      // un numero trop court ou un email malforme donnent un message explicite.
      const compactMsgDevis = input.message.replace(/[\s.\-()]/g, '');
      const attemptedShortPhoneDevis = /(^|\D)\d{4,7}(\D|$)/.test(compactMsgDevis);
      const attemptedBadEmailDevis =
        /\S+@\S*/.test(input.message) &&
        !/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(
          input.message,
        );
      const missingLabels = devisMissing.map((field) => {
        switch (field) {
          case 'nom':
            return 'votre nom complet';
          case 'telephone':
            return attemptedShortPhoneDevis
              ? 'votre telephone (⚠️ celui indique semble incomplet : 8 chiffres minimum)'
              : 'votre telephone';
          case 'email':
            return attemptedBadEmailDevis
              ? 'votre email (⚠️ celui indique semble incorrect, ex: nom@domaine.com)'
              : 'votre email';
          case 'projectType':
            return 'le type de projet';
          default:
            return field;
        }
      });

      if (missingLabels.length === 1) {
        return `${acknowledgment}${projectAck}\n\nIl me manque seulement ${missingLabels[0]} pour enregistrer votre demande de devis.`;
      }

      if (missingLabels.length <= 2) {
        return `${acknowledgment}${projectAck}\n\nPour enregistrer votre demande de devis, il me manque : ${missingLabels.join(' et ')}.`;
      }

      return `${acknowledgment}${projectAck}\n\nPour enregistrer votre demande de devis, merci de me donner :\n${missingLabels.map((l) => `- ${l}`).join('\n')}`;
    }

    // Si on a tout mais pas en mode devis
    if (!isDevisFlow && data.nom) {
      return `Merci ${data.nom} ! Je suis là pour vous aider. Souhaitez-vous :\n- 📋 **Découvrir nos services** disponibles\n- 📝 **Préparer un devis** personnalisé\n- 📅 **Prendre rendez-vous** avec notre équipe\n\nDites-moi ce qui vous intéresse !`;
    }

    // Si le message est court et sans contexte
    if (input.message.length < 10 && !data.nom) {
      return 'Je suis votre assistant BatiCRM 🏗️ Dites-moi comment je peux vous aider : informations sur nos services, tarifs, ou demande de devis !';
    }

    // Si le client a donne un long message avec beaucoup d'infos
    if (input.message.length > 50 && data.nom && data.description) {
      const missingContact = !data.telephone && !data.email;
      if (missingContact) {
        return `${acknowledgment}Merci pour ces details ${data.nom} ! Pour vous recontacter avec le devis, j'ai besoin de votre telephone et email.`;
      }
    }

    // Reponse par defaut - question ouverte adaptee
    if (data.nom) {
      return `${acknowledgment}Merci ${data.nom}. Comment puis-je vous aider exactement ? Un devis, des tarifs, des infos sur un service ?`;
    }

    // Reponse quand on ne sait rien encore
    if (input.intent === 'demande_devis') {
      return `${acknowledgment}Bien sur, je peux preparer un devis pour vous. Pour commencer, envoyez-moi :\n- Votre nom complet\n- Votre telephone\n- Votre email\n- Le type de projet`;
    }

    return `${acknowledgment}Je suis la pour vous aider ! 😊 Dites-moi votre besoin : un devis, des infos sur nos services, des tarifs... Je m'adapte a votre demande.`;
  }

  private async buildDevisQualificationGuidance(input: {
    companyId: number;
    projectType: string;
  }): Promise<string | null> {
    const checklistItems = await this.buildDevisChecklistItems(input);
    if (checklistItems.length === 0) {
      return null;
    }

    return [
      'Pour affiner le devis automatique, merci de preciser :',
      ...checklistItems.map((line) => `- ${line}`),
      'Avec ces choix, je peux generer un devis brouillon automatiquement depuis votre description.',
    ].join('\n');
  }

  private async buildDevisChecklistItems(input: {
    companyId: number;
    projectType: string;
  }): Promise<string[]> {
    const projectType = input.projectType.trim();
    if (!projectType || projectType === 'AUTRE') {
      return [];
    }

    const typeProjet = await this.prisma.typeProjet.findFirst({
      where: {
        companyId: input.companyId,
        actif: true,
        nom: projectType,
      },
      select: {
        categories: {
          orderBy: { ordre: 'asc' },
          select: {
            categorie: {
              select: {
                nom: true,
                sousCategories: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    id: true,
                    nom: true,
                  },
                },
                prestations: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  take: 3,
                  select: {
                    nom: true,
                    options: {
                      where: { obligatoire: true },
                      orderBy: { ordre: 'asc' },
                      take: 2,
                      select: {
                        nom: true,
                        choix: {
                          where: { actif: true },
                          orderBy: { ordre: 'asc' },
                          take: 3,
                          select: {
                            nom: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!typeProjet || typeProjet.categories.length === 0) {
      return [];
    }

    const lines: string[] = [];

    for (const categoryEntry of typeProjet.categories.slice(0, 3)) {
      const category = categoryEntry.categorie;

      if (category.sousCategories.length > 0) {
        lines.push(
          `- Sous-categorie ${category.nom}: ${category.sousCategories
            .slice(0, 5)
            .map((item) => item.nom)
            .join(', ')}`,
        );
      }

      for (const prestation of category.prestations) {
        for (const option of prestation.options) {
          const choix = option.choix.map((item) => item.nom).join(', ');
          if (choix) {
            lines.push(`- Option ${prestation.nom} / ${option.nom}: ${choix}`);
          }
        }
      }
    }

    return lines;
  }

  private async buildStructuredWorkflowPreview(input: {
    companyId: number;
    projectType: string;
  }): Promise<AssistantResult['structured_workflow'] | undefined> {
    const normalizedType = input.projectType.trim();
    if (!normalizedType || normalizedType === 'AUTRE') return undefined;

    const matchedType = await this.prisma.typeProjet.findFirst({
      where: {
        companyId: input.companyId,
        actif: true,
        nom: normalizedType,
      },
      select: {
        id: true,
        nom: true,
        categories: {
          orderBy: { ordre: 'asc' },
          select: {
            categorie: {
              select: {
                id: true,
                nom: true,
                description: true,
                sousCategories: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    id: true,
                    nom: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!matchedType) return undefined;

    const categories = matchedType.categories.map((entry) => entry.categorie);
    const selectedCategoryId = categories[0]?.id ?? null;
    const selectedCategory =
      categories.find((item) => item.id === selectedCategoryId) ?? null;
    const sousCategories = selectedCategory?.sousCategories ?? [];

    const prestations = await this.prisma.prestation.findMany({
      where: {
        companyId: input.companyId,
        actif: true,
        categorieId: selectedCategoryId || undefined,
      },
      orderBy: { nom: 'asc' },
      take: 25,
      select: {
        id: true,
        nom: true,
        description: true,
        prixVenteMin: true,
        prixVenteMax: true,
        options: {
          orderBy: { ordre: 'asc' },
          select: {
            id: true,
            nom: true,
            obligatoire: true,
            choix: {
              where: { actif: true },
              orderBy: { ordre: 'asc' },
              select: {
                id: true,
                nom: true,
                impactPrix: true,
              },
            },
          },
        },
      },
    });

    return {
      status: 'NEEDS_CHECKLIST_SELECTION',
      project_type: normalizedType,
      categories: categories.map((item) => ({
        id: item.id,
        nom: item.nom,
        description: item.description,
      })),
      sous_categories: sousCategories.map((item) => ({
        id: item.id,
        nom: item.nom,
        description: item.description,
      })),
      prestations: prestations.map((prestation) => ({
        id: prestation.id,
        nom: prestation.nom,
        description: prestation.description,
        prixVenteMin: prestation.prixVenteMin,
        prixVenteMax: prestation.prixVenteMax,
        options: prestation.options.map((option) => ({
          id: option.id,
          nom: option.nom,
          obligatoire: option.obligatoire,
          choix: option.choix,
        })),
      })),
      selected: {
        categoryId: selectedCategoryId,
        sousCategorieId: null,
        prestationId: null,
      },
      missing_option_ids: [],
      can_validate: false,
    };
  }

  private appendChecklistQuestions(input: {
    baseMessage: string;
    workflow: NonNullable<AssistantResult['structured_workflow']>;
  }): string {
    const categories = input.workflow.categories.slice(0, 8);
    const prestations = input.workflow.prestations.slice(0, 12);
    const selectedPrestation = input.workflow.prestations.find(
      (item) => item.id === input.workflow.selected.prestationId,
    );
    const fallbackPrestation = input.workflow.prestations[0];
    const targetPrestation = selectedPrestation || fallbackPrestation;
    const requiredOptions = (targetPrestation?.options || [])
      .filter((option) => option.obligatoire)
      .slice(0, 6);

    if (
      categories.length === 0 &&
      prestations.length === 0 &&
      requiredOptions.length === 0
    ) {
      return input.baseMessage;
    }

    const lines: string[] = [
      'Pour comprendre votre besoin precis, merci de repondre a ces questions :',
    ];

    if (categories.length > 0) {
      lines.push('1) Choisissez une categorie:');
      lines.push(...categories.map((item) => `- [ ] ${item.nom}`));
    }

    if (prestations.length > 0) {
      lines.push('2) Choisissez une prestation:');
      lines.push(...prestations.map((item) => `- [ ] ${item.nom}`));
    }

    if (requiredOptions.length > 0) {
      lines.push('3) Choisissez les options obligatoires:');
      for (const option of requiredOptions) {
        const choices = option.choix.slice(0, 8).map((item) => item.nom);
        lines.push(`- ${option.nom}: ${choices.join(', ')}`);
      }
    }

    lines.push(
      '4) Indiquez la surface (m2), delai souhaite et toute contrainte technique.',
    );
    lines.push(
      'Repondez en une seule fois, par exemple: "Categorie: X | Prestation: Y | Options: ...".',
    );

    const questionBlock = lines.join('\n');

    if (input.baseMessage.includes(questionBlock)) {
      return input.baseMessage;
    }

    return `${input.baseMessage}\n\n${questionBlock}`;
  }

  private enrichResponseWithRagContext(input: {
    responseMessage: string;
    snippets: RagSnippet[];
    language: AssistantLanguage;
    intent: AssistantIntent;
    detectedIntents: CommercialIntent[];
    serviceOnlyRequest: boolean;
  }): string {
    if (!this.shouldApplyRagContext(input)) {
      return input.responseMessage;
    }

    const topSnippets = input.snippets.slice(0, 2);
    if (topSnippets.length === 0) {
      return input.responseMessage;
    }

    const header =
      input.language === 'ar'
        ? 'Sources locales (RAG):'
        : 'Sources locales (RAG):';

    const sourceLines = topSnippets.map((snippet) => {
      return `- ${snippet.title}`;
    });

    const baseMessage = input.responseMessage.trim();
    // On n'affiche PLUS les sources RAG au client (texte technique interne).
    // Le contexte RAG sert a guider la reponse, pas a etre montre tel quel.
    return baseMessage;
  }

  private shouldApplyRagContext(input: {
    snippets: RagSnippet[];
    intent: AssistantIntent;
    detectedIntents: CommercialIntent[];
    serviceOnlyRequest: boolean;
  }): boolean {
    if (input.snippets.length === 0) {
      return false;
    }

    if (input.serviceOnlyRequest) {
      return true;
    }

    if (input.intent === 'demande_info_service') {
      return true;
    }

    if (input.intent === 'demande_prix') {
      return true;
    }

    return (
      input.intent === 'information_generale' ||
      input.detectedIntents.includes('demande_information') ||
      input.detectedIntents.includes('demande_service')
    );
  }

  private isGreeting(message: string): boolean {
    const normalized = this.normalizeForMatch(message);
    const greetings = [
      'bonjour',
      'bonsoir',
      'salut',
      'hello',
      'hi',
      'hey',
      'bj',
      'slt',
      'coucou',
      'yo',
    ];
    return greetings.some(
      (g) => normalized === g || normalized.startsWith(`${g} `),
    );
  }

  private async buildDbDrivenChecklistResponse(input: {
    companyId: number;
    intent: AssistantIntent;
    detectedIntents: CommercialIntent[];
    projectType: string;
    projectKnown: boolean;
    message: string;
  }): Promise<string | null> {
    const isDevisFlow =
      input.intent === 'demande_devis' ||
      input.detectedIntents.includes('demande_devis');
    if (!isDevisFlow || !input.projectKnown || !input.projectType) {
      return null;
    }

    const typeProjet = await this.prisma.typeProjet.findFirst({
      where: {
        companyId: input.companyId,
        actif: true,
        nom: input.projectType,
      },
      select: {
        id: true,
        nom: true,
        categories: {
          orderBy: { ordre: 'asc' },
          select: {
            categorie: {
              select: {
                id: true,
                nom: true,
                sousCategories: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    id: true,
                    nom: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!typeProjet || typeProjet.categories.length === 0) {
      return null;
    }

    const categories = typeProjet.categories.map((entry) => entry.categorie);
    const normalizedMessage = this.normalizeForMatch(input.message);
    const matchedCategory = categories.find((category) =>
      normalizedMessage.includes(this.normalizeForMatch(category.nom)),
    );

    if (matchedCategory) {
      const subs = matchedCategory.sousCategories;
      if (subs.length === 0) {
        return `Categorie choisie: ${matchedCategory.nom}. Cette categorie n'a pas de sous-categorie active. Dites-moi la prestation exacte souhaitee.`;
      }

      const matchedSub = subs.find((sub) =>
        normalizedMessage.includes(this.normalizeForMatch(sub.nom)),
      );

      if (matchedSub) {
        const prestations = await this.prisma.prestation.findMany({
          where: {
            companyId: input.companyId,
            actif: true,
            categorieId: matchedCategory.id,
            sousCategorieId: matchedSub.id,
          },
          orderBy: { nom: 'asc' },
          take: 12,
          select: { id: true, nom: true },
        });

        if (prestations.length === 0) {
          return `Parfait, sous-categorie "${matchedSub.nom}" notee. Aucune prestation active n'est configuree pour ce sous-type. Notre equipe technico vous proposera une solution personnalisee.`;
        }

        return [
          `Parfait, vous avez choisi "${matchedSub.nom}".`,
          'Choisissez maintenant la prestation :',
          ...prestations.map((item, index) => `${index + 1}. ${item.nom}`),
          'Ensuite je vous poserai les options obligatoires pour generer le devis automatiquement.',
        ].join('\n');
      }

      return [
        `Tres bien. Categorie choisie: ${matchedCategory.nom}.`,
        'Choisissez une sous-categorie :',
        ...subs.map((item, index) => `${index + 1}. ${item.nom}`),
      ].join('\n');
    }

    return [
      `Service detecte: ${typeProjet.nom}.`,
      'Choisissez une categorie :',
      ...categories.map((item, index) => `${index + 1}. ${item.nom}`),
      'Repondez par le numero ou le nom de la categorie.',
    ].join('\n');
  }

  private isThanks(message: string): boolean {
    const normalized = this.normalizeForMatch(message);
    const thanks = [
      'merci',
      'thanks',
      'thank',
      'shukran',
      'choukran',
      'super',
      'parfait',
      'excellent',
      'genial',
    ];
    return thanks.some(
      (t) =>
        normalized === t ||
        normalized.startsWith(`${t} `) ||
        normalized.includes(` ${t}`),
    );
  }
}
