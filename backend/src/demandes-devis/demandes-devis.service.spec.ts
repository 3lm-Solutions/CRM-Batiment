jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../../generated/prisma/client.js', () => ({
  DemandeStatut: {
    NOUVEAU: 'NOUVEAU',
    EN_COURS: 'EN_COURS',
    CONVERTI: 'CONVERTI',
    PERDU: 'PERDU',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { DemandesDevisService } from './demandes-devis.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DemandesDevisService - convertirEnDevis', () => {
  let service: DemandesDevisService;
  let prisma: any;

  const mockPrismaService = {
    demandeDevis: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    devis: {
      count: jest.fn(),
      create: jest.fn(),
    },
    ligneDevis: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemandesDevisService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DemandesDevisService>(DemandesDevisService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convertirEnDevis', () => {
    const mockDemande = {
      id: 1,
      clientId: 2,
      companyId: 3,
      statut: 'NOUVEAU',
      description: 'Test Demande Description',
      devis: [],
    };

    const mockDevis = {
      id: 10,
      companyId: 3,
      clientId: 2,
      demandeDevisId: 1,
      createurId: 99,
      reference: 'DEV-2026-0001',
      statut: 'BROUILLON',
      notes: 'Généré depuis la demande #1 — Test Demande Description',
    };

    it('should successfully convert a valid demand into a draft devis and create a line', async () => {
      prisma.demandeDevis.findFirst.mockResolvedValue(mockDemande);
      prisma.devis.count.mockResolvedValue(0);
      prisma.devis.create.mockResolvedValue(mockDevis);
      prisma.ligneDevis.create.mockResolvedValue({ id: 100 });
      prisma.demandeDevis.update.mockResolvedValue({ ...mockDemande, statut: 'CONVERTI' });

      const result = await service.convertirEnDevis(1, 99, 3);

      expect(prisma.demandeDevis.findFirst).toHaveBeenCalledWith({
        where: { id: 1, companyId: 3 },
        include: {
          client: true,
          createur: { select: { id: true, nom: true, prenom: true, email: true } },
          devis: true,
        },
      });
      expect(prisma.devis.count).toHaveBeenCalledWith({ where: { companyId: 3 } });
      expect(prisma.devis.create).toHaveBeenCalledWith({
        data: {
          companyId: 3,
          clientId: 2,
          demandeDevisId: 1,
          createurId: 99,
          reference: 'DEV-2026-0001',
          statut: 'BROUILLON',
          notes: 'Généré depuis la demande #1 — Test Demande Description',
        },
        include: { client: true, demandeDevis: true },
      });
      expect(prisma.ligneDevis.create).toHaveBeenCalledWith({
        data: {
          devisId: 10,
          description: 'Test Demande Description',
          quantite: 1,
          unite: 'FORFAIT',
          prixUnitaireVente: 0,
          prixAchat: 0,
          mainOeuvre: 0,
          totalHT: 0,
          coutTotal: 0,
          ordre: 1,
        },
      });
      expect(prisma.demandeDevis.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { statut: 'CONVERTI' },
      });

      expect(result).toEqual({
        message: 'Demande convertie en devis avec succès',
        devisId: 10,
        reference: 'DEV-2026-0001',
        devis: mockDevis,
      });
    });

    it('should throw NotFoundException if the demand does not exist', async () => {
      prisma.demandeDevis.findFirst.mockResolvedValue(null);

      await expect(service.convertirEnDevis(999, 99, 3)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if the demand is already CONVERTI', async () => {
      prisma.demandeDevis.findFirst.mockResolvedValue({
        ...mockDemande,
        statut: 'CONVERTI',
      });

      await expect(service.convertirEnDevis(1, 99, 3)).rejects.toThrow(
        new BadRequestException('Cette demande a déjà été convertie en devis'),
      );
    });

    it('should throw BadRequestException if the demand is already PERDU', async () => {
      prisma.demandeDevis.findFirst.mockResolvedValue({
        ...mockDemande,
        statut: 'PERDU',
      });

      await expect(service.convertirEnDevis(1, 99, 3)).rejects.toThrow(
        new BadRequestException('Impossible de convertir une demande perdue'),
      );
    });

    it('should throw BadRequestException if a devis is already associated with the demand', async () => {
      prisma.demandeDevis.findFirst.mockResolvedValue({
        ...mockDemande,
        devis: [{ id: 45 }],
      });

      await expect(service.convertirEnDevis(1, 99, 3)).rejects.toThrow(
        new BadRequestException('Un devis existe déjà pour cette demande (ID: 45)'),
      );
    });
  });
});
