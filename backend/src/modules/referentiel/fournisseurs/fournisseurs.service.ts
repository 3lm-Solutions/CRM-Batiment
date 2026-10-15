import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, parseSort, toSkipTake } from '../../../common';
import { Role, type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFournisseurDto, LierCompteFournisseurDto, QueryFournisseursDto, UpdateFournisseurDto } from './dto/fournisseurs.dto';

const SORTABLE = ['nom', 'delaiLivraison', 'createdAt'] as const;
const COUNTS = { _count: { select: { materiaux: true, commandesFournisseur: true } } } satisfies Prisma.FournisseurInclude;

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
          { typesMateriaux: { contains: query.search, mode: 'insensitive' } },
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

  create(user: AuthUser, dto: CreateFournisseurDto) {
    return this.prisma.fournisseur.create({ data: { ...dto, companyId: user.companyId }, include: COUNTS });
  }

  async update(user: AuthUser, id: number, dto: UpdateFournisseurDto) {
    await this.findOne(user, id);
    return this.prisma.fournisseur.update({ where: { id }, data: dto, include: COUNTS });
  }

  /** The portal account (role FOURNISSEUR) that sees this supplier's orders. */
  async lierCompte(user: AuthUser, id: number, dto: LierCompteFournisseurDto) {
    await this.findOne(user, id);
    if (dto.userId) {
      const ok = await this.prisma.user.count({ where: { id: dto.userId, companyId: user.companyId, role: Role.FOURNISSEUR } });
      if (!ok) throw new BusinessException('COMPTE_INVALIDE', 'Le compte doit avoir le rôle FOURNISSEUR.');
    }
    // Account already linked to another supplier -> P2002 -> 409
    return this.prisma.fournisseur.update({ where: { id }, data: { userId: dto.userId }, include: COUNTS });
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
