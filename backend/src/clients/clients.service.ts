import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { QueryClientDto } from './dto/query-client.dto.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  private readonly typeProjetInclude = {
    categories: {
      orderBy: { ordre: 'asc' },
      include: {
        categorie: {
          select: {
            id: true,
            nom: true,
            description: true,
          },
        },
      },
    },
    _count: { select: { categories: true } },
  } as const;

  private buildClientInclude(extra: Record<string, unknown> = {}) {
    return {
      typeProjet: { include: this.typeProjetInclude },
      typeProjetLinks: {
        orderBy: { typeProjetId: 'asc' as const },
        include: {
          typeProjet: { include: this.typeProjetInclude },
        },
      },
      ...extra,
    } as const;
  }

  private normalizeTypeProjetIds(
    dto: Pick<CreateClientDto, 'typeProjetId' | 'typeProjetIds'>,
  ) {
    if (Array.isArray(dto.typeProjetIds)) {
      return [
        ...new Set(
          dto.typeProjetIds.filter((id) => Number.isInteger(id) && id > 0),
        ),
      ];
    }

    if (Number.isInteger(dto.typeProjetId) && (dto.typeProjetId ?? 0) > 0) {
      return [dto.typeProjetId];
    }

    return undefined;
  }

  private async validateTypeProjetIds(
    typeProjetIds: number[] | undefined,
    companyId: number,
  ) {
    if (typeProjetIds === undefined) return undefined;
    if (typeProjetIds.length === 0) return [];

    const projectTypes = await this.prisma.typeProjet.findMany({
      where: {
        id: { in: typeProjetIds },
        companyId,
        actif: true,
      },
      select: { id: true },
    });

    if (projectTypes.length !== typeProjetIds.length) {
      const foundIds = new Set(
        projectTypes.map((projectType) => projectType.id),
      );
      const missingIds = typeProjetIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Types de projet introuvables ou inactifs: ${missingIds.join(', ')}`,
      );
    }

    return typeProjetIds;
  }

  private serializeClient<
    T extends { typeProjet?: unknown; typeProjetLinks?: unknown[] },
  >(client: T) {
    const rawClient = client as Record<string, any>;
    const typeProjetLinks = Array.isArray(rawClient.typeProjetLinks)
      ? rawClient.typeProjetLinks
      : [];
    const primaryTypeProjet = rawClient.typeProjet ?? null;

    const projectsById = new Map<number, any>();

    if (primaryTypeProjet?.id) {
      projectsById.set(primaryTypeProjet.id, primaryTypeProjet);
    }

    for (const link of typeProjetLinks) {
      const project = link?.typeProjet;
      if (project?.id && !projectsById.has(project.id)) {
        projectsById.set(project.id, project);
      }
    }

    const typeProjets = Array.from(projectsById.values());
    const normalizedPrimaryTypeProjet = typeProjets[0] ?? null;

    const { typeProjetLinks: _ignoredTypeProjetLinks, ...rest } = rawClient;

    return {
      ...rest,
      typeProjetId: normalizedPrimaryTypeProjet?.id ?? null,
      typeProjet: normalizedPrimaryTypeProjet,
      typeProjetIds: typeProjets.map((project) => project.id),
      typeProjets,
    };
  }

  /**
   * Créer un nouveau client (rattaché au companyId de l'utilisateur connecté)
   */
  async create(dto: CreateClientDto, currentUser: CurrentUserPayload) {
    const typeProjetIds = await this.validateTypeProjetIds(
      this.normalizeTypeProjetIds(dto),
      currentUser.companyId,
    );

    const client = await this.prisma.client.create({
      data: {
        companyId: currentUser.companyId,
        nom: dto.nom,
        prenom: dto.prenom,
        telephone: dto.telephone,
        email: dto.email,
        adresseClient: dto.adresseClient,
        adresseChantier: dto.adresseChantier,
        source: dto.source,
        notes: dto.notes,
        besoin: dto.besoin,
        typeProjetId: typeProjetIds?.[0],
        typeProjetLinks:
          typeProjetIds && typeProjetIds.length > 0
            ? {
                create: typeProjetIds.map((typeProjetId) => ({ typeProjetId })),
              }
            : undefined,
      },
      include: this.buildClientInclude(),
    });

    return this.serializeClient(client);
  }

  /**
   * Liste des clients avec pagination, recherche et filtre
   * Isolation SaaS : filtre par companyId
   */
  async findAll(query: QueryClientDto, currentUser: CurrentUserPayload) {
    const { page = 1, limit = 20, search, source } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      companyId: currentUser.companyId,
    };

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search } },
      ];
    }

    if (source) {
      where.source = source;
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.buildClientInclude(),
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: data.map((client) => this.serializeClient(client)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Détail d'un client (même companyId uniquement)
   */
  async findOne(id: number, currentUser: CurrentUserPayload) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: this.buildClientInclude({
        demandesDevis: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        devis: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        chantiers: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      }),
    });

    if (!client) {
      throw new NotFoundException(`Client #${id} non trouvé`);
    }

    if (client.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à ce client');
    }

    return this.serializeClient(client);
  }

  /**
   * Modifier un client (même companyId uniquement)
   */
  async update(
    id: number,
    dto: UpdateClientDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.findOne(id, currentUser);

    const normalizedTypeProjetIds = this.normalizeTypeProjetIds(dto);
    const typeProjetIds =
      normalizedTypeProjetIds !== undefined
        ? await this.validateTypeProjetIds(
            normalizedTypeProjetIds,
            currentUser.companyId,
          )
        : undefined;

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        nom: dto.nom,
        prenom: dto.prenom,
        telephone: dto.telephone,
        email: dto.email,
        adresseClient: dto.adresseClient,
        adresseChantier: dto.adresseChantier,
        source: dto.source,
        notes: dto.notes,
        besoin: dto.besoin,
        typeProjetId:
          typeProjetIds !== undefined ? (typeProjetIds[0] ?? null) : undefined,
        typeProjetLinks:
          typeProjetIds !== undefined
            ? {
                deleteMany: {},
                ...(typeProjetIds.length > 0
                  ? {
                      create: typeProjetIds.map((typeProjetId) => ({
                        typeProjetId,
                      })),
                    }
                  : {}),
              }
            : undefined,
      },
      include: this.buildClientInclude(),
    });

    return this.serializeClient(client);
  }

  /**
   * Supprimer un client (hard delete — ADMIN uniquement)
   */
  async remove(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    return this.prisma.$transaction(async (tx) => {
      const devisRows = await tx.devis.findMany({
        where: {
          clientId: id,
          companyId: currentUser.companyId,
        },
        select: { id: true },
      });
      const devisIds = devisRows.map((devis) => devis.id);

      if (devisIds.length > 0) {
        const commandesRows = await tx.commandeFournisseur.findMany({
          where: { devisId: { in: devisIds } },
          select: { id: true },
        });
        const commandeIds = commandesRows.map((commande) => commande.id);

        if (commandeIds.length > 0) {
          await tx.reception.deleteMany({
            where: { commandeFournisseurId: { in: commandeIds } },
          });
          await tx.ligneCommandeFournisseur.deleteMany({
            where: { commandeFournisseurId: { in: commandeIds } },
          });
        }

        await tx.commandeFournisseur.deleteMany({
          where: { devisId: { in: devisIds } },
        });
        await tx.bonCommande.deleteMany({
          where: { devisId: { in: devisIds } },
        });
        await tx.facture.deleteMany({
          where: { devisId: { in: devisIds } },
        });
        await tx.devis.deleteMany({
          where: { id: { in: devisIds } },
        });
      }

      await tx.demandeDevis.deleteMany({
        where: {
          clientId: id,
          companyId: currentUser.companyId,
        },
      });

      const chantierRows = await tx.chantier.findMany({
        where: {
          clientId: id,
          companyId: currentUser.companyId,
        },
        select: { id: true },
      });
      const chantierIds = chantierRows.map((chantier) => chantier.id);

      if (chantierIds.length > 0) {
        await tx.documentChantier.deleteMany({
          where: { chantierId: { in: chantierIds } },
        });
        await tx.tache.deleteMany({
          where: { chantierId: { in: chantierIds } },
        });
        await tx.chantier.deleteMany({
          where: { id: { in: chantierIds } },
        });
      }

      return tx.client.delete({
        where: { id },
      });
    });
  }
}
