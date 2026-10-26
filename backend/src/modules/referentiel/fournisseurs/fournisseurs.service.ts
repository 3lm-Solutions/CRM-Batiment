import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, parseSort, toSkipTake } from '../../../common';
import { Role, type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { CreateFournisseurDto, LierCompteFournisseurDto, QueryFournisseursDto, UpdateFournisseurDto } from './dto/fournisseurs.dto';

const SORTABLE = ['nom', 'delaiLivraison', 'createdAt'] as const;
const COUNTS = {
  _count: { select: { materiaux: true, commandesFournisseur: true } },
  // Portal account shown in the list (« compte : … » / « aucun compte »)
  utilisateur: { select: { id: true, email: true, prenom: true, nom: true } },
  // A few of its materials for the list (the full list: GET /catalogue/materiaux?fournisseurId=)
  materiaux: { where: { actif: true }, orderBy: { nom: 'asc' }, take: 3, select: { id: true, nom: true } },
} satisfies Prisma.FournisseurInclude;

@Injectable()
export class FournisseursService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: QueryFournisseursDto) {
    const where: Prisma.FournisseurWhereInput = {
      companyId: user.companyId,
      actif: query.actif,
      ...(query.search && {
        OR: [
          { nom: { contains: query.search, mode: 'insensitive' } },
          { contact: { contains: query.search, mode: 'insensitive' } },
          // « carrelage » finds the suppliers of a carrelage material
          { materiaux: { some: { nom: { contains: query.search, mode: 'insensitive' } } } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.fournisseur.findMany({
        where,
        include: COUNTS,
        orderBy: parseSort(query.sort, SORTABLE, { nom: 'asc' }),
        ...toSkipTake(query),
      }),
      this.prisma.fournisseur.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.fournisseur.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        ...COUNTS,
        materiaux: {
          where: { actif: true },
          orderBy: { nom: 'asc' },
          select: { id: true, nom: true, unite: true, prixAchatFixe: true },
        },
      },
    });
    if (!row) throw new NotFoundException(`Fournisseur #${id} introuvable`);
    return row;
  }

  /** Can be created straight from an existing FOURNISSEUR account (decision F1 of 20/10). */
  async create(user: AuthUser, dto: CreateFournisseurDto) {
    if (dto.userId) await this.assertCompteLibre(user, dto.userId);
    const { materiauIds, ...data } = dto;
    if (materiauIds) await this.assertMateriaux(user, materiauIds);
    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fournisseur.create({ data: { ...data, companyId: user.companyId }, select: { id: true } });
      if (materiauIds) await this.setMateriaux(tx, user.companyId, created.id, materiauIds);
      return created.id;
    });
    return this.prisma.fournisseur.findUniqueOrThrow({ where: { id }, include: COUNTS });
  }

  async update(user: AuthUser, id: number, dto: UpdateFournisseurDto) {
    await this.findOne(user, id);
    const { materiauIds, ...data } = dto;
    if (materiauIds) await this.assertMateriaux(user, materiauIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.fournisseur.update({ where: { id }, data });
      if (materiauIds) await this.setMateriaux(tx, user.companyId, id, materiauIds);
    });
    return this.prisma.fournisseur.findUniqueOrThrow({ where: { id }, include: COUNTS });
  }

  /** « Rattacher des matériaux » : the supplier's materials become exactly this list (21/10). */
  async remplacerMateriaux(user: AuthUser, id: number, materiauIds: number[]) {
    await this.findOne(user, id);
    await this.assertMateriaux(user, materiauIds);
    await this.prisma.$transaction((tx) => this.setMateriaux(tx, user.companyId, id, materiauIds));
    return this.findOne(user, id);
  }

  /**
   * One supplier per material (Materiau.fournisseurId): the listed ones move to this supplier
   * (even from another one), those no longer listed lose it. Their prices do not change.
   */
  private async setMateriaux(db: DbClient, companyId: number, fournisseurId: number, materiauIds: number[]) {
    const ids = [...new Set(materiauIds)];
    await db.materiau.updateMany({ where: { companyId, fournisseurId, id: { notIn: ids } }, data: { fournisseurId: null } });
    if (ids.length) await db.materiau.updateMany({ where: { companyId, id: { in: ids } }, data: { fournisseurId } });
  }

  private async assertMateriaux(user: AuthUser, materiauIds: number[]) {
    const ids = [...new Set(materiauIds)];
    if (!ids.length) return;
    const found = await this.prisma.materiau.count({ where: { companyId: user.companyId, id: { in: ids } } });
    if (found !== ids.length) throw new BusinessException('MATERIAU_INTROUVABLE', 'Un des matériaux choisis n’existe pas (ou plus).');
  }

  /** The portal account (role FOURNISSEUR) that sees this supplier's orders. */
  async lierCompte(user: AuthUser, id: number, dto: LierCompteFournisseurDto) {
    await this.findOne(user, id);
    if (dto.userId) await this.assertCompteLibre(user, dto.userId, id);
    return this.prisma.fournisseur.update({ where: { id }, data: { userId: dto.userId }, include: COUNTS });
  }

  /** A FOURNISSEUR account of the company, not yet linked to another supplier (clear message instead of a 409). */
  private async assertCompteLibre(user: AuthUser, userId: number, fournisseurId?: number) {
    const ok = await this.prisma.user.count({ where: { id: userId, companyId: user.companyId, role: Role.FOURNISSEUR } });
    if (!ok) throw new BusinessException('COMPTE_INVALIDE', 'Le compte doit avoir le rôle FOURNISSEUR.');
    const other = await this.prisma.fournisseur.findFirst({
      where: { userId, ...(fournisseurId ? { NOT: { id: fournisseurId } } : {}) },
      select: { nom: true },
    });
    if (other) throw new BusinessException('COMPTE_DEJA_LIE', `Ce compte est déjà lié au fournisseur « ${other.nom} ». Déliez-le d’abord.`);
  }

  /**
   * Refused if the supplier still supplies materials (they would silently lose their supplier,
   * and P0.4 supplier orders would skip them) or has orders (PostgreSQL -> 409). Deactivate instead.
   */
  async remove(user: AuthUser, id: number): Promise<void> {
    const fournisseur = await this.findOne(user, id);
    if (fournisseur._count.materiaux > 0) {
      throw new BusinessException(
        'FOURNISSEUR_UTILISE',
        `Ce fournisseur fournit ${fournisseur._count.materiaux} matériau(x) : réaffectez-les ou désactivez le fournisseur.`,
      );
    }
    await this.prisma.fournisseur.delete({ where: { id } });
  }
}
