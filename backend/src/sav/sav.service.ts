import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  SavTicketCategorie,
  SavTicketPriorite,
  SavTicketStatut,
} from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSavTicketNoteDto } from './dto/create-sav-ticket-note.dto.js';
import { CreateSavTicketDto } from './dto/create-sav-ticket.dto.js';
import { QuerySavTicketDto } from './dto/query-sav-ticket.dto.js';
import { UpdateSavTicketDto } from './dto/update-sav-ticket.dto.js';

const internalRoles = [
  Role.ADMIN,
  Role.ASSISTANTE,
  Role.TECHNICO,
  Role.CHEF_CHANTIER,
] as const;

const ticketInclude = {
  client: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      telephone: true,
    },
  },
  devis: {
    select: {
      id: true,
      reference: true,
      statut: true,
      totalTTC: true,
    },
  },
  facture: {
    select: {
      id: true,
      reference: true,
      statut: true,
      montantTTC: true,
    },
  },
  chantier: {
    select: {
      id: true,
      reference: true,
      adresse: true,
      statut: true,
    },
  },
  createur: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      role: true,
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
  _count: {
    select: {
      notes: true,
    },
  },
} satisfies Prisma.SavTicketInclude;

@Injectable()
export class SavService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private ensureInternalUser(currentUser: CurrentUserPayload) {
    if (!internalRoles.includes(currentUser.role as (typeof internalRoles)[number])) {
      throw new ForbiddenException('Acces reserve au service apres-vente interne.');
    }
  }

  private toDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  private async generateReference(companyId: number) {
    const year = new Date().getFullYear();
    const prefix = `SAV-${year}-`;

    const count = await this.prisma.savTicket.count({
      where: {
        companyId,
        reference: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async assertClient(companyId: number, clientId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client introuvable pour cette societe.');
    }
  }

  private async assertUser(companyId: number, userId?: number) {
    if (!userId) return;

    const assignedUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: {
          in: [...internalRoles],
        },
        actif: true,
      },
      select: { id: true },
    });

    if (!assignedUser) {
      throw new NotFoundException('Utilisateur assigne introuvable ou non autorise.');
    }
  }

  private async assertDevis(companyId: number, devisId?: number) {
    if (!devisId) return;

    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId },
      select: { id: true },
    });

    if (!devis) {
      throw new NotFoundException('Devis introuvable pour cette societe.');
    }
  }

  private async assertFacture(companyId: number, factureId?: number) {
    if (!factureId) return;

    const facture = await this.prisma.facture.findFirst({
      where: {
        id: factureId,
        devis: { companyId },
      },
      select: { id: true },
    });

    if (!facture) {
      throw new NotFoundException('Facture introuvable pour cette societe.');
    }
  }

  private async assertChantier(companyId: number, chantierId?: number) {
    if (!chantierId) return;

    const chantier = await this.prisma.chantier.findFirst({
      where: { id: chantierId, companyId },
      select: { id: true },
    });

    if (!chantier) {
      throw new NotFoundException('Chantier introuvable pour cette societe.');
    }
  }

  private async assertTicket(companyId: number, id: number) {
    const ticket = await this.prisma.savTicket.findFirst({
      where: { id, companyId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket SAV introuvable.');
    }

    return ticket;
  }

  private buildWhere(companyId: number, query: QuerySavTicketDto): Prisma.SavTicketWhereInput {
    const search = query.search?.trim();

    return {
      companyId,
      ...(query.statut ? { statut: query.statut } : {}),
      ...(query.priorite ? { priorite: query.priorite } : {}),
      ...(query.categorie ? { categorie: query.categorie } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' } },
              { titre: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { client: { nom: { contains: search, mode: 'insensitive' } } },
              { client: { prenom: { contains: search, mode: 'insensitive' } } },
              { devis: { reference: { contains: search, mode: 'insensitive' } } },
              { facture: { reference: { contains: search, mode: 'insensitive' } } },
              { chantier: { reference: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  async createTicket(dto: CreateSavTicketDto, currentUser: CurrentUserPayload) {
    this.ensureInternalUser(currentUser);

    await Promise.all([
      this.assertClient(currentUser.companyId, dto.clientId),
      this.assertUser(currentUser.companyId, dto.assignedToId),
      this.assertDevis(currentUser.companyId, dto.devisId),
      this.assertFacture(currentUser.companyId, dto.factureId),
      this.assertChantier(currentUser.companyId, dto.chantierId),
    ]);

    if (!dto.devisId && !dto.factureId && !dto.chantierId) {
      throw new BadRequestException(
        'Le ticket SAV doit etre lie a un devis, une facture ou un chantier.',
      );
    }

    const reference = await this.generateReference(currentUser.companyId);

    const ticket = await this.prisma.savTicket.create({
      data: {
        companyId: currentUser.companyId,
        clientId: dto.clientId,
        devisId: dto.devisId,
        factureId: dto.factureId,
        chantierId: dto.chantierId,
        createurId: currentUser.userId,
        assignedToId: dto.assignedToId,
        reference,
        titre: dto.titre,
        description: dto.description,
        statut: dto.statut ?? SavTicketStatut.OUVERT,
        priorite: dto.priorite ?? SavTicketPriorite.NORMALE,
        categorie: dto.categorie ?? SavTicketCategorie.AUTRE,
        dateEcheance: this.toDate(dto.dateEcheance),
      },
      include: ticketInclude,
    });

    await this.auditService.createLog({
      companyId: currentUser.companyId,
      userId: currentUser.userId,
      action: 'SAV_TICKET_CREATED',
      entite: 'SavTicket',
      entiteId: ticket.id,
      nouvelleValeur: {
        reference: ticket.reference,
        titre: ticket.titre,
        statut: ticket.statut,
        priorite: ticket.priorite,
        categorie: ticket.categorie,
      },
    });

    this.emitRealtime(currentUser, 'SAV_TICKET_CREATED', ticket.id);

    return ticket;
  }

  async findAll(query: QuerySavTicketDto, currentUser: CurrentUserPayload) {
    this.ensureInternalUser(currentUser);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(currentUser.companyId, query);

    const [data, total, summary] = await Promise.all([
      this.prisma.savTicket.findMany({
        where,
        include: ticketInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.savTicket.count({ where }),
      this.getSummary(currentUser),
    ]);

    return {
      data,
      summary,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getSummary(currentUser: CurrentUserPayload) {
    this.ensureInternalUser(currentUser);

    const companyId = currentUser.companyId;

    const [total, ouverts, enCours, urgents, resolus, enAttenteClient] =
      await Promise.all([
        this.prisma.savTicket.count({ where: { companyId } }),
        this.prisma.savTicket.count({
          where: { companyId, statut: SavTicketStatut.OUVERT },
        }),
        this.prisma.savTicket.count({
          where: { companyId, statut: SavTicketStatut.EN_COURS },
        }),
        this.prisma.savTicket.count({
          where: {
            companyId,
            priorite: SavTicketPriorite.URGENTE,
            statut: { notIn: [SavTicketStatut.RESOLU, SavTicketStatut.CLOTURE] },
          },
        }),
        this.prisma.savTicket.count({
          where: { companyId, statut: SavTicketStatut.RESOLU },
        }),
        this.prisma.savTicket.count({
          where: { companyId, statut: SavTicketStatut.EN_ATTENTE_CLIENT },
        }),
      ]);

    return {
      total,
      ouverts,
      enCours,
      urgents,
      resolus,
      enAttenteClient,
    };
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    this.ensureInternalUser(currentUser);

    const ticket = await this.prisma.savTicket.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: {
        ...ticketInclude,
        notes: {
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
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket SAV introuvable.');
    }

    return ticket;
  }

  async updateTicket(id: number, dto: UpdateSavTicketDto, currentUser: CurrentUserPayload) {
    this.ensureInternalUser(currentUser);

    const existing = await this.assertTicket(currentUser.companyId, id);

    await Promise.all([
      dto.clientId ? this.assertClient(currentUser.companyId, dto.clientId) : undefined,
      dto.assignedToId ? this.assertUser(currentUser.companyId, dto.assignedToId) : undefined,
      dto.devisId ? this.assertDevis(currentUser.companyId, dto.devisId) : undefined,
      dto.factureId ? this.assertFacture(currentUser.companyId, dto.factureId) : undefined,
      dto.chantierId ? this.assertChantier(currentUser.companyId, dto.chantierId) : undefined,
    ]);

    const dateResolution =
      dto.statut === SavTicketStatut.RESOLU || dto.statut === SavTicketStatut.CLOTURE
        ? new Date()
        : dto.statut && existing.dateResolution
          ? null
          : undefined;

    const ticket = await this.prisma.savTicket.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        devisId: dto.devisId,
        factureId: dto.factureId,
        chantierId: dto.chantierId,
        assignedToId: dto.assignedToId,
        titre: dto.titre,
        description: dto.description,
        statut: dto.statut,
        priorite: dto.priorite,
        categorie: dto.categorie,
        dateEcheance: dto.dateEcheance ? this.toDate(dto.dateEcheance) : undefined,
        dateResolution,
      },
      include: ticketInclude,
    });

    await this.auditService.createLog({
      companyId: currentUser.companyId,
      userId: currentUser.userId,
      action: 'SAV_TICKET_UPDATED',
      entite: 'SavTicket',
      entiteId: ticket.id,
      ancienneValeur: {
        statut: existing.statut,
        priorite: existing.priorite,
        assignedToId: existing.assignedToId,
        titre: existing.titre,
      },
      nouvelleValeur: {
        statut: ticket.statut,
        priorite: ticket.priorite,
        assignedToId: ticket.assignedToId,
        titre: ticket.titre,
      },
    });

    this.emitRealtime(currentUser, 'SAV_TICKET_UPDATED', ticket.id);

    return ticket;
  }

  async addNote(id: number, dto: CreateSavTicketNoteDto, currentUser: CurrentUserPayload) {
    this.ensureInternalUser(currentUser);

    const ticket = await this.assertTicket(currentUser.companyId, id);

    const note = await this.prisma.savTicketNote.create({
      data: {
        ticketId: ticket.id,
        userId: currentUser.userId,
        contenu: dto.contenu,
      },
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
    });

    await this.auditService.createLog({
      companyId: currentUser.companyId,
      userId: currentUser.userId,
      action: 'SAV_NOTE_CREATED',
      entite: 'SavTicket',
      entiteId: ticket.id,
      nouvelleValeur: {
        ticketReference: ticket.reference,
        noteId: note.id,
        contenu: note.contenu,
      },
    });

    this.emitRealtime(currentUser, 'SAV_NOTE_CREATED', ticket.id);

    return note;
  }

  private emitRealtime(
    currentUser: CurrentUserPayload,
    reason: string,
    ticketId: number,
  ) {
    const payload = {
      reason,
      entity: 'SavTicket',
      entityId: ticketId,
      actorId: currentUser.userId,
    };

    this.notificationsService.emitCompanyEvent(
      currentUser.companyId,
      'notifications:changed',
      payload,
    );
    this.notificationsService.emitCompanyEvent(
      currentUser.companyId,
      'sav:changed',
      payload,
    );
  }
}
