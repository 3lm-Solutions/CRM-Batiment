import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, paginate, ReferencePrefix, ReferenceService, toSkipTake } from '../../../common';
import { Prisma, Role, SavTicketCategorie, SavTicketStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSavTicketDto, QuerySavDto, ResoudreSavDto, SavNoteDto, UpdateSavTicketDto } from './sav.dto';
import { type SavEvent, SavEvents } from './sav.events';
import { SavMachine } from './sav-status';

const INCLUDE = {
  client: { select: { id: true, nom: true, prenom: true, telephone: true } },
  devis: { select: { id: true, reference: true } },
  facture: { select: { id: true, reference: true } },
  chantier: { select: { id: true, reference: true } },
  createur: { select: { id: true, nom: true, prenom: true } },
  assignedTo: { select: { id: true, nom: true, prenom: true } },
  notes: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, nom: true, prenom: true } } } },
} satisfies Prisma.SavTicketInclude;

@Injectable()
export class SavService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(user: AuthUser, query: QuerySavDto) {
    // The role scope (e.g. a chef's own job sites) is ANDed with the filters: a filter or a
    // search can narrow it but never replace it (a spread let `chefChantierId: undefined`
    // or a search `OR` silently override the scope).
    const where: Prisma.SavTicketWhereInput = {
      AND: [
        this.scope(user),
        {
          statut: query.statuts?.length ? { in: query.statuts } : undefined,
          priorite: query.priorite,
          categorie: query.categorie,
          clientId: query.clientId,
          assignedToId: query.assignedToId,
          ...(query.search && {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { titre: { contains: query.search, mode: 'insensitive' } },
              { client: { nom: { contains: query.search, mode: 'insensitive' } } },
            ],
          }),
        },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.savTicket.findMany({
        where,
        // PostgreSQL orders enums by declaration (BASSE < … < URGENTE): urgent first, across ALL pages
        orderBy: [{ priorite: 'desc' }, { createdAt: 'desc' }],
        include: { client: { select: { id: true, nom: true } }, assignedTo: { select: { id: true, nom: true, prenom: true } } },
        ...toSkipTake(query),
      }),
      this.prisma.savTicket.count({ where }),
    ]);
    return paginate(rows, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const ticket = await this.prisma.savTicket.findFirst({ where: { id, ...this.scope(user) }, include: INCLUDE });
    if (!ticket) throw new NotFoundException(`Ticket #${id} introuvable`);
    return ticket;
  }

  async create(user: AuthUser, dto: CreateSavTicketDto) {
    await this.assertLinks(user.companyId, dto);
    await this.assertAssignee(user.companyId, dto.assignedToId);

    const ticket = await this.prisma.$transaction(async (tx) =>
      tx.savTicket.create({
        data: {
          ...dto,
          companyId: user.companyId,
          createurId: user.id,
          reference: await this.references.next(ReferencePrefix.SAV, user.companyId, tx),
        },
      }),
    );
    this.emit(SavEvents.CREE, ticket);
    return this.findOne(user, ticket.id);
  }

  async update(user: AuthUser, id: number, dto: UpdateSavTicketDto) {
    const ticket = await this.findOne(user, id);
    if (ticket.statut === 'CLOTURE') throw new BusinessException('TICKET_CLOTURE', 'Un ticket clôturé ne se modifie plus.');
    await this.assertAssignee(user.companyId, dto.assignedToId);

    const updated = await this.prisma.savTicket.update({ where: { id }, data: dto });
    if (dto.assignedToId && dto.assignedToId !== ticket.assignedTo?.id) this.emit(SavEvents.ASSIGNE, updated);
    return this.findOne(user, id);
  }

  /** prendre-en-charge / attente-client / resoudre / cloturer / rouvrir */
  async transition(user: AuthUser, id: number, to: SavTicketStatut, dto: ResoudreSavDto = {}) {
    const ticket = await this.findOne(user, id);
    SavMachine.assert(ticket.statut, to);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.savTicket.updateMany({
        where: { id, statut: ticket.statut },
        data: {
          statut: to,
          ...(to === 'RESOLU' && { dateResolution: new Date() }),
          ...(to === 'EN_COURS' && ticket.statut === 'RESOLU' && { dateResolution: null }),
          // Taking a ticket assigns it to you if nobody had it
          ...(to === 'EN_COURS' && !ticket.assignedTo && { assignedToId: user.id }),
        },
      });
      if (!count) throw new BusinessException('TICKET_MODIFIE', 'Le ticket vient de changer de statut. Rechargez.');
      if (dto.note) await tx.savTicketNote.create({ data: { ticketId: id, userId: user.id, contenu: dto.note } });
    });
    return this.findOne(user, id);
  }

  async addNote(user: AuthUser, id: number, dto: SavNoteDto) {
    const ticket = await this.findOne(user, id);
    if (ticket.statut === 'CLOTURE') throw new BusinessException('TICKET_CLOTURE', 'Un ticket clôturé ne reçoit plus de notes.');
    await this.prisma.savTicketNote.create({ data: { ticketId: id, userId: user.id, contenu: dto.contenu } });
    return this.findOne(user, id);
  }

  // ── client online space (Step 11) ───────────────────────────────────────

  /**
   * Ticket opened by the client himself (no user account: createur = null, origine ESPACE_CLIENT).
   * The job site, if given, must be one of his.
   */
  async createFromClient(
    companyId: number,
    clientId: number,
    input: { titre: string; description: string; chantierId?: number; categorie?: SavTicketCategorie },
  ) {
    if (input.chantierId) {
      const ok = await this.prisma.chantier.count({ where: { id: input.chantierId, companyId, clientId } });
      if (!ok) throw new BusinessException('LIEN_INVALIDE', 'Ce chantier ne vous concerne pas.');
    }
    const ticket = await this.prisma.$transaction(async (tx) =>
      tx.savTicket.create({
        data: {
          companyId,
          clientId,
          chantierId: input.chantierId,
          titre: input.titre,
          description: input.description,
          categorie: input.categorie ?? 'AUTRE',
          origine: 'ESPACE_CLIENT',
          createurId: null,
          reference: await this.references.next(ReferencePrefix.SAV, companyId, tx),
        },
      }),
    );
    this.emit(SavEvents.CREE, ticket);
    return ticket;
  }

  /** Message from the client on one of his tickets (author = null = the client). */
  async addClientNote(companyId: number, clientId: number, ticketId: number, contenu: string) {
    const ticket = await this.prisma.savTicket.findFirst({ where: { id: ticketId, companyId, clientId } });
    if (!ticket) throw new NotFoundException(`Ticket #${ticketId} introuvable`);
    if (ticket.statut === 'CLOTURE') throw new BusinessException('TICKET_CLOTURE', 'Ce ticket est clôturé.');
    await this.prisma.$transaction(async (tx) => {
      await tx.savTicketNote.create({ data: { ticketId, userId: null, contenu } });
      // The client answered: a ticket waiting for him goes back to the team
      if (ticket.statut === 'EN_ATTENTE_CLIENT') {
        await tx.savTicket.updateMany({ where: { id: ticketId, statut: 'EN_ATTENTE_CLIENT' }, data: { statut: 'EN_COURS' } });
      }
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Linked quote / invoice / job site must belong to the same company AND the same client. */
  private async assertLinks(companyId: number, dto: CreateSavTicketDto): Promise<void> {
    const client = await this.prisma.client.count({ where: { id: dto.clientId, companyId } });
    if (!client) throw new BusinessException('CLIENT_INTROUVABLE', 'Client introuvable.');
    const checks = await Promise.all([
      dto.devisId ? this.prisma.devis.count({ where: { id: dto.devisId, companyId, clientId: dto.clientId } }) : 1,
      dto.factureId ? this.prisma.facture.count({ where: { id: dto.factureId, companyId, devis: { clientId: dto.clientId } } }) : 1,
      dto.chantierId ? this.prisma.chantier.count({ where: { id: dto.chantierId, companyId, clientId: dto.clientId } }) : 1,
    ]);
    if (checks.includes(0)) {
      throw new BusinessException('LIEN_INVALIDE', 'Le devis, la facture ou le chantier ne correspond pas à ce client.');
    }
  }

  private async assertAssignee(companyId: number, userId: number | null | undefined): Promise<void> {
    if (!userId) return;
    const ok = await this.prisma.user.count({
      where: { id: userId, companyId, actif: true, role: { in: [Role.ADMIN, Role.TECHNICO, Role.ASSISTANTE, Role.CHEF_CHANTIER] } },
    });
    if (!ok) throw new BusinessException('ASSIGNATION_INVALIDE', 'Le ticket doit être assigné à un membre actif de l’équipe.');
  }

  /** Chef de chantier: tickets of his job sites or assigned to him. */
  private scope(user: AuthUser): Prisma.SavTicketWhereInput {
    return user.role === Role.CHEF_CHANTIER
      ? { companyId: user.companyId, OR: [{ assignedToId: user.id }, { chantier: { chefChantierId: user.id } }] }
      : { companyId: user.companyId };
  }

  private emit(event: string, t: { id: number; companyId: number; reference: string; titre: string; priorite: string; assignedToId: number | null }) {
    this.events.emit(event, {
      companyId: t.companyId,
      ticketId: t.id,
      reference: t.reference,
      titre: t.titre,
      priorite: t.priorite,
      assignedToId: t.assignedToId,
    } satisfies SavEvent);
  }
}
