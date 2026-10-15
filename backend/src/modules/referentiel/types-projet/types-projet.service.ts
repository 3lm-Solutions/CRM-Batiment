import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException } from '../../../common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTypeProjetDto, QueryTypesProjetDto, UpdateTypeProjetDto } from './dto/types-projet.dto';

const INCLUDE = {
  categories: {
    orderBy: { ordre: 'asc' },
    select: { ordre: true, categorie: { select: { id: true, nom: true } } },
  },
  _count: { select: { clientLinks: true } },
} satisfies Prisma.TypeProjetInclude;

type TypeProjetRow = Prisma.TypeProjetGetPayload<{ include: typeof INCLUDE }>;

function toResponse({ categories, _count, ...rest }: TypeProjetRow) {
  return {
    ...rest,
    categories: categories.map((c) => c.categorie),
    categorieIds: categories.map((c) => c.categorie.id),
    nombreClients: _count.clientLinks,
  };
}

@Injectable()
export class TypesProjetService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: QueryTypesProjetDto) {
    const rows = await this.prisma.typeProjet.findMany({
      where: { companyId: user.companyId, actif: query.actif },
      include: INCLUDE,
      orderBy: { nom: 'asc' },
    });
    return rows.map(toResponse);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.typeProjet.findFirst({
      where: { id, companyId: user.companyId },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException(`Type de projet #${id} introuvable`);
    return toResponse(row);
  }

  async create(user: AuthUser, dto: CreateTypeProjetDto) {
    const { categorieIds, ...data } = dto;
    await this.assertCategories(user.companyId, categorieIds);
    // Same name in the same company -> P2002 -> 409
    const row = await this.prisma.typeProjet.create({
      data: { ...data, companyId: user.companyId, categories: { create: toLinks(categorieIds) } },
      include: INCLUDE,
    });
    return toResponse(row);
  }

  async update(user: AuthUser, id: number, dto: UpdateTypeProjetDto) {
    await this.findOne(user, id);
    const { categorieIds, ...data } = dto;
    await this.assertCategories(user.companyId, categorieIds);
    const row = await this.prisma.typeProjet.update({
      where: { id },
      data: {
        ...data,
        categories: categorieIds !== undefined ? { deleteMany: {}, create: toLinks(categorieIds) } : undefined,
      },
      include: INCLUDE,
    });
    return toResponse(row);
  }

  /** Hard delete; client links cascade. Prefer `actif: false` for types already in use. */
  async remove(user: AuthUser, id: number): Promise<void> {
    await this.findOne(user, id);
    await this.prisma.typeProjet.delete({ where: { id } });
  }

  private async assertCategories(companyId: number, ids: number[] | undefined): Promise<void> {
    if (!ids?.length) return;
    const found = await this.prisma.categoriePrestation.count({ where: { id: { in: ids }, companyId, actif: true } });
    if (found !== ids.length) {
      throw new BusinessException('CATEGORIE_INVALIDE', 'Une ou plusieurs catégories sont introuvables ou inactives.');
    }
  }
}

const toLinks = (ids: number[] = []) => ids.map((categorieId, ordre) => ({ categorieId, ordre }));
