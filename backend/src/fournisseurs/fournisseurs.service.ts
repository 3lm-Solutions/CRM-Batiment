import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto.js';
import { UpdateFournisseurDto } from './dto/update-fournisseur.dto.js';
import { QueryFournisseurDto } from './dto/query-fournisseur.dto.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class FournisseursService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un fournisseur
   */
  async create(dto: CreateFournisseurDto, currentUser: CurrentUserPayload) {
    return this.prisma.fournisseur.create({
      data: {
        ...dto,
        companyId: currentUser.companyId,
      },
    });
  }

  /**
   * Liste paginée des fournisseurs avec filtres
   */
  async findAll(query: QueryFournisseurDto, currentUser: CurrentUserPayload) {
    const { page = 1, limit = 20, search, actif } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: currentUser.companyId,
    };

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { typesMateriaux: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (actif !== undefined) {
      where.actif = actif;
    }

    const [data, total] = await Promise.all([
      this.prisma.fournisseur.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        include: {
          _count: {
            select: { materiaux: true, commandesFournisseur: true },
          },
        },
      }),
      this.prisma.fournisseur.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Détail d'un fournisseur avec ses matériaux
   */
  async findOne(id: number, currentUser: CurrentUserPayload) {
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id },
      include: {
        materiaux: {
          where: { actif: true },
          orderBy: { nom: 'asc' },
          select: {
            id: true,
            nom: true,
            unite: true,
            prixAchatFixe: true,
            couleur: true,
          },
        },
        _count: {
          select: { commandesFournisseur: true },
        },
      },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${id} non trouvé`);
    }

    if (fournisseur.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à ce fournisseur');
    }

    return fournisseur;
  }

  /**
   * Modifier un fournisseur
   */
  async update(
    id: number,
    dto: UpdateFournisseurDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.findOne(id, currentUser);

    return this.prisma.fournisseur.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Supprimer un fournisseur (soft delete)
   */
  async delete(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    return this.prisma.fournisseur.update({
      where: { id },
      data: { actif: false },
    });
  }
}
