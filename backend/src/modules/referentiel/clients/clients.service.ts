import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, parseSort, toSkipTake } from '../../../common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CLIENT_SORT_FIELDS, CreateClientDto, QueryClientsDto, UpdateClientDto } from './dto/clients.dto';

const CLIENT_INCLUDE = {
  typeProjetLinks: {
    orderBy: { typeProjetId: 'asc' },
    select: { typeProjet: { select: { id: true, nom: true } } },
  },
} satisfies Prisma.ClientInclude;

type ClientWithTypes = Prisma.ClientGetPayload<{ include: typeof CLIENT_INCLUDE }>;

/** API shape: the join table is flattened into `typeProjets` / `typeProjetIds`. */
function toResponse<T extends ClientWithTypes>(client: T) {
  const { typeProjetLinks, ...rest } = client;
  const typeProjets = typeProjetLinks.map((link) => link.typeProjet);
  return { ...rest, typeProjets, typeProjetIds: typeProjets.map((t) => t.id) };
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: QueryClientsDto) {
    const where: Prisma.ClientWhereInput = {
      companyId: user.companyId,
      archivedAt: query.archived ? { not: null } : null,
      source: query.source,
      ...(query.typeProjetIds?.length && {
        typeProjetLinks: { some: { typeProjetId: { in: query.typeProjetIds } } },
      }),
      ...(query.search && {
        OR: [
          { nom: { contains: query.search, mode: 'insensitive' } },
          { prenom: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { telephone: { contains: query.search } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: CLIENT_INCLUDE,
        orderBy: parseSort(query.sort, CLIENT_SORT_FIELDS, { createdAt: 'desc' }),
        ...toSkipTake(query),
      }),
      this.prisma.client.count({ where }),
    ]);
    return paginate(data.map(toResponse), total, query);
  }

  /** Detail + activity summary (latest requests, quotes, job sites). */
  async findOne(user: AuthUser, id: number) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        ...CLIENT_INCLUDE,
        demandesDevis: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, reference: true, statut: true, createdAt: true },
        },
        devis: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, reference: true, statut: true, totalTTC: true, createdAt: true },
        },
        chantiers: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, reference: true, statut: true, adresse: true },
        },
        _count: { select: { demandesDevis: true, devis: true, chantiers: true, savTickets: true } },
      },
    });
    if (!client) throw new NotFoundException(`Client #${id} introuvable`);
    return toResponse(client);
  }

  async create(user: AuthUser, dto: CreateClientDto) {
    const { typeProjetIds, ...data } = dto;
    await this.assertTypesProjet(user.companyId, typeProjetIds);

    const client = await this.prisma.client.create({
      data: {
        ...data,
        companyId: user.companyId,
        typeProjetLinks: typeProjetIds?.length
          ? { create: typeProjetIds.map((typeProjetId) => ({ typeProjetId })) }
          : undefined,
      },
      include: CLIENT_INCLUDE,
    });
    return toResponse(client);
  }

  async update(user: AuthUser, id: number, dto: UpdateClientDto) {
    await this.ensureExists(user, id);
    const { typeProjetIds, ...data } = dto;
    await this.assertTypesProjet(user.companyId, typeProjetIds);

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...data,
        // `undefined` = leave the links alone; `[]` = remove them all
        typeProjetLinks:
          typeProjetIds !== undefined
            ? { deleteMany: {}, create: typeProjetIds.map((typeProjetId) => ({ typeProjetId })) }
            : undefined,
      },
      include: CLIENT_INCLUDE,
    });
    return toResponse(client);
  }

  async archive(user: AuthUser, id: number) {
    await this.ensureExists(user, id);
    return toResponse(
      await this.prisma.client.update({
        where: { id },
        data: { archivedAt: new Date() },
        include: CLIENT_INCLUDE,
      }),
    );
  }

  async unarchive(user: AuthUser, id: number) {
    await this.ensureExists(user, id);
    return toResponse(
      await this.prisma.client.update({ where: { id }, data: { archivedAt: null }, include: CLIENT_INCLUDE }),
    );
  }

  /**
   * Hard delete, ONLY for a client with no history (typo, duplicate…).
   * v2: the old version deleted the client's quotes, invoices — paid ones included —,
   * supplier orders and job sites in cascade. Clients with history must be archived.
   */
  async remove(user: AuthUser, id: number): Promise<void> {
    const client = await this.findOne(user, id);
    const history = Object.values(client._count).reduce((a, b) => a + b, 0);
    if (history > 0) {
      throw new BusinessException(
        'CLIENT_AVEC_HISTORIQUE',
        'Ce client a des demandes, devis, chantiers ou tickets SAV : archivez-le au lieu de le supprimer.',
      );
    }
    await this.prisma.client.delete({ where: { id } });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async ensureExists(user: AuthUser, id: number): Promise<void> {
    const found = await this.prisma.client.count({ where: { id, companyId: user.companyId } });
    if (!found) throw new NotFoundException(`Client #${id} introuvable`);
  }

  /** Project types must exist, be active and belong to the same company. */
  private async assertTypesProjet(companyId: number, ids: number[] | undefined): Promise<void> {
    if (!ids?.length) return;
    const found = await this.prisma.typeProjet.count({ where: { id: { in: ids }, companyId, actif: true } });
    if (found !== ids.length) {
      throw new BusinessException('TYPE_PROJET_INVALIDE', 'Un ou plusieurs types de projet sont introuvables ou inactifs.');
    }
  }
}
