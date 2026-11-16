import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServiceMoDto } from './dto/create-service-mo.dto.js';
import { UpdateServiceMoDto } from './dto/update-service-mo.dto.js';
import { QueryServiceMoDto } from './dto/query-service-mo.dto.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ServicesMoService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Créer un service de main d'œuvre (ADMIN uniquement)
   */
  async create(dto: CreateServiceMoDto, currentUser: CurrentUserPayload) {
    return this.prisma.serviceMainOeuvre.create({
      data: {
        ...dto,
        companyId: currentUser.companyId,
      },
    });
  }

  /**
   * Liste paginée des services MO avec filtres
   */
  async findAll(query: QueryServiceMoDto, currentUser: CurrentUserPayload) {
    const { page = 1, limit = 20, search, actif } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: currentUser.companyId,
    };

    if (search) {
      where.nom = { contains: search, mode: 'insensitive' };
    }

    if (actif !== undefined) {
      where.actif = actif;
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceMainOeuvre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
      }),
      this.prisma.serviceMainOeuvre.count({ where }),
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
   * Détail d'un service MO
   */
  async findOne(id: number, currentUser: CurrentUserPayload) {
    const service = await this.prisma.serviceMainOeuvre.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service MO #${id} non trouvé`);
    }

    if (service.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à ce service');
    }

    return service;
  }

  /**
   * Modifier un service MO
   */
  async update(
    id: number,
    dto: UpdateServiceMoDto,
    currentUser: CurrentUserPayload,
  ) {
    const previous = await this.findOne(id, currentUser);

    const updated = await this.prisma.serviceMainOeuvre.update({
      where: { id },
      data: dto,
    });

    if (dto.prixUnitaire !== undefined && previous.prixUnitaire !== updated.prixUnitaire) {
      await this.auditService.logPriceChange({
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        entite: 'ServiceMainOeuvre',
        entiteId: updated.id,
        field: 'prixUnitaire',
        label: updated.nom,
        oldValue: previous.prixUnitaire,
        newValue: updated.prixUnitaire,
        metadata: { unite: updated.unite },
      });
    }

    if (dto.coutJournalier !== undefined && previous.coutJournalier !== updated.coutJournalier) {
      await this.auditService.logPriceChange({
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        entite: 'ServiceMainOeuvre',
        entiteId: updated.id,
        field: 'coutJournalier',
        label: updated.nom,
        oldValue: previous.coutJournalier,
        newValue: updated.coutJournalier,
        metadata: { unite: updated.unite },
      });
    }

    return updated;
  }

  /**
   * Supprimer un service MO (soft delete)
   */
  async delete(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    return this.prisma.serviceMainOeuvre.update({
      where: { id },
      data: { actif: false },
    });
  }
}
