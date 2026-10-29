import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../../../common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { CompositionItemDto } from './compositions.dto';

/** Shared by prestation and choice compositions. */
@Injectable()
export class CompositionValidator {
  constructor(private readonly prisma: PrismaService) {}

  /** Each line has exactly one component, and every component belongs to the company and is active. */
  async assertValid(companyId: number, items: CompositionItemDto[]): Promise<void> {
    items.forEach((item, index) => {
      if (Boolean(item.materiauId) === Boolean(item.serviceMainOeuvreId)) {
        throw new BusinessException(
          'COMPOSITION_INVALIDE',
          `Ligne ${index + 1} : indiquez soit un matériau, soit un service de main d'œuvre (un seul des deux).`,
        );
      }
    });

    const materiauIds = unique(items.map((i) => i.materiauId));
    const serviceIds = unique(items.map((i) => i.serviceMainOeuvreId));

    const [materiaux, services] = await Promise.all([
      materiauIds.length
        ? this.prisma.materiau.count({ where: { id: { in: materiauIds }, companyId, actif: true } })
        : 0,
      serviceIds.length
        ? this.prisma.serviceMainOeuvre.count({
            where: { id: { in: serviceIds }, companyId, actif: true },
          })
        : 0,
    ]);

    if (materiaux !== materiauIds.length || services !== serviceIds.length) {
      throw new BusinessException(
        'COMPOSANT_INTROUVABLE',
        'Un ou plusieurs matériaux / services sont introuvables ou inactifs.',
      );
    }
  }

  toRows(items: CompositionItemDto[]) {
    return items.map((i) => ({
      materiauId: i.materiauId ?? null,
      serviceMainOeuvreId: i.serviceMainOeuvreId ?? null,
      quantiteParUnite: i.quantiteParUnite,
    }));
  }
}

const unique = (ids: (number | undefined)[]) => [
  ...new Set(ids.filter((id): id is number => !!id)),
];
