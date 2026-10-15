import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, paginate, parseSort, toSkipTake } from '../../../../common';
import type { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CATALOGUE_PRICE_CHANGED, type CataloguePriceChangedEvent } from '../catalogue.events';
import { CompositionValidator } from '../compositions/composition-validator.service';
import type { ReplaceCompositionsDto } from '../compositions/compositions.dto';
import { CreatePrestationDto, QueryPrestationsDto, UpdatePrestationDto } from './prestations.dto';

const SORTABLE = ['nom', 'prixVenteMin', 'prixVenteMax', 'createdAt'] as const;

const COMPONENT_SELECT = {
  id: true,
  quantiteParUnite: true,
  materiau: { select: { id: true, nom: true, unite: true, prixAchatFixe: true, actif: true } },
  serviceMainOeuvre: { select: { id: true, nom: true, unite: true, prixUnitaire: true, actif: true } },
} as const;

const LIST_INCLUDE = {
  categorie: { select: { id: true, nom: true } },
  sousCategorie: { select: { id: true, nom: true } },
  _count: { select: { compositions: true, options: true } },
} satisfies Prisma.PrestationInclude;

export const PRESTATION_DETAIL_INCLUDE = {
  categorie: { select: { id: true, nom: true } },
  sousCategorie: { select: { id: true, nom: true } },
  compositions: { select: COMPONENT_SELECT, orderBy: { id: 'asc' } },
  options: {
    orderBy: { ordre: 'asc' },
    include: {
      choix: {
        orderBy: { ordre: 'asc' },
        include: { compositions: { select: COMPONENT_SELECT, orderBy: { id: 'asc' } } },
      },
    },
  },
} satisfies Prisma.PrestationInclude;

@Injectable()
export class PrestationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compositions: CompositionValidator,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(user: AuthUser, query: QueryPrestationsDto) {
    const where: Prisma.PrestationWhereInput = {
      companyId: user.companyId,
      actif: query.actif,
      categorieId: query.categorieId,
      sousCategorieId: query.sousCategorieId,
      ...(query.search && { nom: { contains: query.search, mode: 'insensitive' } }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.prestation.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: parseSort(query.sort, SORTABLE, { nom: 'asc' }),
        ...toSkipTake(query),
      }),
      this.prisma.prestation.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  /** Full detail: base composition, options, choices and their compositions. */
  async findOne(user: AuthUser, id: number) {
    const row = await this.prisma.prestation.findFirst({
      where: { id, companyId: user.companyId },
      include: PRESTATION_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Prestation #${id} introuvable`);
    return row;
  }

  async create(user: AuthUser, dto: CreatePrestationDto) {
    await this.assertClassification(user.companyId, dto.categorieId, dto.sousCategorieId);
    assertPriceRange(dto.prixVenteMin, dto.prixVenteMax);
    return this.prisma.prestation.create({ data: { ...dto, companyId: user.companyId }, include: LIST_INCLUDE });
  }

  async update(user: AuthUser, id: number, dto: UpdatePrestationDto) {
    const before = await this.findOne(user, id);

    const categorieId = dto.categorieId ?? before.categorieId;
    const sousCategorieId = dto.sousCategorieId !== undefined ? dto.sousCategorieId : before.sousCategorieId;
    if (dto.categorieId !== undefined || dto.sousCategorieId !== undefined) {
      await this.assertClassification(user.companyId, categorieId, sousCategorieId);
    }
    assertPriceRange(dto.prixVenteMin ?? before.prixVenteMin.toNumber(), dto.prixVenteMax ?? before.prixVenteMax.toNumber());

    const updated = await this.prisma.prestation.update({ where: { id }, data: dto, include: LIST_INCLUDE });

    for (const champ of ['prixVenteMin', 'prixVenteMax'] as const) {
      if (dto[champ] !== undefined && !before[champ].equals(dto[champ])) {
        this.events.emit(CATALOGUE_PRICE_CHANGED, {
          companyId: user.companyId,
          userId: user.id,
          entite: 'Prestation',
          entiteId: id,
          libelle: updated.nom,
          champ,
          ancienneValeur: before[champ].toNumber(),
          nouvelleValeur: updated[champ].toNumber(),
        } satisfies CataloguePriceChangedEvent);
      }
    }
    return updated;
  }

  /** 409 RESOURCE_IN_USE if used in a quote; options/choices/compositions cascade. */
  async remove(user: AuthUser, id: number): Promise<void> {
    await this.findOne(user, id);
    await this.prisma.prestation.delete({ where: { id } });
  }

  /** Replaces the whole base composition atomically. */
  async replaceCompositions(user: AuthUser, id: number, dto: ReplaceCompositionsDto) {
    await this.findOne(user, id);
    await this.compositions.assertValid(user.companyId, dto.items);
    await this.prisma.$transaction([
      this.prisma.prestationComposition.deleteMany({ where: { prestationId: id } }),
      this.prisma.prestationComposition.createMany({
        data: this.compositions.toRows(dto.items).map((row) => ({ ...row, prestationId: id })),
      }),
    ]);
    return this.findOne(user, id);
  }

  private async assertClassification(companyId: number, categorieId: number, sousCategorieId?: number | null) {
    const categorie = await this.prisma.categoriePrestation.count({ where: { id: categorieId, companyId } });
    if (!categorie) throw new BusinessException('CATEGORIE_INTROUVABLE', `Catégorie #${categorieId} introuvable.`);

    if (sousCategorieId) {
      const sousCategorie = await this.prisma.sousCategorie.count({
        where: { id: sousCategorieId, categorieId, companyId },
      });
      if (!sousCategorie) {
        throw new BusinessException(
          'SOUS_CATEGORIE_INVALIDE',
          'La sous-catégorie est introuvable ou n’appartient pas à la catégorie choisie.',
        );
      }
    }
  }
}

function assertPriceRange(min: number, max: number): void {
  if (min > max) {
    throw new BusinessException('FOURCHETTE_PRIX_INVALIDE', 'Le prix minimum ne peut pas dépasser le prix maximum.');
  }
}
