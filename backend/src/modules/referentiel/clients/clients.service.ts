import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, parseSort, toSkipTake } from '../../../common';
import { Prisma, Role, type TypeClient } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CLIENT_SORT_FIELDS,
  CreateClientDto,
  QueryClientsDto,
  UpdateClientDto,
} from './dto/clients.dto';

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

/** Fields that only make sense for a company client. */
const CHAMPS_PRO = ['siret', 'tvaIntracom', 'contactNom', 'contactFonction'] as const;

/**
 * Étape 1 (26/10): a private person never keeps company fields; a company has no first name
 * (`nom` is its company name). Switching a client to PARTICULIER empties the company fields.
 */
export function appliquerCategorie<
  T extends Partial<Record<(typeof CHAMPS_PRO)[number] | 'prenom', string | null>>,
>(data: T, type: TypeClient): T {
  if (type === 'PROFESSIONNEL') return { ...data, prenom: null };
  const out = { ...data };
  for (const k of CHAMPS_PRO) (out as Record<string, unknown>)[k] = null;
  return out;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: QueryClientsDto) {
    const where: Prisma.ClientWhereInput = {
      companyId: user.companyId,
      archivedAt: query.archived ? { not: null } : null,
      source: query.source,
      typeClient: query.typeClient,
      ...(query.statuts?.length && { statut: { in: query.statuts } }),
      ...(query.typeProjetIds?.length && {
        typeProjetLinks: { some: { typeProjetId: { in: query.typeProjetIds } } },
      }),
      ...(query.search && {
        OR: [
          { nom: { contains: query.search, mode: 'insensitive' } },
          { prenom: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { telephone: { contains: query.search } },
          { siret: { contains: query.search.replace(/\s+/g, '') } },
          { contactNom: { contains: query.search, mode: 'insensitive' } },
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
    // 29/10: a chef de chantier only gets what he can open — the SIGNED quotes and the job sites
    // that are his, without any amount, and no quote request (office pages). The links of the
    // other quotes ended on « Devis introuvable ».
    const chef = user.role === Role.CHEF_CHANTIER;
    const devisWhere: Prisma.DevisWhereInput = chef
      ? { statut: 'SIGNE', chantier: { chefChantierId: user.id } }
      : {};
    const chantiersWhere: Prisma.ChantierWhereInput = chef ? { chefChantierId: user.id } : {};
    const client = await this.prisma.client.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        ...CLIENT_INCLUDE,
        demandesDevis: {
          where: chef ? { id: -1 } : {},
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, reference: true, statut: true, createdAt: true },
        },
        devis: {
          where: devisWhere,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, reference: true, statut: true, totalTTC: true, createdAt: true },
        },
        chantiers: {
          where: chantiersWhere,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, reference: true, statut: true, adresse: true },
        },
        _count: {
          select: {
            demandesDevis: chef ? { where: { id: -1 } } : true,
            devis: { where: devisWhere },
            chantiers: { where: chantiersWhere },
            savTickets: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException(`Client #${id} introuvable`);
    const vue = toResponse(client);
    return chef ? { ...vue, devis: vue.devis.map(({ totalTTC: _montant, ...d }) => d) } : vue;
  }

  async create(user: AuthUser, dto: CreateClientDto) {
    const { typeProjetIds, ...rest } = dto;
    await this.assertTypesProjet(user.companyId, typeProjetIds);
    // 29/10: the « Prospects » list only holds qualified prospects — a contact entered by hand
    // starts qualified (the database default PROSPECT stays for older rows only)
    const data = appliquerCategorie(
      { ...rest, statut: rest.statut ?? 'QUALIFIE' },
      rest.typeClient ?? 'PARTICULIER',
    );
    if (data.statut === 'CLIENT') Object.assign(data, { devenuClientLe: new Date() });

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
    const current = await this.prisma.client.findFirst({
      where: { id, companyId: user.companyId },
      select: { typeClient: true, statut: true },
    });
    if (!current) throw new NotFoundException(`Client #${id} introuvable`);
    const { typeProjetIds, ...rest } = dto;
    await this.assertTypesProjet(user.companyId, typeProjetIds);
    const data = appliquerCategorie(rest, rest.typeClient ?? current.typeClient);
    // Manual change (27/10): the date is set when he becomes a client, cleared if moved back
    if (data.statut && data.statut !== current.statut)
      Object.assign(data, { devenuClientLe: data.statut === 'CLIENT' ? new Date() : null });

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
      await this.prisma.client.update({
        where: { id },
        data: { archivedAt: null },
        include: CLIENT_INCLUDE,
      }),
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
    const found = await this.prisma.typeProjet.count({
      where: { id: { in: ids }, companyId, actif: true },
    });
    if (found !== ids.length) {
      throw new BusinessException(
        'TYPE_PROJET_INVALIDE',
        'Un ou plusieurs types de projet sont introuvables ou inactifs.',
      );
    }
  }
}
