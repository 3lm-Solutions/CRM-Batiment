import { Injectable } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, toDecimal, toSkipTake } from '../../../common';
import { Prisma, TypeMouvementStock } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { CreateMouvementDto, QueryMouvementsDto, QueryStockDto } from './stock.dto';

export interface MoveInput {
  companyId: number;
  userId: number | null;
  materiauId: number;
  type: TypeMouvementStock;
  /** ENTREE/SORTIE: quantity moved (> 0). AJUSTEMENT: the counted stock (absolute). */
  quantite: Prisma.Decimal | number;
  motif?: string;
  reference?: string;
  chantierId?: number | null;
}

/**
 * Stock levels and movements.
 *
 * v2: the old code read the stock OUTSIDE the transaction and then wrote an absolute value —
 * two simultaneous movements lost one of them. Here ENTREE/SORTIE are atomic SQL increments,
 * a SORTIE is refused if stock is insufficient, and an inventory adjustment locks the row.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** The one way to change a stock level. Pass the caller's transaction (e.g. a reception). */
  async move(db: DbClient, input: MoveInput) {
    const q = toDecimal(input.quantite);
    const where = { id: input.materiauId, companyId: input.companyId };

    let stockApres: Prisma.Decimal;
    let delta: Prisma.Decimal;

    if (input.type === 'AJUSTEMENT') {
      const rows = await db.$queryRaw<{ stockActuel: Prisma.Decimal }[]>`
        SELECT "stockActuel" FROM "materiaux" WHERE "id" = ${input.materiauId} AND "companyId" = ${input.companyId} FOR UPDATE`;
      if (!rows.length)
        throw new BusinessException(
          'MATERIAU_INTROUVABLE',
          `Matériau #${input.materiauId} introuvable.`,
        );
      delta = q.minus(rows[0].stockActuel);
      stockApres = q;
      await db.materiau.update({ where, data: { stockActuel: q } });
    } else {
      if (q.lte(0))
        throw new BusinessException('QUANTITE_INVALIDE', 'La quantité doit être supérieure à 0.');
      delta = input.type === 'ENTREE' ? q : q.negated();

      const { count } = await db.materiau.updateMany({
        where: input.type === 'SORTIE' ? { ...where, stockActuel: { gte: q } } : where,
        data: { stockActuel: { increment: delta } },
      });
      if (!count) {
        const exists = await db.materiau.count({ where });
        throw exists
          ? new BusinessException('STOCK_INSUFFISANT', 'Stock insuffisant pour cette sortie.')
          : new BusinessException(
              'MATERIAU_INTROUVABLE',
              `Matériau #${input.materiauId} introuvable.`,
            );
      }
      stockApres = (
        await db.materiau.findUniqueOrThrow({
          where: { id: input.materiauId },
          select: { stockActuel: true },
        })
      ).stockActuel;
    }

    return db.mouvementStock.create({
      data: {
        companyId: input.companyId,
        materiauId: input.materiauId,
        userId: input.userId,
        type: input.type,
        quantite: delta,
        stockAvant: stockApres.minus(delta),
        stockApres,
        motif: input.motif,
        reference: input.reference,
        chantierId: input.chantierId ?? null,
      },
    });
  }

  async createMovement(user: AuthUser, dto: CreateMouvementDto) {
    if (dto.chantierId) {
      const ok = await this.prisma.chantier.count({
        where: { id: dto.chantierId, companyId: user.companyId },
      });
      if (!ok)
        throw new BusinessException(
          'CHANTIER_INTROUVABLE',
          `Chantier #${dto.chantierId} introuvable.`,
        );
    }
    return this.prisma.$transaction((tx) =>
      this.move(tx, { ...dto, companyId: user.companyId, userId: user.id }),
    );
  }

  /** Stock per active material; `alerte=true` keeps those at or below their minimum. */
  async list(user: AuthUser, query: QueryStockDto) {
    const where: Prisma.MateriauWhereInput = {
      companyId: user.companyId,
      actif: true,
      ...(query.alerte && { stockActuel: { lte: this.prisma.materiau.fields.stockMinimum } }),
      ...(query.search && { nom: { contains: query.search, mode: 'insensitive' } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.materiau.findMany({
        where,
        orderBy: { nom: 'asc' },
        select: {
          id: true,
          nom: true,
          unite: true,
          prixAchatFixe: true,
          stockActuel: true,
          stockMinimum: true,
          fournisseur: { select: { id: true, nom: true } },
        },
        ...toSkipTake(query),
      }),
      this.prisma.materiau.count({ where }),
    ]);
    const data = rows.map((m) => ({
      ...m,
      alerte: m.stockActuel.lte(m.stockMinimum),
      valeurStock: m.stockActuel.times(m.prixAchatFixe).toDecimalPlaces(2),
    }));
    return paginate(data, total, query);
  }

  async listMovements(user: AuthUser, query: QueryMouvementsDto) {
    const where: Prisma.MouvementStockWhereInput = {
      companyId: user.companyId,
      materiauId: query.materiauId,
      chantierId: query.chantierId,
      type: query.type,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.mouvementStock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          materiau: { select: { id: true, nom: true, unite: true } },
          user: { select: { id: true, nom: true, prenom: true } },
          chantier: { select: { id: true, reference: true } },
        },
        ...toSkipTake(query),
      }),
      this.prisma.mouvementStock.count({ where }),
    ]);
    return paginate(data, total, query);
  }
}
