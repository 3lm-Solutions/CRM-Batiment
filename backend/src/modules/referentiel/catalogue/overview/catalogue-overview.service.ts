import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../../common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { validateCatalogue } from './catalogue-validation';

@Injectable()
export class CatalogueOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active catalogue as a tree, for the quote builder (checklist). Sale prices only —
   * costs and compositions come from GET /catalogue/prestations/:id or the chiffrage endpoint.
   */
  tree(user: AuthUser) {
    const prestationSelect = {
      where: { actif: true },
      orderBy: { nom: 'asc' as const },
      select: {
        id: true,
        nom: true,
        description: true,
        unite: true,
        prixVenteMin: true,
        prixVenteMax: true,
        options: {
          orderBy: { ordre: 'asc' as const },
          select: {
            id: true,
            nom: true,
            obligatoire: true,
            choix: {
              where: { actif: true },
              orderBy: { ordre: 'asc' as const },
              select: { id: true, nom: true, impactPrix: true },
            },
          },
        },
      },
    };

    return this.prisma.categoriePrestation.findMany({
      where: { companyId: user.companyId, actif: true },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        description: true,
        sousCategories: {
          where: { actif: true },
          orderBy: { nom: 'asc' },
          select: { id: true, nom: true, description: true, prestations: prestationSelect },
        },
        // prestations attached directly to the category (no sub-category)
        prestations: { ...prestationSelect, where: { actif: true, sousCategorieId: null } },
      },
    });
  }

  async validation(user: AuthUser) {
    const [activeCategories, prestations] = await Promise.all([
      this.prisma.categoriePrestation.count({ where: { companyId: user.companyId, actif: true } }),
      this.prisma.prestation.findMany({
        where: { companyId: user.companyId, actif: true },
        select: {
          id: true,
          nom: true,
          prixVenteMin: true,
          prixVenteMax: true,
          compositions: { select: { materiauId: true, serviceMainOeuvreId: true, quantiteParUnite: true } },
          options: {
            select: {
              id: true,
              nom: true,
              obligatoire: true,
              choix: { where: { actif: true }, select: { id: true, _count: { select: { compositions: true } } } },
            },
          },
        },
      }),
    ]);

    return {
      validatedAt: new Date().toISOString(),
      ...validateCatalogue(
        activeCategories,
        prestations.map((p) => ({
          ...p,
          prixVenteMin: p.prixVenteMin.toNumber(),
          prixVenteMax: p.prixVenteMax.toNumber(),
          compositions: p.compositions.map((c) => ({ ...c, quantiteParUnite: c.quantiteParUnite.toNumber() })),
          options: p.options.map((o) => ({
            ...o,
            choix: o.choix.map((c) => ({ id: c.id, aComposition: c._count.compositions > 0 })),
          })),
        })),
      ),
    };
  }
}
