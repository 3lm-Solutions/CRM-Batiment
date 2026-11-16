jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../mail/mail.service.js', () => ({
  MailService: class MailServiceMock {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtServiceMock {},
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigServiceMock {},
}));

jest.mock('../common/workflow-state.service.js', () => ({
  WorkflowStateService: class WorkflowStateServiceMock {},
}));

jest.mock('../../generated/prisma/client.js', () => ({
  DevisStatut: {
    BROUILLON: 'BROUILLON',
    ENVOYE: 'ENVOYE',
    ACCEPTE: 'ACCEPTE',
    SIGNE: 'SIGNE',
    REFUSE: 'REFUSE',
    REVISE: 'REVISE',
    RENVOYE: 'RENVOYE',
    ANNULE: 'ANNULE',
  },
  ChantierStatut: {
    PLANIFIE: 'PLANIFIE',
  },
  Unite: {
    U: 'U',
    FORFAIT: 'FORFAIT',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { DevisService } from './devis.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WorkflowStateService } from '../common/workflow-state.service.js';

describe('DevisService - Devis Signé -> Création automatique du Chantier', () => {
  let service: DevisService;
  let prisma: any;

  const mockPrismaService = {
    devis: {
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    chantier: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    facture: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    bonCommande: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    commandeFournisseur: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockMailService = {};
  const mockJwtService = {};
  const mockConfigService = {
    get: jest.fn((key, def) => def),
  };
  const mockWorkflowStateService = {
    validateTransition: jest.fn(),
    validateChantierTransition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevisService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WorkflowStateService,
          useValue: mockWorkflowStateService,
        },
      ],
    }).compile();

    service = module.get<DevisService>(DevisService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatut with status SIGNE (automatic chantier creation)', () => {
    const mockDevis = {
      id: 10,
      companyId: 3,
      clientId: 2,
      reference: 'DEV-2026-0010',
      statut: 'ACCEPTE',
      totalHT: 1000,
      totalTTC: 1200,
      totalTVA: 200,
      tauxTVA: 20,
      notes: 'Notes devis test',
      versionCourante: 1,
      createurId: 99,
      client: {
        id: 2,
        nom: 'Dupont',
        prenom: 'Jean',
        adresseChantier: '123 Rue du Chantier',
        adresseClient: '456 Rue du Client',
      },
      lignes: [
        {
          id: 100,
          ordre: 1,
          quantite: 2,
          unite: 'U',
          description: 'Ligne test',
          prestation: { nom: 'Prestation A' },
        },
      ],
    };

    const mockCreatedChantier = {
      id: 20,
      companyId: 3,
      clientId: 2,
      reference: 'CH-DEV-2026-0010',
      adresse: '123 Rue du Chantier',
      description: 'Genere automatiquement depuis le devis DEV-2026-0010. Client: Jean Dupont. Detail travaux: Ligne test (2 U). Notes devis: Notes devis test',
      statut: 'PLANIFIE',
    };

    beforeEach(() => {
      // Mock common findFirst to return devis
      prisma.devis.findFirst.mockResolvedValue(mockDevis);
      prisma.devis.update.mockResolvedValue({ ...mockDevis, statut: 'SIGNE', chantierId: 20 });
      prisma.chantier.findUnique.mockResolvedValue(null); // Reference unique checks
      prisma.chantier.create.mockResolvedValue(mockCreatedChantier);
      prisma.facture.findFirst.mockResolvedValue({ id: 50, reference: 'FAC-2026-0001' });
      prisma.bonCommande.findUnique.mockResolvedValue({ id: 60, reference: 'BC-2026-0001' });
      prisma.commandeFournisseur.findMany.mockResolvedValue([]); // No supplier orders
      prisma.chantier.update.mockResolvedValue(mockCreatedChantier);
      
      // Mock counts for unique document references
      prisma.facture.count.mockResolvedValue(0);
      prisma.bonCommande.count.mockResolvedValue(0);
      prisma.commandeFournisseur.count.mockResolvedValue(0);
    });

    it('should create a new chantier if no chantier is linked to the devis yet', async () => {
      // Devis doesn't have chantierId initially
      const devisWithoutChantier = { ...mockDevis, chantierId: null };
      prisma.devis.findFirst.mockResolvedValue(devisWithoutChantier);

      const result = await service.updateStatut(10, { statut: 'SIGNE' }, 3);

      // Verify chantier was created
      expect(prisma.chantier.create).toHaveBeenCalledWith({
        data: {
          companyId: 3,
          clientId: 2,
          reference: 'CH-DEV-2026-0010',
          adresse: '123 Rue du Chantier',
          description: 'Genere automatiquement depuis le devis DEV-2026-0010. Client: Jean Dupont. Detail travaux: Ligne test (2 U). Notes devis: Notes devis test',
          statut: 'PLANIFIE',
        },
        select: { id: true },
      });

      // Verify devis was updated to link to the created chantier
      expect(prisma.devis.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { chantierId: 20 },
      });

      expect(result.currentStatut).toBe('SIGNE');
    });

    it('should NOT create a new chantier if a chantier is already linked to the devis', async () => {
      // Devis already has a linked chantierId
      const devisWithChantier = { ...mockDevis, chantierId: 20 };
      prisma.devis.findFirst.mockResolvedValue(devisWithChantier);

      const result = await service.updateStatut(10, { statut: 'SIGNE' }, 3);

      // Verify no new chantier was created
      expect(prisma.chantier.create).not.toHaveBeenCalled();

      // Verify no update to link chantier
      expect(prisma.devis.update).not.toHaveBeenCalledWith({
        where: { id: 10 },
        data: { chantierId: expect.any(Number) },
      });

      expect(result.currentStatut).toBe('SIGNE');
    });

    it('should fall back to client address if adresseChantier is empty', async () => {
      const devisClientAddress = {
        ...mockDevis,
        chantierId: null,
        client: {
          ...mockDevis.client,
          adresseChantier: '',
        },
      };
      prisma.devis.findFirst.mockResolvedValue(devisClientAddress);

      await service.updateStatut(10, { statut: 'SIGNE' }, 3);

      expect(prisma.chantier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adresse: '456 Rue du Client',
        }),
        select: { id: true },
      });
    });

    describe('automatic acompte invoice creation', () => {
      beforeEach(() => {
        prisma.devis.findFirst.mockResolvedValue(mockDevis);
        prisma.facture.findFirst.mockResolvedValue(null); 
        prisma.facture.create.mockResolvedValue({ id: 55, reference: 'FAC-2026-0002' });
      });

      it('should automatically generate a 30% downpayment invoice in BROUILLON status if config is not set', async () => {
        mockConfigService.get.mockImplementation((key, def) => def); // Returns default 30

        await service.updateStatut(10, { statut: 'SIGNE' }, 3);

        // Devis totalHT is 1000, 30% is 300 HT. TVA is 20% -> 60. TTC is 360.
        expect(prisma.facture.create).toHaveBeenCalledWith({
          data: {
            devisId: 10,
            reference: expect.stringMatching(/^FAC-\d{4}-\d{4}$/),
            montantHT: 300,
            montantTVA: 60,
            montantTTC: 360,
            statut: 'BROUILLON',
            typeFacture: 'ACOMPTE',
            acomptePercent: 30,
            acompteMontant: 360,
          },
        });
      });

      it('should generate a 40% downpayment invoice if ACOMPTE_PERCENT is configured to 40', async () => {
        mockConfigService.get.mockReturnValue(40); // Configured to 40%

        await service.updateStatut(10, { statut: 'SIGNE' }, 3);

        // Devis totalHT is 1000, 40% is 400 HT. TVA is 20% -> 80. TTC is 480.
        expect(prisma.facture.create).toHaveBeenCalledWith({
          data: {
            devisId: 10,
            reference: expect.stringMatching(/^FAC-\d{4}-\d{4}$/),
            montantHT: 400,
            montantTVA: 80,
            montantTTC: 480,
            statut: 'BROUILLON',
            typeFacture: 'ACOMPTE',
            acomptePercent: 40,
            acompteMontant: 480,
          },
        });
      });

      it('should fall back to 30% if ACOMPTE_PERCENT is configured to an invalid value (e.g. 50)', async () => {
        mockConfigService.get.mockReturnValue(50); // Invalid value

        await service.updateStatut(10, { statut: 'SIGNE' }, 3);

        expect(prisma.facture.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            acomptePercent: 30,
            montantHT: 300,
          }),
        });
      });

      it('should NOT generate a downpayment invoice if one already exists for the devis', async () => {
        // Mock that an invoice already exists
        prisma.facture.findFirst.mockResolvedValue({ id: 50, reference: 'FAC-2026-0001' });

        await service.updateStatut(10, { statut: 'SIGNE' }, 3);

        expect(prisma.facture.create).not.toHaveBeenCalled();
      });
    });

    describe('automatic supplier orders creation', () => {
      const devisWithMaterials = {
        ...mockDevis,
        lignes: [
          {
            id: 101,
            ordre: 1,
            quantite: 5,
            unite: 'U',
            description: 'Ligne materiau avec fournisseur',
            prestationId: null,
            materiau: {
              id: 201,
              nom: 'Materiau Test',
              unite: 'U',
              prixAchatFixe: 10,
              fournisseur: {
                id: 301,
                nom: 'Fournisseur A',
                email: 'fournisseur_a@test.com',
                delaiLivraison: 5,
              },
            },
          },
        ],
      };

      beforeEach(() => {
        prisma.devis.findFirst.mockResolvedValue(devisWithMaterials);
        prisma.facture.findFirst.mockResolvedValue({ id: 50, reference: 'FAC-2026-0001' }); // Prevent invoice creation to focus on supplier orders
        prisma.bonCommande.findUnique.mockResolvedValue({ id: 60, reference: 'BC-2026-0001' }); // Prevent bon de commande creation
        prisma.commandeFournisseur.create.mockResolvedValue({ id: 80, reference: 'BAF-2026-0001' });
      });

      it('should automatically generate a supplier order with status CREEE and set Chantier status to COMMANDES_GENEREES', async () => {
        prisma.commandeFournisseur.findMany
          .mockResolvedValueOnce([]) // First check: no existing orders
          .mockResolvedValueOnce([{ id: 80, reference: 'BAF-2026-0001' }]); // Final check: return created orders

        await service.updateStatut(10, { statut: 'SIGNE' }, 3);

        // Verify supplier order was created
        expect(prisma.commandeFournisseur.create).toHaveBeenCalledWith({
          data: {
            devisId: 10,
            fournisseurId: 301,
            reference: expect.stringMatching(/^BAF-\d{4}-\d{4}$/),
            statutLivraison: 'CREEE',
            dateLivraisonPrevue: expect.any(Date),
            notes: 'Commande generee automatiquement depuis le devis DEV-2026-0010.',
            lignes: {
              create: [
                {
                  materiauNom: 'Materiau Test',
                  quantite: 5,
                  unite: 'U',
                  prixUnitaire: 10,
                  totalHT: 50,
                },
              ],
            },
          },
        });

        // Verify Chantier status was updated to COMMANDES_GENEREES
        expect(prisma.chantier.update).toHaveBeenCalledWith({
          where: { id: 20 },
          data: { statut: 'COMMANDES_GENEREES' },
        });
      });

      it('should NOT create duplicate supplier orders if they already exist', async () => {
        prisma.commandeFournisseur.findMany
          .mockResolvedValueOnce([{ id: 80, fournisseurId: 301, reference: 'BAF-2026-0001' }]) // Already exists
          .mockResolvedValueOnce([{ id: 80, fournisseurId: 301, reference: 'BAF-2026-0001' }]); // Final check

        await service.updateStatut(10, { statut: 'SIGNE' }, 3);

        // Verify no supplier order was created
        expect(prisma.commandeFournisseur.create).not.toHaveBeenCalled();

        // Verify Chantier status was still updated to COMMANDES_GENEREES because orders exist
        expect(prisma.chantier.update).toHaveBeenCalledWith({
          where: { id: 20 },
          data: { statut: 'COMMANDES_GENEREES' },
        });
      });
    });
  });
});
