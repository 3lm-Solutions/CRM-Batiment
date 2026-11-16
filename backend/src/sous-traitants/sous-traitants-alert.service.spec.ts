jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../notifications/notifications.service.js', () => ({
  NotificationsService: class NotificationsServiceMock {
    createInternalNotification = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SousTraitantsAlertService } from './sous-traitants-alert.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('SousTraitantsAlertService', () => {
  let service: SousTraitantsAlertService;
  let prisma: any;
  let notifications: any;

  const mockPrismaService = {
    assuranceSousTraitant: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SousTraitantsAlertService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        NotificationsService,
      ],
    }).compile();

    service = module.get<SousTraitantsAlertService>(SousTraitantsAlertService);
    prisma = module.get<PrismaService>(PrismaService);
    notifications = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect expired assurances, trigger alerts, and update status', async () => {
    const now = new Date();
    const expiredDate = new Date();
    expiredDate.setDate(now.getDate() - 5); // 5 days ago

    const mockAssurances = [
      {
        id: 1,
        companyId: 3,
        typeAssurance: 'RC PRO',
        numeroAttestation: '12345',
        dateExpiration: expiredDate.toISOString(),
        statut: 'VALIDE',
        sousTraitant: { nom: 'ST Expired' },
      },
    ];

    prisma.assuranceSousTraitant.findMany.mockResolvedValue(mockAssurances);
    prisma.assuranceSousTraitant.update.mockResolvedValue({});
    notifications.createInternalNotification.mockResolvedValue({});

    const res = await service.checkExpiringAssurances(30);

    expect(res.expiredCount).toBe(1);
    expect(res.warningCount).toBe(0);

    expect(prisma.assuranceSousTraitant.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { statut: 'EXPIREE' },
    });

    expect(notifications.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ASSURANCE_EXPIRATION',
        level: 'warning',
        title: expect.stringContaining('Assurance expirée'),
      }),
    );
  });

  it('should detect assurances expiring soon, trigger alerts, and update status', async () => {
    const now = new Date();
    const expiringDate = new Date();
    expiringDate.setDate(now.getDate() + 15); // in 15 days

    const mockAssurances = [
      {
        id: 2,
        companyId: 3,
        typeAssurance: 'DECENNALE',
        numeroAttestation: '67890',
        dateExpiration: expiringDate.toISOString(),
        statut: 'VALIDE',
        sousTraitant: { nom: 'ST Expiring Soon' },
      },
    ];

    prisma.assuranceSousTraitant.findMany.mockResolvedValue(mockAssurances);
    prisma.assuranceSousTraitant.update.mockResolvedValue({});
    notifications.createInternalNotification.mockResolvedValue({});

    const res = await service.checkExpiringAssurances(30);

    expect(res.expiredCount).toBe(0);
    expect(res.warningCount).toBe(1);

    expect(prisma.assuranceSousTraitant.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { statut: 'A_RENOUVELER' },
    });

    expect(notifications.createInternalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ASSURANCE_EXPIRATION',
        level: 'warning',
        title: expect.stringContaining('Assurance à renouveler'),
      }),
    );
  });

  it('should ignore assurances that are safe and far from expiration', async () => {
    const now = new Date();
    const safeDate = new Date();
    safeDate.setDate(now.getDate() + 45); // in 45 days

    const mockAssurances = [
      {
        id: 3,
        companyId: 3,
        typeAssurance: 'DECENNALE',
        numeroAttestation: '99999',
        dateExpiration: safeDate.toISOString(),
        statut: 'VALIDE',
        sousTraitant: { nom: 'ST Safe' },
      },
    ];

    prisma.assuranceSousTraitant.findMany.mockResolvedValue(mockAssurances);

    const res = await service.checkExpiringAssurances(30);

    expect(res.expiredCount).toBe(0);
    expect(res.warningCount).toBe(0);

    expect(prisma.assuranceSousTraitant.update).not.toHaveBeenCalled();
    expect(notifications.createInternalNotification).not.toHaveBeenCalled();
  });
});
