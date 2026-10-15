import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../../common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateCategorieDto, CreateSousCategorieDto, QueryCategoriesDto, UpdateCategorieDto, UpdateSousCategorieDto } from './categories.dto';

/**
 * Categories and their sub-categories.
 * DELETE is a hard delete that PostgreSQL refuses (409) while prestations still use the
 * category; `actif: false` hides it everywhere instead.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthUser, query: QueryCategoriesDto) {
    return this.prisma.categoriePrestation.findMany({
      where: { companyId: user.companyId, actif: query.actif },
      orderBy: { nom: 'asc' },
      include: {
        sousCategories: {
          where: { actif: query.actif },
          orderBy: { nom: 'asc' },
          include: { _count: { select: { prestations: true } } },
        },
        _count: { select: { prestations: true } },
      },
    });
  }

  create(user: AuthUser, dto: CreateCategorieDto) {
    return this.prisma.categoriePrestation.create({ data: { ...dto, companyId: user.companyId } });
  }

  async update(user: AuthUser, id: number, dto: UpdateCategorieDto) {
    await this.findCategorie(user, id);
    return this.prisma.categoriePrestation.update({ where: { id }, data: dto });
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    await this.findCategorie(user, id);
    await this.prisma.categoriePrestation.delete({ where: { id } });
  }

  async createSousCategorie(user: AuthUser, categorieId: number, dto: CreateSousCategorieDto) {
    await this.findCategorie(user, categorieId);
    return this.prisma.sousCategorie.create({ data: { ...dto, categorieId, companyId: user.companyId } });
  }

  async updateSousCategorie(user: AuthUser, id: number, dto: UpdateSousCategorieDto) {
    await this.findSousCategorie(user, id);
    return this.prisma.sousCategorie.update({ where: { id }, data: dto });
  }

  /** Prestations of a deleted sub-category stay in their category (FK SetNull). */
  async removeSousCategorie(user: AuthUser, id: number): Promise<void> {
    await this.findSousCategorie(user, id);
    await this.prisma.sousCategorie.delete({ where: { id } });
  }

  private async findCategorie(user: AuthUser, id: number) {
    const row = await this.prisma.categoriePrestation.findFirst({ where: { id, companyId: user.companyId } });
    if (!row) throw new NotFoundException(`Catégorie #${id} introuvable`);
    return row;
  }

  private async findSousCategorie(user: AuthUser, id: number) {
    const row = await this.prisma.sousCategorie.findFirst({ where: { id, companyId: user.companyId } });
    if (!row) throw new NotFoundException(`Sous-catégorie #${id} introuvable`);
    return row;
  }
}
