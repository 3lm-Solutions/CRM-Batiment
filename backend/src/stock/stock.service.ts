import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TypeMouvementStock } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMouvementStockDto } from './dto/create-mouvement-stock.dto.js';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(search: string | undefined, currentUser: CurrentUserPayload) {
    const where: Prisma.MateriauWhereInput = {
      companyId: currentUser.companyId,
      actif: true,
      ...(search?.trim()
        ? { nom: { contains: search.trim(), mode: 'insensitive' } }
        : {}),
    };

    const items = await this.prisma.materiau.findMany({
      where,
      include: { fournisseur: { select: { id: true, nom: true } } },
      orderBy: { nom: 'asc' },
      take: 500,
    });

    const mapped = items.map((item) => ({
      ...item,
      statutStock:
        item.stockActuel <= 0
          ? 'RUPTURE'
          : item.stockActuel <= item.stockMinimum
            ? 'BAS'
            : 'DISPONIBLE',
      valeurStock:
        Math.round(item.stockActuel * item.prixAchatFixe * 100) / 100,
    }));

    return {
      items: mapped,
      summary: {
        totalReferences: mapped.length,
        stockBas: mapped.filter((item) => item.statutStock === 'BAS').length,
        ruptures: mapped.filter((item) => item.statutStock === 'RUPTURE')
          .length,
        valeurTotale:
          Math.round(
            mapped.reduce((sum, item) => sum + item.valeurStock, 0) * 100,
          ) / 100,
      },
    };
  }

  async listMovements(
    materiauId: number | undefined,
    limit: number,
    currentUser: CurrentUserPayload,
  ) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 200)
      : 50;
    return this.prisma.mouvementStock.findMany({
      where: {
        companyId: currentUser.companyId,
        ...(materiauId && Number.isInteger(materiauId) ? { materiauId } : {}),
      },
      include: {
        materiau: { select: { id: true, nom: true, unite: true } },
        user: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }

  async createMovement(
    dto: CreateMouvementStockDto,
    currentUser: CurrentUserPayload,
  ) {
    const materiau = await this.prisma.materiau.findFirst({
      where: {
        id: dto.materiauId,
        companyId: currentUser.companyId,
        actif: true,
      },
    });
    if (!materiau) throw new NotFoundException('Matériau introuvable.');

    const stockAvant = materiau.stockActuel;
    const stockApres =
      dto.type === TypeMouvementStock.ENTREE
        ? stockAvant + dto.quantite
        : dto.type === TypeMouvementStock.SORTIE
          ? stockAvant - dto.quantite
          : dto.quantite;

    if (stockApres < 0) {
      throw new BadRequestException(
        `Stock insuffisant : ${stockAvant} ${materiau.unite} disponible(s).`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.materiau.update({
        where: { id: materiau.id },
        data: { stockActuel: stockApres },
      });
      const movement = await tx.mouvementStock.create({
        data: {
          companyId: currentUser.companyId,
          materiauId: materiau.id,
          userId: currentUser.userId,
          type: dto.type,
          quantite: dto.quantite,
          stockAvant,
          stockApres,
          motif: dto.motif?.trim(),
          reference: dto.reference?.trim(),
        },
      });
      return { material: updated, movement };
    });

    await this.auditService.createLog({
      companyId: currentUser.companyId,
      userId: currentUser.userId,
      action: 'STOCK_MOVEMENT_CREATED',
      entite: 'Materiau',
      entiteId: materiau.id,
      ancienneValeur: {
        stockActuel: stockAvant,
        stockMinimum: materiau.stockMinimum,
      },
      nouvelleValeur: {
        stockActuel: stockApres,
        stockMinimum: materiau.stockMinimum,
        type: dto.type,
        quantite: dto.quantite,
        motif: dto.motif?.trim() ?? null,
        reference: dto.reference?.trim() ?? null,
      },
    });

    if (stockApres <= materiau.stockMinimum) {
      await this.notificationsService.createInternalNotification({
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        action: 'NOTIFICATION_STOCK_BAS',
        entite: 'Materiau',
        entiteId: materiau.id,
        category: 'STOCK_BAS',
        level: stockApres <= 0 ? 'danger' : 'warning',
        title: stockApres <= 0 ? 'Rupture de stock' : 'Stock bas',
        message: `${materiau.nom} : ${stockApres} ${materiau.unite} disponible(s), seuil ${materiau.stockMinimum}.`,
        metadata: {
          materiauId: materiau.id,
          stockActuel: stockApres,
          stockMinimum: materiau.stockMinimum,
        },
      });
    }

    this.notificationsService.emitCompanyEvent(
      currentUser.companyId,
      'stock:changed',
      {
        reason: 'STOCK_MOVEMENT_CREATED',
        entity: 'Materiau',
        entityId: materiau.id,
        actorId: currentUser.userId,
      },
    );

    return result;
  }

  async updateThreshold(
    id: number,
    stockMinimum: number,
    currentUser: CurrentUserPayload,
  ) {
    const material = await this.prisma.materiau.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!material) throw new NotFoundException('Matériau introuvable.');
    const updated = await this.prisma.materiau.update({
      where: { id },
      data: { stockMinimum },
    });

    await this.auditService.createLog({
      companyId: currentUser.companyId,
      userId: currentUser.userId,
      action: 'STOCK_THRESHOLD_UPDATED',
      entite: 'Materiau',
      entiteId: material.id,
      ancienneValeur: {
        stockActuel: material.stockActuel,
        stockMinimum: material.stockMinimum,
      },
      nouvelleValeur: {
        stockActuel: updated.stockActuel,
        stockMinimum: updated.stockMinimum,
      },
    });

    this.notificationsService.emitCompanyEvent(
      currentUser.companyId,
      'stock:changed',
      {
        reason: 'STOCK_THRESHOLD_UPDATED',
        entity: 'Materiau',
        entityId: material.id,
        actorId: currentUser.userId,
      },
    );

    return updated;
  }
}
