import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateServiceMoDto,
  UpdateServiceMoDto,
  ServiceMoQueryDto,
} from '../dto/service-mo.dto';
import { ServiceMainOeuvre } from '@prisma/client';

/**
 * SERVICE MAIN D'OEUVRE
 *
 * Gère les services de main d'oeuvre avec:
 * - Création/Modification/Suppression
 * - Calcul du coût journalier
 * - Productivité (m² par jour)
 * - Filtrages et tri
 */
@Injectable()
export class ServiceMoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau service de main d'oeuvre
   */
  async create(
    companyId: number,
    dto: CreateServiceMoDto,
  ): Promise<ServiceMainOeuvre> {
    if (!dto.nom || !dto.prixUnitaire) {
      throw new BadRequestException('Nom et prix unitaire requis');
    }

    if (dto.prixUnitaire < 0) {
      throw new BadRequestException('Le prix unitaire doit être positif');
    }

    // Vérifier l'unicité
    const exists = await this.prisma.serviceMainOeuvre.findFirst({
      where: {
        companyId,
        nom: dto.nom.trim(),
      },
    });

    if (exists) {
      throw new BadRequestException('Ce service MO existe déjà');
    }

    return this.prisma.serviceMainOeuvre.create({
      data: {
        companyId,
        nom: dto.nom.trim(),
        unite: dto.unite || 'M2',
        prixUnitaire: dto.prixUnitaire,
        productiviteJour: dto.productiviteJour, // m² par jour ou autre unité
        coutJournalier: dto.coutJournalier, // coût réel du jour
        actif: true,
      },
    });
  }

  /**
   * Lister tous les services MO avec filtres
   */
  async findAll(
    companyId: number,
    query: ServiceMoQueryDto,
  ): Promise<ServiceMainOeuvre[]> {
    return this.prisma.serviceMainOeuvre.findMany({
      where: {
        companyId,
        actif: query.actif !== undefined ? query.actif : true,
      },
      orderBy: query.orderBy ? { [query.orderBy]: 'asc' } : { nom: 'asc' },
      take: query.limit,
      skip: query.offset,
    });
  }

  /**
   * Récupérer un service spécifique
   */
  async findOne(id: number, companyId: number): Promise<ServiceMainOeuvre> {
    const service = await this.prisma.serviceMainOeuvre.findUnique({
      where: { id },
    });

    if (!service || service.companyId !== companyId) {
      throw new NotFoundException('Service MO non trouvé');
    }

    return service;
  }

  /**
   * Mettre à jour un service MO
   */
  async update(
    id: number,
    companyId: number,
    dto: UpdateServiceMoDto,
  ): Promise<ServiceMainOeuvre> {
    await this.findOne(id, companyId);

    if (dto.prixUnitaire && dto.prixUnitaire < 0) {
      throw new BadRequestException('Le prix unitaire doit être positif');
    }

    return this.prisma.serviceMainOeuvre.update({
      where: { id },
      data: {
        nom: dto.nom?.trim(),
        unite: dto.unite,
        prixUnitaire: dto.prixUnitaire,
        productiviteJour: dto.productiviteJour,
        coutJournalier: dto.coutJournalier,
        actif: dto.actif,
      },
    });
  }

  /**
   * Désactiver un service
   */
  async deactivate(id: number, companyId: number): Promise<ServiceMainOeuvre> {
    await this.findOne(id, companyId);

    return this.prisma.serviceMainOeuvre.update({
      where: { id },
      data: { actif: false },
    });
  }

  /**
   * Calculer le coût de main d'oeuvre pour une prestation
   * - Si productivité donnée: coût = (quantité / productivité) * coutJournalier
   * - Sinon: coût = quantité * prixUnitaire
   */
  async calculateMoPrice(
    id: number,
    quantite: number,
    companyId: number,
  ): Promise<{ prixUnitaire: number; total: number; methode: string }> {
    const service = await this.findOne(id, companyId);

    // Méthode 1: Par productivité journalière
    if (service.productiviteJour && service.coutJournalier) {
      const joursNecessaires = quantite / service.productiviteJour;
      const totalCost = joursNecessaires * service.coutJournalier;

      return {
        prixUnitaire: service.coutJournalier / service.productiviteJour,
        total: totalCost,
        methode: 'Par productivité',
      };
    }

    // Méthode 2: Prix unitaire simple
    return {
      prixUnitaire: service.prixUnitaire,
      total: service.prixUnitaire * quantite,
      methode: 'Prix unitaire',
    };
  }

  /**
   * Récupérer les services liés à une prestation
   */
  async getServicesByPrestation(
    prestationId: number,
    companyId: number,
  ): Promise<any[]> {
    return this.prisma.prestationComposition.findMany({
      where: {
        prestationId,
        serviceMainOeuvre: { companyId },
      },
      include: {
        serviceMainOeuvre: true,
      },
    });
  }
}
