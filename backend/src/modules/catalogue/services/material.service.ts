import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMateriauxDto,
  UpdateMateriauxDto,
  MateriauxQueryDto,
} from '../dto/materiau.dto';
import { Materiau } from '@prisma/client';

/**
 * SERVICE MATERIAU
 *
 * Gère la bibliothèque de matériaux avec:
 * - Création/Modification/Suppression
 * - Filtrage par couleur, finition, fournisseur
 * - Gestion des coûts d'achat
 * - Historique des prix (MàJ)
 */
@Injectable()
export class MaterialService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau matériau avec ses détails
   */
  async create(
    companyId: number,
    dto: CreateMateriauxDto,
  ): Promise<Materiau> {
    // Validation
    if (!dto.nom || !dto.prixAchatFixe) {
      throw new BadRequestException('Nom et prix d\'achat requis');
    }

    if (dto.prixAchatFixe < 0) {
      throw new BadRequestException('Le prix d\'achat doit être positif');
    }

    // Vérifier l'unicité du matériau (nom + couleur + finition)
    const exists = await this.prisma.materiau.findFirst({
      where: {
        companyId,
        nom: dto.nom,
        couleur: dto.couleur || null,
        finition: dto.finition || null,
      },
    });

    if (exists) {
      throw new BadRequestException(
        'Ce matériau avec ces caractéristiques existe déjà',
      );
    }

    return this.prisma.materiau.create({
      data: {
        companyId,
        nom: dto.nom.trim(),
        couleur: dto.couleur?.trim(),
        finition: dto.finition?.trim(),
        unite: dto.unite || 'PIECE',
        prixAchatFixe: dto.prixAchatFixe,
        fournisseurId: dto.fournisseurId,
        actif: true,
      },
    });
  }

  /**
   * Lister tous les matériaux avec filtres optionnels
   */
  async findAll(
    companyId: number,
    query: MateriauxQueryDto,
  ): Promise<Materiau[]> {
    return this.prisma.materiau.findMany({
      where: {
        companyId,
        actif: query.actif !== undefined ? query.actif : true,
        couleur: query.couleur ? { contains: query.couleur } : undefined,
        finition: query.finition ? { contains: query.finition } : undefined,
        fournisseurId: query.fournisseurId,
      },
      orderBy: query.orderBy
        ? { [query.orderBy]: 'asc' }
        : { nom: 'asc' },
      take: query.limit,
      skip: query.offset,
    });
  }

  /**
   * Récupérer un matériau spécifique
   */
  async findOne(id: number, companyId: number): Promise<Materiau> {
    const materiau = await this.prisma.materiau.findUnique({
      where: { id },
    });

    if (!materiau || materiau.companyId !== companyId) {
      throw new NotFoundException('Matériau non trouvé');
    }

    return materiau;
  }

  /**
   * Mettre à jour le prix d'un matériau
   * (création d'un historique implicite via dateMaj)
   */
  async updatePrice(
    id: number,
    companyId: number,
    newPrice: number,
  ): Promise<Materiau> {
    const materiau = await this.findOne(id, companyId);

    if (newPrice < 0) {
      throw new BadRequestException('Le prix doit être positif');
    }

    return this.prisma.materiau.update({
      where: { id },
      data: {
        prixAchatFixe: newPrice,
        dateMaj: new Date(),
      },
    });
  }

  /**
   * Mettre à jour les détails d'un matériau
   */
  async update(
    id: number,
    companyId: number,
    dto: UpdateMateriauxDto,
  ): Promise<Materiau> {
    await this.findOne(id, companyId);

    return this.prisma.materiau.update({
      where: { id },
      data: {
        nom: dto.nom?.trim(),
        couleur: dto.couleur?.trim(),
        finition: dto.finition?.trim(),
        unite: dto.unite,
        fournisseurId: dto.fournisseurId,
        actif: dto.actif,
        dateMaj: new Date(),
      },
    });
  }

  /**
   * Désactiver un matériau (soft delete)
   */
  async deactivate(id: number, companyId: number): Promise<Materiau> {
    await this.findOne(id, companyId);

    return this.prisma.materiau.update({
      where: { id },
      data: { actif: false },
    });
  }

  /**
   * Récupérer le prix d'achat estimé pour une quantité
   */
  async getPrixAchatEstime(
    id: number,
    quantite: number,
    companyId: number,
  ): Promise<{ prixUnitaire: number; total: number }> {
    const materiau = await this.findOne(id, companyId);

    return {
      prixUnitaire: materiau.prixAchatFixe,
      total: materiau.prixAchatFixe * quantite,
    };
  }

  /**
   * Récupérer les matériaux liés à une prestation
   */
  async getMateriauxByPrestation(
    prestationId: number,
    companyId: number,
  ): Promise<any[]> {
    return this.prisma.prestationComposition.findMany({
      where: {
        prestationId,
        materiau: { companyId },
      },
      include: {
        materiau: true,
      },
    });
  }
}
