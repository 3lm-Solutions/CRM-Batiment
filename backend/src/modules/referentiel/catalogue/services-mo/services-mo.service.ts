import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, paginate, parseSort, toSkipTake } from '../../../../common';
import type { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CATALOGUE_PRICE_CHANGED, type CataloguePriceChangedEvent } from '../catalogue.events';
import { CreateServiceMoDto, QueryServicesMoDto, UpdateServiceMoDto } from './services-mo.dto';

const SORTABLE = ['nom', 'prixUnitaire', 'createdAt'] as const;

@Injectable()
export class ServicesMoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(user: AuthUser, query: QueryServicesMoDto) {
    const where: Prisma.ServiceMainOeuvreWhereInput = {
      companyId: user.companyId,
      actif: query.actif,
      unite: query.unite,
      ...(query.search && { nom: { contains: query.search, mode: 'insensitive' } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceMainOeuvre.findMany({
        where,
        orderBy: parseSort(query.sort, SORTABLE, { nom: 'asc' }),
        ...toSkipTake(query),
      }),
      this.prisma.serviceMainOeuvre.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.serviceMainOeuvre.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!row) throw new NotFoundException(`Service de main d'œuvre #${id} introuvable`);
    return row;
  }

  create(user: AuthUser, dto: CreateServiceMoDto) {
    return this.prisma.serviceMainOeuvre.create({ data: { ...dto, companyId: user.companyId } });
  }

  async update(user: AuthUser, id: number, dto: UpdateServiceMoDto) {
    const before = await this.findOne(user, id);
    const updated = await this.prisma.serviceMainOeuvre.update({ where: { id }, data: dto });

    if (dto.prixUnitaire !== undefined && !before.prixUnitaire.equals(dto.prixUnitaire)) {
      this.events.emit(CATALOGUE_PRICE_CHANGED, {
        companyId: user.companyId,
        userId: user.id,
        entite: 'ServiceMainOeuvre',
        entiteId: id,
        libelle: updated.nom,
        champ: 'prixUnitaire',
        ancienneValeur: before.prixUnitaire.toNumber(),
        nouvelleValeur: updated.prixUnitaire.toNumber(),
      } satisfies CataloguePriceChangedEvent);
    }
    return updated;
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    await this.findOne(user, id);
    await this.prisma.serviceMainOeuvre.delete({ where: { id } });
  }
}
