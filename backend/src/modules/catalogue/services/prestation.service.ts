import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePrestationDto,
  UpdatePrestationDto,
  PrestationQueryDto,
  AddCompositionDto,
  AddOptionDto,
  AddChoixOptionDto,
} from '../dto/prestation.dto';
import { Prestation } from '@prisma/client';

/**
 * SERVICE PRESTATION
 *
 * Gère les prestations complètes avec:
 * - Création/Modification
 * - Compositions (matériaux + MO)
 * - Options et choix d'options
 * - Infos requises (mesures, photos, etc.)
 * - Détails de prix (min/max)
 */
@Injectable()
export class PrestationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer une nouvelle prestation
   */
  async create(
    companyId: number,
    dto: CreatePrestationDto,
  ): Promise<Prestation> {
    if (!dto.nom || !dto.categorieId) {
      throw new BadRequestException('Nom et catégorie requis');
    }

    if (dto.prixVenteMin < 0 || dto.prixVenteMax < 0) {
      throw new BadRequestException('Les prix doivent être positifs');
    }

    if (dto.prixVenteMin > dto.prixVenteMax) {
      throw new BadRequestException(
        'Le prix min doit être inférieur au prix max',
      );
    }

    return this.prisma.prestation.create({
      data: {
        companyId,
        categorieId: dto.categorieId,
        sousCategorieId: dto.sousCategorieId,
        nom: dto.nom.trim(),
        unite: dto.unite || 'M2',
        prixVenteMin: dto.prixVenteMin,
        prixVenteMax: dto.prixVenteMax,
        description: dto.description?.trim(),
        actif: true,
      },
    });
  }

  /**
   * Lister les prestations avec filtres
   */
  async findAll(
    companyId: number,
    query: PrestationQueryDto,
  ): Promise<Prestation[]> {
    return this.prisma.prestation.findMany({
      where: {
        companyId,
        actif: query.actif !== undefined ? query.actif : true,
        categorieId: query.categorieId,
        sousCategorieId: query.sousCategorieId,
      },
      orderBy: { nom: 'asc' },
      take: query.limit,
      skip: query.offset,
    });
  }

  /**
   * Récupérer une prestation avec tous ses détails
   */
  async findOneComplete(id: number, companyId: number): Promise<any> {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id },
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
    });

    if (!prestation || prestation.companyId !== companyId) {
      throw new NotFoundException('Prestation non trouvée');
    }

    return prestation;
  }

  /**
   * Mettre à jour une prestation
   */
  async update(
    id: number,
    companyId: number,
    dto: UpdatePrestationDto,
  ): Promise<Prestation> {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id },
    });

    if (!prestation || prestation.companyId !== companyId) {
      throw new NotFoundException('Prestation non trouvée');
    }

    if (dto.prixVenteMin && dto.prixVenteMax) {
      if (dto.prixVenteMin > dto.prixVenteMax) {
        throw new BadRequestException('Prix min > prix max');
      }
    }

    return this.prisma.prestation.update({
      where: { id },
      data: {
        nom: dto.nom?.trim(),
        unite: dto.unite,
        prixVenteMin: dto.prixVenteMin,
        prixVenteMax: dto.prixVenteMax,
        description: dto.description?.trim(),
        actif: dto.actif,
      },
    });
  }

  /**
   * Ajouter un matériau ou service à une prestation (composition)
   */
  async addComposition(
    prestationId: number,
    companyId: number,
    dto: AddCompositionDto,
  ): Promise<any> {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id: prestationId },
    });

    if (!prestation || prestation.companyId !== companyId) {
      throw new NotFoundException('Prestation non trouvée');
    }

    if (!dto.materiauId && !dto.serviceMainOeuvreId) {
      throw new BadRequestException(
        'Au moins un matériau ou service requis',
      );
    }

    // Vérifier l'unicité
    const exists = await this.prisma.prestationComposition.findFirst({
      where: {
        prestationId,
        materiauId: dto.materiauId,
        serviceMainOeuvreId: dto.serviceMainOeuvreId,
      },
    });

    if (exists) {
      throw new BadRequestException(
        'Cette composition existe déjà pour cette prestation',
      );
    }

    return this.prisma.prestationComposition.create({
      data: {
        prestationId,
        materiauId: dto.materiauId,
        serviceMainOeuvreId: dto.serviceMainOeuvreId,
        quantiteParUnite: dto.quantiteParUnite || 1,
      },
      include: {
        materiau: true,
        serviceMainOeuvre: true,
      },
    });
  }

  /**
   * Ajouter une option à une prestation
   */
  async addOption(
    prestationId: number,
    companyId: number,
    dto: AddOptionDto,
  ): Promise<any> {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id: prestationId },
    });

    if (!prestation || prestation.companyId !== companyId) {
      throw new NotFoundException('Prestation non trouvée');
    }

    const exists = await this.prisma.optionPrestation.findFirst({
      where: {
        prestationId,
        nom: dto.nom.trim(),
      },
    });

    if (exists) {
      throw new BadRequestException('Cette option existe déjà');
    }

    return this.prisma.optionPrestation.create({
      data: {
        prestationId,
        nom: dto.nom.trim(),
        description: dto.description?.trim(),
        obligatoire: dto.obligatoire || false,
        ordre: dto.ordre || 0,
      },
    });
  }

  /**
   * Ajouter un choix à une option
   */
  async addChoixOption(
    optionId: number,
    companyId: number,
    dto: AddChoixOptionDto,
  ): Promise<any> {
    const option = await this.prisma.optionPrestation.findUnique({
      where: { id: optionId },
      include: { prestation: true },
    });

    if (!option || option.prestation.companyId !== companyId) {
      throw new NotFoundException('Option non trouvée');
    }

    const exists = await this.prisma.choixOption.findFirst({
      where: {
        optionId,
        nom: dto.nom.trim(),
      },
    });

    if (exists) {
      throw new BadRequestException('Ce choix existe déjà');
    }

    return this.prisma.choixOption.create({
      data: {
        optionId,
        nom: dto.nom.trim(),
        description: dto.description?.trim(),
        impactPrix: dto.impactPrix || 0,
        ordre: dto.ordre || 0,
        actif: true,
      },
    });
  }

  /**
   * Désactiver une prestation
   */
  async deactivate(id: number, companyId: number): Promise<Prestation> {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id },
    });

    if (!prestation || prestation.companyId !== companyId) {
      throw new NotFoundException('Prestation non trouvée');
    }

    return this.prisma.prestation.update({
      where: { id },
      data: { actif: false },
    });
  }
}
