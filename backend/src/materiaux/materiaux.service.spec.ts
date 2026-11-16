jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

describe('MateriauxService - Validations', () => {
  let service: any;
  let prisma: any;

  const mockPrismaService = {
    materiau: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ligneDevis: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const { MateriauxService } = require('./materiaux.service.js');
    prisma = mockPrismaService;
    service = new MateriauxService(prisma);
    jest.clearAllMocks();
  });

  it('should throw BadRequestException when trying to delete a material used in a signed devis', async () => {
    const mockMateriau = {
      id: 201,
      nom: 'Briques rouges',
      companyId: 3,
      actif: true,
    };
    prisma.materiau.findUnique.mockResolvedValue(mockMateriau);
    
    // Mock that the material is used in a signed devis
    prisma.ligneDevis.findFirst.mockResolvedValue({
      id: 1001,
      devisId: 10,
      materiauId: 201,
    });

    const { BadRequestException } = require('@nestjs/common');

    await expect(
      service.delete(201, { companyId: 3 }),
    ).rejects.toThrow(new BadRequestException('Impossible de supprimer un matériau utilisé dans un devis signé'));
  });

  it('should soft delete successfully if the material is not used in any signed devis', async () => {
    const mockMateriau = {
      id: 201,
      nom: 'Briques rouges',
      companyId: 3,
      actif: true,
    };
    prisma.materiau.findUnique.mockResolvedValue(mockMateriau);
    
    // Mock that the material is not used in a signed devis
    prisma.ligneDevis.findFirst.mockResolvedValue(null);
    prisma.materiau.update.mockResolvedValue({ ...mockMateriau, actif: false });

    const result = await service.delete(201, { companyId: 3 });

    expect(prisma.materiau.update).toHaveBeenCalledWith({
      where: { id: 201 },
      data: { actif: false },
    });
    expect(result.actif).toBe(false);
  });
});
