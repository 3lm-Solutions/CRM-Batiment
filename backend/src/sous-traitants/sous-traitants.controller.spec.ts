jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../../generated/prisma/client.js', () => ({
  Role: {
    ADMIN: 'ADMIN',
    TECHNICO: 'TECHNICO',
    ASSISTANTE: 'ASSISTANTE',
    CHEF_CHANTIER: 'CHEF_CHANTIER',
    SOUS_TRAITANT: 'SOUS_TRAITANT',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SousTraitantsController } from './sous-traitants.controller.js';
import { SousTraitantsService } from './sous-traitants.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../../generated/prisma/client.js';

describe('SousTraitantsController', () => {
  let controller: SousTraitantsController;
  let service: any;

  const mockSousTraitantsService = {
    createSousTraitant: jest.fn(),
    findAllSousTraitants: jest.fn(),
    findOneSousTraitant: jest.fn(),
    updateSousTraitant: jest.fn(),
    deleteSousTraitant: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SousTraitantsController],
      providers: [
        {
          provide: SousTraitantsService,
          useValue: mockSousTraitantsService,
        },
        PrismaService,
      ],
    }).compile();

    controller = module.get<SousTraitantsController>(SousTraitantsController);
    service = module.get<SousTraitantsService>(SousTraitantsService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate createSousTraitant to service', async () => {
    const dto = { nom: 'Test ST' };
    const userPayload = { userId: 99, companyId: 3, role: Role.ADMIN, email: 'admin@test.com' };

    service.createSousTraitant.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.createSousTraitant(dto, userPayload);

    expect(service.createSousTraitant).toHaveBeenCalledWith(dto, 3);
    expect(result.id).toBe(1);
  });
});
