import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface AuditQuery {
  page: number;
  limit: number;
  entite?: string;
  action?: string;
  search?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
}

const signatureActions = [
  'SIGNATURE_DEVIS',
  'DEVIS_SIGNE',
  'DEVIS_ACCEPTE',
  'DEVIS_REFUSE',
  'SIGNATURE',
];

const priceActions = [
  'MODIFICATION_PRIX',
  'PRICE_UPDATED',
  'UPDATE_PRIX',
  'UPDATE_TARIF',
];

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value?: string) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }

  private buildDateFilter(query: AuditQuery) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.startDate) {
      createdAt.gte = new Date(query.startDate);
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }

    return Object.keys(createdAt).length > 0 ? createdAt : undefined;
  }

  private buildWhere(companyId: number, query: AuditQuery): Prisma.AuditLogWhereInput {
    const entite = this.normalizeText(query.entite);
    const action = this.normalizeText(query.action);
    const search = this.normalizeText(query.search);
    const createdAt = this.buildDateFilter(query);

    return {
      companyId,
      ...(entite ? { entite: { contains: entite, mode: 'insensitive' } } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entite: { contains: search, mode: 'insensitive' } },
              { user: { nom: { contains: search, mode: 'insensitive' } } },
              { user: { prenom: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private actionContains(actions: string[]): Prisma.AuditLogWhereInput {
    return {
      OR: actions.map((item) => ({
        action: {
          contains: item,
          mode: 'insensitive' as const,
        },
      })),
    };
  }

  async findAll(companyId: number, query: AuditQuery) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(companyId, query);

    const [items, total, priceChanges, signatures, deletes, activeUsers, lastAction] =
      await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.count({
          where: {
            ...where,
            ...this.actionContains(priceActions),
          },
        }),
        this.prisma.auditLog.count({
          where: {
            ...where,
            ...this.actionContains(signatureActions),
          },
        }),
        this.prisma.auditLog.count({
          where: {
            ...where,
            action: { contains: 'DELETE', mode: 'insensitive' },
          },
        }),
        this.prisma.auditLog.groupBy({
          by: ['userId'],
          where: {
            ...where,
            userId: { not: null },
          },
          _count: { _all: true },
        }),
        this.prisma.auditLog.findFirst({
          where,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

    return {
      data: items,
      summary: {
        total,
        priceChanges,
        signatures,
        deletes,
        activeUsers: activeUsers.length,
        lastActionAt: lastAction?.createdAt ?? null,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async createLog(payload: {
    companyId: number;
    userId?: number | null;
    action: string;
    entite: string;
    entiteId: number;
    ancienneValeur?: Prisma.InputJsonValue | null;
    nouvelleValeur?: Prisma.InputJsonValue | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId ?? undefined,
        action: payload.action,
        entite: payload.entite,
        entiteId: payload.entiteId,
        ancienneValeur: payload.ancienneValeur ?? undefined,
        nouvelleValeur: payload.nouvelleValeur ?? undefined,
      },
    });
  }

  async logSignature(payload: {
    companyId: number;
    userId?: number | null;
    devisId: number;
    reference?: string | null;
    ancienneValeur?: Prisma.InputJsonObject | null;
    nouvelleValeur: Prisma.InputJsonObject;
  }) {
    return this.createLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'SIGNATURE_DEVIS',
      entite: 'Devis',
      entiteId: payload.devisId,
      ancienneValeur: payload.ancienneValeur ?? undefined,
      nouvelleValeur: {
        ...payload.nouvelleValeur,
        reference: payload.reference ?? undefined,
      },
    });
  }

  async logPriceChange(payload: {
    companyId: number;
    userId?: number | null;
    entite: string;
    entiteId: number;
    field: string;
    label?: string | null;
    oldValue: number | null;
    newValue: number | null;
    metadata?: Prisma.InputJsonObject;
  }) {
    if (payload.oldValue === payload.newValue) {
      return null;
    }

    return this.createLog({
      companyId: payload.companyId,
      userId: payload.userId,
      action: 'MODIFICATION_PRIX',
      entite: payload.entite,
      entiteId: payload.entiteId,
      ancienneValeur: {
        field: payload.field,
        label: payload.label ?? undefined,
        value: payload.oldValue,
      },
      nouvelleValeur: {
        field: payload.field,
        label: payload.label ?? undefined,
        value: payload.newValue,
        metadata: payload.metadata ?? {},
      },
    });
  }

}