jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../mail/mail.service.js', () => ({
  MailService: class MailServiceMock {},
}));

describe('FacturesService - Validations', () => {
  let service: any;
  let prisma: any;

  const mockPrismaService = {
    devis: {
      findFirst: jest.fn(),
    },
    facture: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const { FacturesService } = require('./factures.service.js');
    prisma = mockPrismaService;
    service = new FacturesService(prisma, {});
    jest.clearAllMocks();
  });

  it('should throw BadRequestException when trying to bill a refused devis', async () => {
    const mockRefusedDevis = {
      id: 10,
      statut: 'REFUSE',
      tauxTVA: 20,
      reference: 'DEV-2026-0010',
      lignes: [],
    };
    prisma.devis.findFirst.mockResolvedValue(mockRefusedDevis);

    const { BadRequestException } = require('@nestjs/common');

    await expect(
      service.createFromDevis(10, { typeFacture: 'DOIT' }, 3),
    ).rejects.toThrow(new BadRequestException('Impossible de facturer un devis refusé.'));
  });
});
