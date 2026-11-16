import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCategorieDto,
  UpdateCategorieDto,
  CreateSousCategorieDto,
} from '../dto/catalogue.dto';

/**
 * SERVICE CATALOGUE GÉNÉRAL
 *
 * Orchestre les catégories, sous-catégories et
 * fournit une vue complète du catalogue
 */
@Injectable()
export class CatalogueService {
  constructor(private prisma: PrismaService) {}

  // ==================== CATÉGORIES ====================

  /**
   * Créer une catégorie de prestation
   */
  async createCategorie(
    companyId: number,
    dto: CreateCategorieDto,
  ): Promise<any> {
    if (!dto.nom) {
      throw new BadRequestException('Nom requis');
    }

    const exists = await this.prisma.categoriePrestation.findFirst({
      where: {
        companyId,
        nom: dto.nom.trim(),
      },
    });

    if (exists) {
      throw new BadRequestException('Cette catégorie existe déjà');
    }

    return this.prisma.categoriePrestation.create({
      data: {
        companyId,
        nom: dto.nom.trim(),
        description: dto.description?.trim(),
        actif: true,
      },
    });
  }

  /**
   * Lister les catégories
   */
  async findAllCategories(companyId: number): Promise<any[]> {
    return this.prisma.categoriePrestation.findMany({
      where: {
        companyId,
        actif: true,
      },
      include: {
        prestations: { where: { actif: true } },
        sousCategories: { where: { actif: true } },
      },
      orderBy: { nom: 'asc' },
    });
  }

  /**
   * Récupérer une catégorie avec tous ses détails
   */
  async getCategorieComplete(id: number, companyId: number): Promise<any> {
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id },
      include: {
        prestations: {
          where: { actif: true },
          include: {
            compositions: {
              include: {
                materiau: true,
                serviceMainOeuvre: true,
              },
            },
            options: {
              include: {
                choix: true,
              },
            },
          },
        },
        sousCategories: {
          where: { actif: true },
          include: {
            prestations: {
              include: {
                compositions: true,
                options: true,
              },
            },
          },
        },
      },
    });

    if (!categorie || categorie.companyId !== companyId) {
      throw new NotFoundException('Catégorie non trouvée');
    }

    return categorie;
  }

  /**
   * Mettre à jour une catégorie
   */
  async updateCategorie(
    id: number,
    companyId: number,
    dto: UpdateCategorieDto,
  ): Promise<any> {
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id },
    });

    if (!categorie || categorie.companyId !== companyId) {
      throw new NotFoundException('Catégorie non trouvée');
    }

    return this.prisma.categoriePrestation.update({
      where: { id },
      data: {
        nom: dto.nom?.trim(),
        description: dto.description?.trim(),
        actif: dto.actif,
      },
    });
  }

  // ==================== SOUS-CATÉGORIES ====================

  /**
   * Créer une sous-catégorie
   */
  async createSousCategorie(
    companyId: number,
    dto: CreateSousCategorieDto,
  ): Promise<any> {
    if (!dto.nom || !dto.categorieId) {
      throw new BadRequestException('Nom et catégorie requis');
    }

    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id: dto.categorieId },
    });

    if (!categorie || categorie.companyId !== companyId) {
      throw new NotFoundException('Catégorie non trouvée');
    }

    const exists = await this.prisma.sousCategorie.findFirst({
      where: {
        categorieId: dto.categorieId,
        nom: dto.nom.trim(),
      },
    });

    if (exists) {
      throw new BadRequestException('Cette sous-catégorie existe déjà');
    }

    return this.prisma.sousCategorie.create({
      data: {
        companyId,
        categorieId: dto.categorieId,
        nom: dto.nom.trim(),
        description: dto.description?.trim(),
        actif: true,
      },
    });
  }

  // ==================== VUE D'ENSEMBLE ====================

  /**
   * Obtenir le catalogue complet avec toutes les prestations,
   * matériaux, services et options
   */
  async getCatalogueComplet(companyId: number): Promise<any> {
    const [categories, materiaux, services] = await Promise.all([
      this.prisma.categoriePrestation.findMany({
        where: { companyId, actif: true },
        include: {
          prestations: {
            where: { actif: true },
            include: {
              compositions: {
                include: {
                  materiau: true,
                  serviceMainOeuvre: true,
                },
              },
              options: {
                include: {
                  choix: {
                    include: {
                      compositions: {
                        include: {
                          materiau: true,
                          serviceMainOeuvre: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          sousCategories: {
            where: { actif: true },
          },
        },
        orderBy: { nom: 'asc' },
      }),
      this.prisma.materiau.findMany({
        where: { companyId, actif: true },
        orderBy: { nom: 'asc' },
      }),
      this.prisma.serviceMainOeuvre.findMany({
        where: { companyId, actif: true },
        orderBy: { nom: 'asc' },
      }),
    ]);

    return {
      categories,
      materiauxCount: materiaux.length,
      servicesCount: services.length,
      totalPrestations: categories.reduce(
        (sum, cat) => sum + cat.prestations.length,
        0,
      ),
    };
  }

  /**
   * Faire une recherche complète dans le catalogue
   */
  async searchCatalogue(companyId: number, query: string): Promise<any> {
    const sanitizedQuery = query.trim().toLowerCase();

    const [prestations, materiaux, services] = await Promise.all([
      this.prisma.prestation.findMany({
        where: {
          companyId,
          actif: true,
          OR: [{ nom: { contains: sanitizedQuery, mode: 'insensitive' } }],
        },
        include: {
          compositions: {
            include: {
              materiau: true,
              serviceMainOeuvre: true,
            },
          },
        },
        take: 10,
      }),
      this.prisma.materiau.findMany({
        where: {
          companyId,
          actif: true,
          OR: [{ nom: { contains: sanitizedQuery, mode: 'insensitive' } }],
        },
        take: 10,
      }),
      this.prisma.serviceMainOeuvre.findMany({
        where: {
          companyId,
          actif: true,
          OR: [{ nom: { contains: sanitizedQuery, mode: 'insensitive' } }],
        },
        take: 10,
      }),
    ]);

    return {
      prestations,
      materiaux,
      services,
    };
  }
}
