jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../devis/devis.service', () => ({
  DevisService: class DevisServiceMock {},
}));

jest.mock('../clients/clients.service', () => ({
  ClientsService: class ClientsServiceMock {},
}));

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsServiceMock {},
}));

jest.mock('./assistant-llm.service', () => ({
  AssistantLlmService: class AssistantLlmServiceMock {},
}));

jest.mock('./assistant-rag.service', () => ({
  AssistantRagService: class AssistantRagServiceMock {},
}));

jest.mock('../../generated/prisma/client', () => ({
  LeadSource: { CHATBOT: 'CHATBOT' },
  Role: {
    ADMIN: 'ADMIN',
    TECHNICO: 'TECHNICO',
    CHEF_CHANTIER: 'CHEF_CHANTIER',
  },
  Prisma: {},
}));

const { AssistantService } = require('./assistant.service');

describe('AssistantService conversation logic', () => {
  let service: any;

  beforeEach(() => {
    service = new AssistantService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('classifies "je veux un devis peinture" as demande_devis', () => {
    const result = (service as any).detectIntentWithConfidence(
      'je veux un devis peinture',
      'autre',
      undefined,
    );

    expect(result.intent).toBe('demande_devis');
    expect(result.detectedIntents).toContain('demande_devis');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('classifies "combien pour refaire une salle de bain" as demande_prix', () => {
    const result = (service as any).detectIntentWithConfidence(
      'combien pour refaire une salle de bain',
      'autre',
      undefined,
    );

    expect(result.intent).toBe('demande_prix');
    expect(result.detectedIntents[0]).toBe('demande_prix');
  });

  it('detects urgency and service signal for "c urgent fuite plomberie"', () => {
    const isUrgent = (service as any).isUrgentMessage(
      'c urgent fuite plomberie',
    );
    const intents = (service as any).detectCommercialIntents({
      message: 'c urgent fuite plomberie',
      fallbackIntent: 'autre',
    });

    expect(isUrgent).toBe(true);
    expect(intents).toContain('demande_service');
  });

  it('extracts malformed contact and need fields', () => {
    const extracted = (service as any).extractFields(
      'amal saidani 22123456 je veux peinture 50m2',
    );

    expect(extracted.nom.toLowerCase()).toContain('amal');
    expect(extracted.telephone).toBe('22123456');
    expect(extracted.description.toLowerCase()).toContain('peinture');
  });

  it('keeps service-only intent for "je veux juste connaître vos services"', () => {
    const result = (service as any).detectIntentWithConfidence(
      'je veux juste connaitre vos services',
      'autre',
      undefined,
    );

    expect(result.intent).toBe('demande_info_service');
    expect(result.detectedIntents[0]).toBe('demande_service');
    expect(result.scores.demande_devis).toBeLessThan(
      result.scores.demande_service,
    );
  });

  it('understands "type de project dispo" as service intent', () => {
    const result = (service as any).detectIntentWithConfidence(
      'je veux savoir type de project dispo',
      'autre',
      undefined,
    );

    expect(result.intent).toBe('demande_info_service');
    expect(result.detectedIntents).toContain('demande_service');
    expect(result.confidence).toBeGreaterThanOrEqual(0.44);
  });

  it('handles typo-heavy service request with NLP boost', () => {
    const result = (service as any).detectIntentWithConfidence(
      'kel type de project dispo svp',
      'autre',
      undefined,
    );

    expect(result.intent).toBe('demande_info_service');
    expect(result.detectedIntents).toContain('demande_service');
  });

  it('does not ask generic clarification when keyword is explicit (devis)', () => {
    const clarification = (service as any).buildLowConfidenceClarification({
      message: 'devis',
      intent: {
        intent: 'autre',
        detectedIntents: ['autre'],
        scores: {
          demande_service: 0.1,
          demande_devis: 0.12,
          demande_information: 0.08,
          demande_prix: 0.09,
          demande_rdv: 0.05,
          demande_suivi: 0.04,
          demande_validation: 0.02,
          autre: 0.2,
        },
        ranking: [{ intent: 'autre', score: 0.2 }],
        confidence: 0.2,
        ambiguous: false,
      },
      projectTypeConfidence: 0.2,
      suggestedProjectType: null,
      detectedIntents: ['autre'],
    });

    expect(clarification).toBeNull();
  });

  it('requires full name (nom + prenom) and rejects placeholders', () => {
    expect((service as any).isLikelyName('Amal')).toBe(false);
    expect((service as any).isLikelyName('client')).toBe(false);
    expect((service as any).isLikelyName('Amal Saidani')).toBe(true);
  });

  it('does not flag project type conflict without explicit change signal', () => {
    const msg = 'je veux devis isolation';
    expect(/(changer|change|finalement|plutot|au lieu|remplacer|modifier)/i.test(msg)).toBe(false);
  });

  it('requires only core devis fields for qualification gate', () => {
    const missing = (service as any).getDevisQualificationMissingFields(
      {
        nom: 'Amal Saidani',
        telephone: '0612345678',
        email: 'amal@example.com',
        projectType: 'Isolation',
        surface: null,
        delai: null,
        urgent: false,
        confirmed: false,
      },
      {
        nom: 'Amal Saidani',
        telephone: '0612345678',
        email: 'amal@example.com',
        description: '',
      },
    );

    expect(missing).toEqual([]);
  });

  it('does not treat project wording as client name', () => {
    const extracted = (service as any).extractFields(
      'je veux devis toiture pour ma maison',
    );

    expect(extracted.nom).toBe('');
    expect(extracted.description.toLowerCase()).toContain('toiture');
  });

  it('does not treat intent sentence as client name', () => {
    const extracted = (service as any).extractFields(
      'je veux devis carrelage',
    );

    expect(extracted.nom).toBe('');
    expect(extracted.description.toLowerCase()).toContain('carrelage');
  });

  it('extracts full name when message contains name + email only', () => {
    const extracted = (service as any).extractFields(
      'amal saidani, amal@gmail.com',
    );

    expect(extracted.nom.toLowerCase()).toBe('amal saidani');
    expect(extracted.email).toBe('amal@gmail.com');
    expect(extracted.telephone).toBe('');
  });

  it('requires phone and project type before registration', () => {
    const missing = (service as any).getRegistrationMissingFields({
      collectedData: {
        nom: 'Amal Saidani',
        telephone: '',
        email: 'amal@gmail.com',
        description: 'Je veux devis carrelage',
      },
      projectType: 'AUTRE',
    });

    expect(missing).toContain('telephone');
    expect(missing).toContain('projectType');
  });

  it('allows registration only when full required fields are present', () => {
    const missing = (service as any).getRegistrationMissingFields({
      collectedData: {
        nom: 'Amal Saidani',
        telephone: '0612345678',
        email: 'amal@gmail.com',
        description: 'Je veux devis carrelage',
      },
      projectType: 'Carrelage',
    });

    expect(missing).toEqual([]);
  });

  it('does not show generic low-confidence question for identity-only message', () => {
    const clarification = (service as any).buildLowConfidenceClarification({
      message: 'amell saidani',
      intent: {
        intent: 'autre',
        detectedIntents: ['autre'],
        scores: {
          demande_service: 0.1,
          demande_devis: 0.1,
          demande_information: 0.1,
          demande_prix: 0.1,
          demande_rdv: 0.1,
          demande_suivi: 0.1,
          demande_validation: 0.05,
          autre: 0.2,
        },
        ranking: [{ intent: 'autre', score: 0.2 }],
        confidence: 0.2,
        ambiguous: false,
      },
      projectTypeConfidence: 0.2,
      suggestedProjectType: null,
      detectedIntents: ['autre'],
    });

    expect(clarification).toBeNull();
  });

  it('maps typo project type carralage to Carrelage', () => {
    const result = (service as any).matchProjectTypeWithConfidence(
      'je veux devis de carralage',
      ['Carrelage', 'Plomberie', 'Peinture'],
    );

    expect(result.known).toBe(true);
    expect(result.projectType).toBe('Carrelage');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('answers yes when asked availability for an existing service type', () => {
    const result = (service as any).resolveServiceAvailabilityCheck({
      message: 'isolation dispo ?',
      projectTypes: [{ nom: 'Isolation' }, { nom: 'Peinture' }],
      targetTypeHint: '',
    });

    expect(result.isAvailabilityQuery).toBe(true);
    expect(result.isAvailable).toBe(true);
  });

  it('answers not available when asked availability for an unknown service type', () => {
    const result = (service as any).resolveServiceAvailabilityCheck({
      message: 'climatisation dispo ?',
      projectTypes: [{ nom: 'Isolation' }, { nom: 'Peinture' }],
      targetTypeHint: '',
    });

    expect(result.isAvailabilityQuery).toBe(true);
    expect(result.isAvailable).toBe(false);
  });
});
