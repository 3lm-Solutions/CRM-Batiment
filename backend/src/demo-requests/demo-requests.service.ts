import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DemoRequestStatut,
  Prisma,
  Role,
} from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePublicDemoRequestDto } from './dto/create-demo-request.dto.js';
import { QueryDemoRequestDto } from './dto/query-demo-request.dto.js';
import { UpdateDemoRequestDto } from './dto/update-demo-request.dto.js';

const commercialRoles = [Role.ADMIN, Role.ASSISTANTE, Role.TECHNICO] as const;

const allowedTransitions: Record<DemoRequestStatut, DemoRequestStatut[]> = {
  [DemoRequestStatut.PENDING]: [
    DemoRequestStatut.CONTACTED,
    DemoRequestStatut.CANCELED,
  ],
  [DemoRequestStatut.CONTACTED]: [
    DemoRequestStatut.PENDING,
    DemoRequestStatut.SCHEDULED,
    DemoRequestStatut.CANCELED,
  ],
  [DemoRequestStatut.SCHEDULED]: [
    DemoRequestStatut.CONTACTED,
    DemoRequestStatut.DONE,
    DemoRequestStatut.CANCELED,
  ],
  [DemoRequestStatut.DONE]: [DemoRequestStatut.SCHEDULED],
  [DemoRequestStatut.CANCELED]: [DemoRequestStatut.PENDING],
};

const demoRequestInclude = {
  company: {
    select: {
      id: true,
      nom: true,
      email: true,
      telephone: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.DemoRequestInclude;

@Injectable()
export class DemoRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private ensureCommercialUser(currentUser: CurrentUserPayload) {
    if (
      !commercialRoles.includes(
        currentUser.role as (typeof commercialRoles)[number],
      )
    ) {
      throw new ForbiddenException('Accès réservé au back-office commercial.');
    }
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }

  private toDate(value?: string | null) {
    if (value === null) return null;
    return value ? new Date(value) : undefined;
  }

  private async resolvePublicCompanyId(companyId?: number) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId },
        select: { id: true },
      });

      if (company) return company.id;
    }

    const defaultCompany = await this.prisma.company.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    return defaultCompany?.id ?? null;
  }

  private async assertAssignedUser(companyId: number, userId?: number | null) {
    if (!userId) return;

    const assignedUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        actif: true,
        role: { in: [...commercialRoles] },
      },
      select: { id: true },
    });

    if (!assignedUser) {
      throw new NotFoundException(
        'Utilisateur commercial introuvable ou non autorisé.',
      );
    }
  }

  private assertTransition(
    current: DemoRequestStatut,
    next: DemoRequestStatut,
  ) {
    if (current === next) return;

    if (!allowedTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Transition de statut interdite : ${current} → ${next}.`,
      );
    }
  }

  private buildWhere(
    companyId: number,
    query: QueryDemoRequestDto,
  ): Prisma.DemoRequestWhereInput {
    const search = this.normalizeText(query.search);

    return {
      companyId,
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(search
        ? {
            OR: [
              { nom: { contains: search, mode: 'insensitive' } },
              { prenom: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { telephone: { contains: search, mode: 'insensitive' } },
              { entreprise: { contains: search, mode: 'insensitive' } },
              { message: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  async createPublic(dto: CreatePublicDemoRequestDto) {
    const companyId = await this.resolvePublicCompanyId(dto.companyId);

    const request = await this.prisma.demoRequest.create({
      data: {
        companyId,
        nom: dto.nom.trim(),
        prenom: this.normalizeText(dto.prenom),
        email: dto.email.trim().toLowerCase(),
        telephone: this.normalizeText(dto.telephone),
        entreprise: this.normalizeText(dto.entreprise),
        message: this.normalizeText(dto.message),
        statut: DemoRequestStatut.PENDING,
        source: 'PUBLIC_FORM',
      },
      include: demoRequestInclude,
    });

    if (companyId) {
      await this.auditService.createLog({
        companyId,
        userId: null,
        action: 'DEMO_REQUEST_CREATED',
        entite: 'DemoRequest',
        entiteId: request.id,
        nouvelleValeur: {
          nom: request.nom,
          prenom: request.prenom,
          email: request.email,
          entreprise: request.entreprise,
          statut: request.statut,
          source: request.source,
        },
      });

      this.notificationsService.emitCompanyEvent(
        companyId,
        'notifications:changed',
        {
          reason: 'DEMO_REQUEST_CREATED',
          entity: 'DemoRequest',
          entityId: request.id,
          actorId: null,
        },
      );
      this.notificationsService.emitCompanyEvent(companyId, 'demo:changed', {
        reason: 'DEMO_REQUEST_CREATED',
        entity: 'DemoRequest',
        entityId: request.id,
        actorId: null,
      });
    }

    return {
      message: 'Votre demande de démo a été envoyée avec succès.',
      data: request,
    };
  }

  async findAll(query: QueryDemoRequestDto, currentUser: CurrentUserPayload) {
    this.ensureCommercialUser(currentUser);

    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(currentUser.companyId, query);

    const [data, total] = await Promise.all([
      this.prisma.demoRequest.findMany({
        where,
        include: demoRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.demoRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getSummary(currentUser: CurrentUserPayload) {
    this.ensureCommercialUser(currentUser);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const [
      total,
      pending,
      contacted,
      scheduled,
      done,
      canceled,
      scheduledSoon,
    ] = await Promise.all([
      this.prisma.demoRequest.count({
        where: { companyId: currentUser.companyId },
      }),
      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.PENDING,
        },
      }),
      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.CONTACTED,
        },
      }),
      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.SCHEDULED,
        },
      }),
      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.DONE,
        },
      }),
      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.CANCELED,
        },
      }),
      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.SCHEDULED,
          dateDemo: { gte: now, lte: tomorrow },
        },
      }),
    ]);

    return {
      total,
      pending,
      contacted,
      scheduled,
      done,
      canceled,
      scheduledSoon,
    };
  }

  async getAssignees(currentUser: CurrentUserPayload) {
    this.ensureCommercialUser(currentUser);

    return this.prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        actif: true,
        role: { in: [...commercialRoles] },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
      },
      orderBy: [{ prenom: 'asc' }, { nom: 'asc' }],
    });
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    this.ensureCommercialUser(currentUser);

    const request = await this.prisma.demoRequest.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: demoRequestInclude,
    });

    if (!request) {
      throw new NotFoundException('Demande de démo introuvable.');
    }

    return request;
  }

  async update(
    id: number,
    dto: UpdateDemoRequestDto,
    currentUser: CurrentUserPayload,
  ) {
    this.ensureCommercialUser(currentUser);

    const existing = await this.prisma.demoRequest.findFirst({
      where: { id, companyId: currentUser.companyId },
    });

    if (!existing) {
      throw new NotFoundException('Demande de démo introuvable.');
    }

    await this.assertAssignedUser(currentUser.companyId, dto.assignedToId);

    const nextStatut = dto.statut ?? existing.statut;
    this.assertTransition(existing.statut, nextStatut);

    const requestedDateDemo = this.toDate(dto.dateDemo);
    const nextDateDemo =
      requestedDateDemo === undefined ? existing.dateDemo : requestedDateDemo;
    const nextAssignedToId =
      dto.assignedToId === undefined ? existing.assignedToId : dto.assignedToId;

    if (nextStatut === DemoRequestStatut.SCHEDULED && !nextDateDemo) {
      throw new BadRequestException(
        'Une date de démonstration est obligatoire pour planifier la demande.',
      );
    }

    if (
      (nextStatut === DemoRequestStatut.SCHEDULED ||
        nextStatut === DemoRequestStatut.DONE) &&
      !nextAssignedToId
    ) {
      throw new BadRequestException(
        'Un utilisateur commercial doit être assigné avant la planification.',
      );
    }

    const automaticDateContact =
      nextStatut === DemoRequestStatut.CONTACTED && !existing.dateContact
        ? new Date()
        : undefined;

    const nextDateContact =
      this.toDate(dto.dateContact) ?? automaticDateContact ?? existing.dateContact;
    const nextNotes = dto.notes === undefined ? existing.notes : dto.notes;
    const nextEmail =
      dto.email === undefined
        ? existing.email
        : dto.email.trim().toLowerCase();
    const nextTelephone =
      dto.telephone === undefined
        ? existing.telephone
        : (this.normalizeText(dto.telephone) ?? null);

    // La demande et sa trace d'audit doivent être enregistrées ensemble.
    // Si l'une des deux écritures échoue, Prisma annule toute la transaction.
    const updated = (await this.prisma.$transaction(async (transaction) => {
      const savedRequest = await transaction.demoRequest.update({
        where: { id },
        data: {
          statut: nextStatut,
          assignedToId: dto.assignedToId,
          dateContact: this.toDate(dto.dateContact) ?? automaticDateContact,
          dateDemo: requestedDateDemo,
          notes: dto.notes,
          email: dto.email?.trim().toLowerCase(),
          telephone:
            dto.telephone === undefined
              ? undefined
              : (this.normalizeText(dto.telephone) ?? null),
        },
        include: demoRequestInclude,
      });

      await transaction.auditLog.create({
        data: {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          action: 'DEMO_REQUEST_UPDATED',
          entite: 'DemoRequest',
          entiteId: id,
          ancienneValeur: {
            statut: existing.statut,
            assignedToId: existing.assignedToId,
            dateContact: existing.dateContact?.toISOString() ?? null,
            dateDemo: existing.dateDemo?.toISOString() ?? null,
            notes: existing.notes,
            email: existing.email,
            telephone: existing.telephone,
          },
          nouvelleValeur: {
            statut: nextStatut,
            assignedToId: nextAssignedToId,
            dateContact: nextDateContact?.toISOString() ?? null,
            dateDemo: nextDateDemo?.toISOString() ?? null,
            notes: nextNotes,
            nom: existing.nom,
            prenom: existing.prenom,
            email: nextEmail,
            telephone: nextTelephone,
            entreprise: existing.entreprise,
          },
        },
      });

      return savedRequest;
    })) as Prisma.DemoRequestGetPayload<{
      include: typeof demoRequestInclude;
    }>;

    const eventPayload = {
      reason: 'DEMO_REQUEST_UPDATED',
      entity: 'DemoRequest',
      entityId: updated.id,
      actorId: currentUser.userId,
      status: updated.statut,
    };
    this.notificationsService.emitCompanyEvent(
      currentUser.companyId,
      'notifications:changed',
      eventPayload,
    );
    this.notificationsService.emitCompanyEvent(
      currentUser.companyId,
      'demo:changed',
      eventPayload,
    );

    return updated;
  }
}
