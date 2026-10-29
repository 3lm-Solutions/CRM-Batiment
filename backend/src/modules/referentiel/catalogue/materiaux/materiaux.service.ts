import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type AuthUser,
  BusinessException,
  paginate,
  parseSort,
  toSkipTake,
} from '../../../../common';
import type { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CATALOGUE_PRICE_CHANGED, type CataloguePriceChangedEvent } from '../catalogue.events';
import { CreateMateriauDto, QueryMateriauxDto, UpdateMateriauDto } from './materiaux.dto';

const SORTABLE = ['nom', 'prixAchatFixe', 'stockActuel', 'dateMaj'] as const;
const INCLUDE = {
  fournisseur: { select: { id: true, nom: true } },
} satisfies Prisma.MateriauInclude;

@Injectable()
export class MateriauxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(user: AuthUser, query: QueryMateriauxDto) {
    const where: Prisma.MateriauWhereInput = {
      companyId: user.companyId,
      actif: query.actif,
      fournisseurId: query.fournisseurId,
      unite: query.unite,
      ...(query.search && { nom: { contains: query.search, mode: 'insensitive' } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.materiau.findMany({
        where,
        include: INCLUDE,
        orderBy: parseSort(query.sort, SORTABLE, { nom: 'asc' }),
        ...toSkipTake(query),
      }),
      this.prisma.materiau.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.materiau.findFirst({
      where: { id, companyId: user.companyId },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException(`Matériau #${id} introuvable`);
    return row;
  }

  async create(user: AuthUser, dto: CreateMateriauDto) {
    await this.assertFournisseur(user, dto.fournisseurId);
    return this.prisma.materiau.create({
      data: { ...dto, companyId: user.companyId },
      include: INCLUDE,
    });
  }

  async update(user: AuthUser, id: number, dto: UpdateMateriauDto) {
    const before = await this.findOne(user, id);
    await this.assertFournisseur(user, dto.fournisseurId);

    const priceChanged =
      dto.prixAchatFixe !== undefined && !before.prixAchatFixe.equals(dto.prixAchatFixe);
    const updated = await this.prisma.materiau.update({
      where: { id },
      data: { ...dto, ...(priceChanged && { dateMaj: new Date() }) },
      include: INCLUDE,
    });

    if (priceChanged) {
      this.events.emit(CATALOGUE_PRICE_CHANGED, {
        companyId: user.companyId,
        userId: user.id,
        entite: 'Materiau',
        entiteId: id,
        libelle: updated.nom,
        champ: 'prixAchatFixe',
        ancienneValeur: before.prixAchatFixe.toNumber(),
        nouvelleValeur: updated.prixAchatFixe.toNumber(),
      } satisfies CataloguePriceChangedEvent);
    }
    return updated;
  }

  /** 409 RESOURCE_IN_USE if used in a quote or a composition — deactivate instead. */
  async remove(user: AuthUser, id: number): Promise<void> {
    await this.findOne(user, id);
    await this.prisma.materiau.delete({ where: { id } });
  }

  private async assertFournisseur(
    user: AuthUser,
    fournisseurId: number | null | undefined,
  ): Promise<void> {
    if (!fournisseurId) return;
    const found = await this.prisma.fournisseur.count({
      where: { id: fournisseurId, companyId: user.companyId },
    });
    if (!found)
      throw new BusinessException(
        'FOURNISSEUR_INTROUVABLE',
        `Fournisseur #${fournisseurId} introuvable.`,
      );
  }
}
