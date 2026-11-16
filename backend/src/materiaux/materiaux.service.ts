import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMateriauDto } from './dto/create-materiau.dto.js';
import { UpdateMateriauDto } from './dto/update-materiau.dto.js';
import { QueryMateriauDto } from './dto/query-materiau.dto.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class MateriauxService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Créer un matériau (ADMIN uniquement)
   */
  async create(dto: CreateMateriauDto, currentUser: CurrentUserPayload) {
    // Si fournisseurId fourni, vérifier qu'il appartient à la même company
    if (dto.fournisseurId) {
      const fournisseur = await this.prisma.fournisseur.findUnique({
        where: { id: dto.fournisseurId },
      });

      if (!fournisseur) {
        throw new NotFoundException(
          `Fournisseur #${dto.fournisseurId} non trouvé`,
        );
      }

      if (fournisseur.companyId !== currentUser.companyId) {
        throw new ForbiddenException('Accès non autorisé à ce fournisseur');
      }
    }

    return this.prisma.materiau.create({
      data: {
        ...dto,
        companyId: currentUser.companyId,
      },
      include: {
        fournisseur: {
          select: { id: true, nom: true },
        },
      },
    });
  }

  /**
   * Liste paginée des matériaux avec filtres
   */
  async findAll(query: QueryMateriauDto, currentUser: CurrentUserPayload) {
    const { page = 1, limit = 20, search, fournisseurId, actif } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: currentUser.companyId,
    };

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { couleur: { contains: search, mode: 'insensitive' } },
        { finition: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (fournisseurId) {
      where.fournisseurId = fournisseurId;
    }

    if (actif !== undefined) {
      where.actif = actif;
    }

    const [data, total] = await Promise.all([
      this.prisma.materiau.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
        include: {
          fournisseur: {
            select: { id: true, nom: true },
          },
        },
      }),
      this.prisma.materiau.count({ where }),
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
   * Détail d'un matériau
   */
  async findOne(id: number, currentUser: CurrentUserPayload) {
    const materiau = await this.prisma.materiau.findUnique({
      where: { id },
      include: {
        fournisseur: true,
      },
    });

    if (!materiau) {
      throw new NotFoundException(`Matériau #${id} non trouvé`);
    }

    if (materiau.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à ce matériau');
    }

    return materiau;
  }

  /**
   * Modifier un matériau
   */
  async update(
    id: number,
    dto: UpdateMateriauDto,
    currentUser: CurrentUserPayload,
  ) {
    const previous = await this.findOne(id, currentUser);

    // Si on change le fournisseur, vérifier l'appartenance
    if (dto.fournisseurId) {
      const fournisseur = await this.prisma.fournisseur.findUnique({
        where: { id: dto.fournisseurId },
      });

      if (!fournisseur) {
        throw new NotFoundException(
          `Fournisseur #${dto.fournisseurId} non trouvé`,
        );
      }

      if (fournisseur.companyId !== currentUser.companyId) {
        throw new ForbiddenException('Accès non autorisé à ce fournisseur');
      }
    }

    const updated = await this.prisma.materiau.update({
      where: { id },
      data: {
        ...dto,
        dateMaj: new Date(),
      },
      include: {
        fournisseur: {
          select: { id: true, nom: true },
        },
      },
    });

    if (dto.prixAchatFixe !== undefined && previous.prixAchatFixe !== updated.prixAchatFixe) {
      await this.auditService.logPriceChange({
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        entite: 'Materiau',
        entiteId: updated.id,
        field: 'prixAchatFixe',
        label: updated.nom,
        oldValue: previous.prixAchatFixe,
        newValue: updated.prixAchatFixe,
        metadata: { unite: updated.unite },
      });
    }

    return updated;
  }

  /**
   * Supprimer un matériau (soft delete)
   */
  async delete(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    const usedInSignedDevis = await this.prisma.ligneDevis.findFirst({
      where: {
        materiauId: id,
        devis: {
          statut: 'SIGNE',
        },
      },
    });

    if (usedInSignedDevis) {
      throw new BadRequestException(
        'Impossible de supprimer un matériau utilisé dans un devis signé',
      );
    }

    return this.prisma.materiau.update({
      where: { id },
      data: { actif: false },
    });
  }
}
