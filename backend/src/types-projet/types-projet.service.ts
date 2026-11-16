import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTypeProjetDto } from './dto/create-type-projet.dto.js';
import { UpdateTypeProjetDto } from './dto/update-type-projet.dto.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';

const typeProjetInclude = {
  categories: {
    orderBy: { ordre: 'asc' as const },
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
  _count: {
    select: {
      clientLinks: true,
      categories: true,
    },
  },
} as const;

@Injectable()
export class TypesProjetService {
  constructor(private prisma: PrismaService) {}

  private serializeTypeProjet<
    T extends { _count?: { clientLinks?: number; categories?: number } },
  >(typeProjet: T) {
    const rawTypeProjet = typeProjet as Record<string, any>;
    const count = rawTypeProjet._count;

    return {
      ...rawTypeProjet,
      _count: count
        ? {
            clients: count.clientLinks ?? 0,
            categories: count.categories ?? 0,
          }
        : undefined,
    };
  }

  private async validateCategorieIds(
    categorieIds: number[] | undefined,
    companyId: number,
  ) {
    const normalizedIds = [
      ...new Set(
        (categorieIds ?? []).filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    if (normalizedIds.length === 0) return [];

    const categories = await this.prisma.categoriePrestation.findMany({
      where: {
        id: { in: normalizedIds },
        companyId,
        actif: true,
      },
      select: { id: true },
    });

    if (categories.length !== normalizedIds.length) {
      const foundIds = new Set(categories.map((category) => category.id));
      const missingIds = normalizedIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Categories de prestations introuvables ou inactives: ${missingIds.join(', ')}`,
      );
    }

    return normalizedIds;
  }

  async create(dto: CreateTypeProjetDto, currentUser: CurrentUserPayload) {
    const categorieIds = await this.validateCategorieIds(
      dto.categorieIds,
      currentUser.companyId,
    );

    const typeProjet = await this.prisma.typeProjet.create({
      data: {
        nom: dto.nom,
        description: dto.description,
        companyId: currentUser.companyId,
        categories: categorieIds.length
          ? {
              create: categorieIds.map((categorieId, index) => ({
                categorieId,
                ordre: index,
              })),
            }
          : undefined,
      },
      include: typeProjetInclude,
    });

    return this.serializeTypeProjet(typeProjet);
  }

  async findAll(currentUser: CurrentUserPayload) {
    const projectTypes = await this.prisma.typeProjet.findMany({
      where: { companyId: currentUser.companyId, actif: true },
      orderBy: { nom: 'asc' },
      include: typeProjetInclude,
    });

    return projectTypes.map((projectType) =>
      this.serializeTypeProjet(projectType),
    );
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    const typeProjet = await this.prisma.typeProjet.findUnique({
      where: { id },
      include: typeProjetInclude,
    });
    if (!typeProjet || typeProjet.companyId !== currentUser.companyId) {
      throw new NotFoundException(`Type de projet #${id} non trouve`);
    }
    return this.serializeTypeProjet(typeProjet);
  }

  async update(
    id: number,
    dto: UpdateTypeProjetDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.findOne(id, currentUser);

    const categorieIds =
      dto.categorieIds !== undefined
        ? await this.validateCategorieIds(
            dto.categorieIds,
            currentUser.companyId,
          )
        : undefined;

    const typeProjet = await this.prisma.typeProjet.update({
      where: { id },
      data: {
        nom: dto.nom,
        description: dto.description,
        categories:
          categorieIds !== undefined
            ? {
                deleteMany: {},
                create: categorieIds.map((categorieId, index) => ({
                  categorieId,
                  ordre: index,
                })),
              }
            : undefined,
      },
      include: typeProjetInclude,
    });

    return this.serializeTypeProjet(typeProjet);
  }

  async remove(id: number, currentUser: CurrentUserPayload) {
    await this.findOne(id, currentUser);

    const clientsDetaches = await this.prisma.client.updateMany({
      where: { companyId: currentUser.companyId, typeProjetId: id },
      data: { typeProjetId: null },
    });
    const deletedTypeProjet = await this.prisma.typeProjet.delete({
      where: { id },
    });

    return {
      message: 'Type de projet supprime definitivement.',
      typeProjetId: deletedTypeProjet.id,
      clientsDetaches: clientsDetaches.count,
    };
  }
}
