jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SousTraitantsService } from './sous-traitants.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

describe('SousTraitantsService', () => {
  let service: SousTraitantsService;
  let prisma: any;

  const mockPrismaService = {
    sousTraitant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    contratSousTraitant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    assuranceSousTraitant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    paiementSousTraitant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    disponibiliteSousTraitant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    notationSousTraitant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    chantier: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SousTraitantsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SousTraitantsService>(SousTraitantsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. SousTraitant Tests
  describe('SousTraitant CRUD', () => {
    const mockRecord = { id: 1, companyId: 3, nom: 'SousTraitant A' };

    it('should create a SousTraitant', async () => {
      prisma.sousTraitant.create.mockResolvedValue(mockRecord);
      const res = await service.createSousTraitant({ nom: 'SousTraitant A' }, 3);
      expect(prisma.sousTraitant.create).toHaveBeenCalled();
      expect(res).toEqual(mockRecord);
    });

    it('should find all SousTraitants (paginated)', async () => {
      prisma.sousTraitant.findMany.mockResolvedValue([mockRecord]);
      prisma.sousTraitant.count.mockResolvedValue(1);
      const res = await service.findAllSousTraitants(3, 1, 10);
      expect(res.data).toEqual([mockRecord]);
      expect(res.meta.total).toBe(1);
    });

    it('should find one SousTraitant', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue(mockRecord);
      const res = await service.findOneSousTraitant(1, 3);
      expect(res).toEqual(mockRecord);
    });

    it('should throw NotFoundException if SousTraitant not found', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue(null);
      await expect(service.findOneSousTraitant(99, 3)).rejects.toThrow(NotFoundException);
    });
  });

  // 2. ContratSousTraitant Tests
  describe('ContratSousTraitant CRUD', () => {
    const mockContrat = { id: 2, companyId: 3, sousTraitantId: 1, reference: 'CT-01', montantHT: 5000 };

    it('should create a Contrat', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue({ id: 1 });
      prisma.chantier.findFirst.mockResolvedValue({ id: 10 });
      prisma.contratSousTraitant.create.mockResolvedValue(mockContrat);
      const res = await service.createContrat({
        sousTraitantId: 1,
        chantierId: 10,
        reference: 'CT-01',
        montantHT: 5000
      }, 3);
      expect(res).toEqual(mockContrat);
    });
  });

  // 3. AssuranceSousTraitant Tests
  describe('AssuranceSousTraitant CRUD', () => {
    const mockAssurance = { id: 3, companyId: 3, sousTraitantId: 1, typeAssurance: 'RC' };

    it('should create an Assurance', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue({ id: 1 });
      prisma.assuranceSousTraitant.create.mockResolvedValue(mockAssurance);
      const res = await service.createAssurance({
        sousTraitantId: 1,
        typeAssurance: 'RC',
        numeroAttestation: 'RC-123',
        compagnieAssurance: 'AXA',
        dateExpiration: '2026-12-31'
      }, 3);
      expect(res).toEqual(mockAssurance);
    });
  });

  // 4. PaiementSousTraitant Tests
  describe('PaiementSousTraitant CRUD', () => {
    const mockPaiement = { id: 4, companyId: 3, sousTraitantId: 1, montantHT: 1000 };

    it('should create a Paiement', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue({ id: 1 });
      prisma.paiementSousTraitant.create.mockResolvedValue(mockPaiement);
      const res = await service.createPaiement({
        sousTraitantId: 1,
        montantHT: 1000,
        montantTTC: 1200,
        datePaiement: '2026-07-13',
        modePaiement: 'VIREMENT'
      }, 3);
      expect(res).toEqual(mockPaiement);
    });
  });

  // 5. DisponibiliteSousTraitant Tests
  describe('DisponibiliteSousTraitant CRUD', () => {
    const mockDispo = { id: 5, companyId: 3, sousTraitantId: 1, disponible: true };

    it('should create a Disponibilite', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue({ id: 1 });
      prisma.disponibiliteSousTraitant.create.mockResolvedValue(mockDispo);
      const res = await service.createDisponibilite({
        sousTraitantId: 1,
        dateDebut: '2026-08-01',
        dateFin: '2026-08-15',
        disponible: true
      }, 3);
      expect(res).toEqual(mockDispo);
    });
  });

  // 6. NotationSousTraitant Tests
  describe('NotationSousTraitant CRUD', () => {
    const mockNotation = { id: 6, companyId: 3, sousTraitantId: 1, noteGlobale: 4.5 };

    it('should create a Notation', async () => {
      prisma.sousTraitant.findFirst.mockResolvedValue({ id: 1 });
      prisma.notationSousTraitant.create.mockResolvedValue(mockNotation);
      const res = await service.createNotation({
        sousTraitantId: 1,
        noteQualite: 4,
        noteDelai: 5,
        noteCommunication: 4,
        noteGlobale: 4.3
      }, 3);
      expect(res).toEqual(mockNotation);
    });
  });
});
