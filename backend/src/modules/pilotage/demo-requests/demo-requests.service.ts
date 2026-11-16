import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, paginate, toSkipTake } from '../../../common';
import { DemoRequestStatut, Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateDemoRequestDto,
  QueryDemoRequestsDto,
  UpdateDemoRequestDto,
} from './demo-requests.dto';
import { DemoEvents, type DemoRequestEvent } from './demo.events';
import { DemoMachine } from './demo-status';

@Injectable()
export class DemoRequestsService {
  private readonly logger = new Logger(DemoRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Public form. The request goes to the company that runs the CRM — the first company
   * (single-company install). A bot filling the honeypot gets the same answer, nothing is stored.
   */
  async createPublic(dto: CreateDemoRequestDto) {
    const message = {
      message: 'Merci ! Nous vous recontactons très rapidement pour organiser votre démonstration.',
    };
    const { website, ...data } = dto;
    if (website) {
      this.logger.warn(`Demande de démo ignorée (honeypot rempli) : ${dto.email}`);
      return message;
    }

    const company = await this.prisma.company.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    const request = await this.prisma.demoRequest.create({
      data: { ...data, companyId: company?.id },
    });
    if (company) {
      this.events.emit(DemoEvents.NOUVELLE, {
        companyId: company.id,
        demoRequestId: request.id,
        nom: [data.prenom, data.nom].filter(Boolean).join(' '),
        entreprise: data.entreprise ?? null,
      } satisfies DemoRequestEvent);
    }
    return message;
  }

  async findAll(user: AuthUser, query: QueryDemoRequestsDto) {
    const where: Prisma.DemoRequestWhereInput = {
      companyId: user.companyId,
      statut: query.statuts?.length ? { in: query.statuts } : undefined,
      ...(query.search && {
        OR: [
          { nom: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { entreprise: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: { select: { id: true, nom: true, prenom: true } } },
        ...toSkipTake(query),
      }),
      this.prisma.demoRequest.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.demoRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: { assignedTo: { select: { id: true, nom: true, prenom: true } } },
    });
    if (!row) throw new NotFoundException(`Demande de démo #${id} introuvable`);
    return row;
  }

  async update(user: AuthUser, id: number, dto: UpdateDemoRequestDto) {
    await this.findOne(user, id);
    if (dto.assignedToId) {
      const ok = await this.prisma.user.count({
        where: {
          id: dto.assignedToId,
          companyId: user.companyId,
          actif: true,
          role: { in: [Role.ADMIN, Role.TECHNICO] },
        },
      });
      if (!ok)
        throw new BusinessException(
          'ASSIGNATION_INVALIDE',
          'Assignez la demande à un admin ou un technico actif.',
        );
    }
    await this.prisma.demoRequest.update({ where: { id }, data: dto });
    return this.findOne(user, id);
  }

  /** contacter / planifier / terminer / annuler */
  async transition(user: AuthUser, id: number, to: DemoRequestStatut, dateDemo?: string) {
    const request = await this.findOne(user, id);
    DemoMachine.assert(request.statut, to);
    if (to === 'SCHEDULED' && !dateDemo)
      throw new BusinessException('DATE_DEMO_REQUISE', 'Indiquez la date de la démonstration.');

    const { count } = await this.prisma.demoRequest.updateMany({
      where: { id, statut: request.statut },
      data: {
        statut: to,
        ...(to === 'CONTACTED' && { dateContact: new Date() }),
        ...(dateDemo && { dateDemo: new Date(dateDemo) }),
        ...(!request.assignedTo && { assignedToId: user.id }),
      },
    });
    if (!count)
      throw new BusinessException('DEMANDE_MODIFIEE', 'La demande vient de changer. Rechargez.');
    return this.findOne(user, id);
  }
}
