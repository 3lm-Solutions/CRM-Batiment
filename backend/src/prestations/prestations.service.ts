import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateCategoriePrestationDto } from './dto/create-categorie-prestation.dto.js';
import { UpdateCategoriePrestationDto } from './dto/update-categorie-prestation.dto.js';
import { CreateSousCategorieDto } from './dto/create-sous-categorie.dto.js';
import { UpdateSousCategorieDto } from './dto/update-sous-categorie.dto.js';
import { CreatePrestationDto } from './dto/create-prestation.dto.js';
import { UpdatePrestationDto } from './dto/update-prestation.dto.js';
import { QueryPrestationDto } from './dto/query-prestation.dto.js';
import {
  CreateOptionPrestationDto,
  CreateChoixOptionDto,
} from './dto/create-option-prestation.dto.js';
import { UpdateOptionPrestationDto } from './dto/update-option-prestation.dto.js';
import { UpdateChoixOptionDto } from './dto/update-choix-option.dto.js';
import {
  CreatePrestationCompositionDto,
  UpdatePrestationCompositionDto,
} from './dto/manage-prestation-composition.dto.js';
import { UpdateChiffrageSettingsDto } from './dto/update-chiffrage-settings.dto.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';

type ChiffrageSettings = {
  tvaDefaut: number;
  devise: string;
  margeCiblePourcent: number;
  fraisFixeDeplacement: number;
  pasArrondiPrix: number;
};

type CatalogueIssue = {
  type: string;
  message: string;
  prestationId?: number;
  optionId?: number;
};

const CHIFFRAGE_SETTINGS_ENTITY = 'ChiffrageSettings';
const CATALOGUE_PUBLICATION_ENTITY = 'CataloguePublication';

const DEFAULT_CHIFFRAGE_SETTINGS = {
  margeCiblePourcent: 30,
  fraisFixeDeplacement: 0,
  pasArrondiPrix: 0.01,
} as const;

@Injectable()
export class PrestationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async assertMateriauAccess(
    materiauId: number,
    currentUser: CurrentUserPayload,
  ) {
    const materiau = await this.prisma.materiau.findUnique({
      where: { id: materiauId },
      select: { id: true, companyId: true },
    });

    if (!materiau) {
      throw new NotFoundException(`Matériau #${materiauId} non trouvé`);
    }
    if (materiau.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé au matériau');
    }
  }

  private async assertServiceMoAccess(
    serviceMainOeuvreId: number,
    currentUser: CurrentUserPayload,
  ) {
    const service = await this.prisma.serviceMainOeuvre.findUnique({
      where: { id: serviceMainOeuvreId },
      select: { id: true, companyId: true },
    });

    if (!service) {
      throw new NotFoundException(
        `Service main d'oeuvre #${serviceMainOeuvreId} non trouvé`,
      );
    }
    if (service.companyId !== currentUser.companyId) {
      throw new ForbiddenException(
        "Accès non autorisé au service main d'oeuvre",
      );
    }
  }

  private normalizeStoredChiffrageSettings(
    value: unknown,
  ): Partial<ChiffrageSettings> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const payload = value as Record<string, unknown>;
    const out: Partial<ChiffrageSettings> = {};

    if (typeof payload.tvaDefaut === 'number')
      out.tvaDefaut = payload.tvaDefaut;
    if (typeof payload.devise === 'string') out.devise = payload.devise;
    if (typeof payload.margeCiblePourcent === 'number') {
      out.margeCiblePourcent = payload.margeCiblePourcent;
    }
    if (typeof payload.fraisFixeDeplacement === 'number') {
      out.fraisFixeDeplacement = payload.fraisFixeDeplacement;
    }
    if (typeof payload.pasArrondiPrix === 'number')
      out.pasArrondiPrix = payload.pasArrondiPrix;

    return out;
  }

  private async resolveCurrentChiffrageSettings(companyId: number) {
    const [company, latestSettingsLog] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, tvaDefaut: true, devise: true },
      }),
      this.prisma.auditLog.findFirst({
        where: { companyId, entite: CHIFFRAGE_SETTINGS_ENTITY },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!company) {
      throw new NotFoundException(`Entreprise #${companyId} non trouvée`);
    }

    const stored = this.normalizeStoredChiffrageSettings(
      latestSettingsLog?.nouvelleValeur,
    );

    const settings: ChiffrageSettings = {
      tvaDefaut: stored.tvaDefaut ?? company.tvaDefaut,
      devise: stored.devise ?? company.devise,
      margeCiblePourcent:
        stored.margeCiblePourcent ??
        DEFAULT_CHIFFRAGE_SETTINGS.margeCiblePourcent,
      fraisFixeDeplacement:
        stored.fraisFixeDeplacement ??
        DEFAULT_CHIFFRAGE_SETTINGS.fraisFixeDeplacement,
      pasArrondiPrix:
        stored.pasArrondiPrix ?? DEFAULT_CHIFFRAGE_SETTINGS.pasArrondiPrix,
    };

    return {
      settings,
      latestUpdatedAt: latestSettingsLog?.createdAt ?? null,
    };
  }

  // ═══════════════════════════════════════════════
  // CATÉGORIES DE PRESTATIONS
  // ═══════════════════════════════════════════════

  /**
   * Créer une catégorie de prestation
   */
  async createCategorie(
    dto: CreateCategoriePrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    // Vérifier l'unicité du nom dans la même company
    const existing = await this.prisma.categoriePrestation.findUnique({
      where: {
        companyId_nom: {
          companyId: currentUser.companyId,
          nom: dto.nom,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`La catégorie "${dto.nom}" existe déjà`);
    }

    return this.prisma.categoriePrestation.create({
      data: {
        ...dto,
        companyId: currentUser.companyId,
      },
    });
  }

  /**
   * Liste de toutes les catégories (actives) de l'entreprise
   */
  async findAllCategories(currentUser: CurrentUserPayload) {
    return this.prisma.categoriePrestation.findMany({
      where: {
        companyId: currentUser.companyId,
        actif: true,
      },
      orderBy: { nom: 'asc' },
      include: {
        _count: {
          select: { prestations: true, sousCategories: true },
        },
        sousCategories: {
          where: { actif: true },
          orderBy: { nom: 'asc' },
        },
      },
    });
  }

  /**
   * Modifier une catégorie
   */
  async updateCategorie(
    id: number,
    dto: UpdateCategoriePrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id },
    });

    if (!categorie) {
      throw new NotFoundException(`Catégorie #${id} non trouvée`);
    }

    if (categorie.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette catégorie');
    }

    // Si on change le nom, vérifier l'unicité
    if (dto.nom && dto.nom !== categorie.nom) {
      const existing = await this.prisma.categoriePrestation.findUnique({
        where: {
          companyId_nom: {
            companyId: currentUser.companyId,
            nom: dto.nom,
          },
        },
      });

      if (existing) {
        throw new ConflictException(`La catégorie "${dto.nom}" existe déjà`);
      }
    }

    return this.prisma.categoriePrestation.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Supprimer une catégorie (soft delete → actif = false)
   */
  async deleteCategorie(id: number, currentUser: CurrentUserPayload) {
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id },
      include: {
        _count: { select: { prestations: true } },
      },
    });

    if (!categorie) {
      throw new NotFoundException(`Catégorie #${id} non trouvée`);
    }

    if (categorie.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette catégorie');
    }

    await this.prisma.$transaction(async (tx) => {
      // Désactiver d'abord les prestations liées à la catégorie
      await tx.prestation.updateMany({
        where: { categorieId: id },
        data: { actif: false },
      });

      // Désactiver les sous-catégories de la catégorie
      await tx.sousCategorie.updateMany({
        where: { categorieId: id },
        data: { actif: false },
      });

      // Désactiver la catégorie elle-même
      await tx.categoriePrestation.update({
        where: { id },
        data: { actif: false },
      });
    });

    return { message: 'Catégorie et éléments associés désactivés' };
  }

  // ═══════════════════════════════════════════════
  // SOUS-CATÉGORIES
  // ═══════════════════════════════════════════════

  async createSousCategorie(
    dto: CreateSousCategorieDto,
    currentUser: CurrentUserPayload,
  ) {
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id: dto.categorieId },
    });

    if (!categorie) {
      throw new NotFoundException(`Catégorie #${dto.categorieId} non trouvée`);
    }
    if (categorie.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette catégorie');
    }

    const existing = await this.prisma.sousCategorie.findUnique({
      where: {
        categorieId_nom: {
          categorieId: dto.categorieId,
          nom: dto.nom,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `La sous-catégorie "${dto.nom}" existe déjà dans cette catégorie`,
      );
    }

    return this.prisma.sousCategorie.create({
      data: {
        companyId: currentUser.companyId,
        categorieId: dto.categorieId,
        nom: dto.nom,
        description: dto.description,
      },
    });
  }

  async findAllSousCategories(
    categorieId: number,
    currentUser: CurrentUserPayload,
  ) {
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id: categorieId },
    });
    if (!categorie) {
      throw new NotFoundException(`Catégorie #${categorieId} non trouvée`);
    }
    if (categorie.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.sousCategorie.findMany({
      where: { categorieId, actif: true },
      orderBy: { nom: 'asc' },
      include: {
        _count: { select: { prestations: true } },
      },
    });
  }

  async updateSousCategorie(
    id: number,
    dto: UpdateSousCategorieDto,
    currentUser: CurrentUserPayload,
  ) {
    const sc = await this.prisma.sousCategorie.findUnique({ where: { id } });
    if (!sc) {
      throw new NotFoundException(`Sous-catégorie #${id} non trouvée`);
    }
    if (sc.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.sousCategorie.update({
      where: { id },
      data: {
        nom: dto.nom,
        description: dto.description,
      },
    });
  }

  async deleteSousCategorie(id: number, currentUser: CurrentUserPayload) {
    const sc = await this.prisma.sousCategorie.findUnique({ where: { id } });
    if (!sc) {
      throw new NotFoundException(`Sous-catégorie #${id} non trouvée`);
    }
    if (sc.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.sousCategorie.update({
      where: { id },
      data: { actif: false },
    });
  }

  // ═══════════════════════════════════════════════
  // PRESTATIONS
  // ═══════════════════════════════════════════════

  /**
   * Créer une prestation
   */
  async createPrestation(
    dto: CreatePrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    // Vérifier que la catégorie existe et appartient à la même company
    const categorie = await this.prisma.categoriePrestation.findUnique({
      where: { id: dto.categorieId },
    });

    if (!categorie) {
      throw new NotFoundException(`Catégorie #${dto.categorieId} non trouvée`);
    }

    if (categorie.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette catégorie');
    }

    return this.prisma.prestation.create({
      data: {
        ...dto,
        companyId: currentUser.companyId,
      },
      include: {
        categorie: true,
      },
    });
  }

  /**
   * Liste paginée des prestations avec filtres
   */
  async findAllPrestations(
    query: QueryPrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    const { page = 1, limit = 20, search, categorieId, actif } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: currentUser.companyId,
    };

    // Filtre par recherche textuelle
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtre par catégorie
    if (categorieId) {
      where.categorieId = categorieId;
    }

    // Filtre actif/inactif
    if (actif !== undefined) {
      where.actif = actif;
    }

    const [data, total] = await Promise.all([
      this.prisma.prestation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
        include: {
          categorie: {
            select: { id: true, nom: true },
          },
          sousCategorie: {
            select: { id: true, nom: true },
          },
        },
      }),
      this.prisma.prestation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Détail d'une prestation avec ses compositions
   */
  async findOnePrestation(id: number, currentUser: CurrentUserPayload) {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id },
      include: {
        categorie: true,
        sousCategorie: true,
        compositions: {
          include: {
            materiau: {
              select: { id: true, nom: true, unite: true, prixAchatFixe: true },
            },
            serviceMainOeuvre: {
              select: {
                id: true,
                nom: true,
                unite: true,
                prixUnitaire: true,
                coutJournalier: true,
                productiviteJour: true,
              },
            },
          },
        },
        options: {
          orderBy: { ordre: 'asc' },
          include: {
            choix: {
              where: { actif: true },
              orderBy: { ordre: 'asc' },
            },
          },
        },
      },
    });

    if (!prestation) {
      throw new NotFoundException(`Prestation #${id} non trouvée`);
    }

    if (prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette prestation');
    }

    return prestation;
  }

  /**
   * Modifier une prestation
   */
  async updatePrestation(
    id: number,
    dto: UpdatePrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    // Vérifier existence + isolation SaaS
    const previous = await this.findOnePrestation(id, currentUser);

    // Si on change de catégorie, vérifier que la nouvelle appartient à la même company
    if (dto.categorieId) {
      const categorie = await this.prisma.categoriePrestation.findUnique({
        where: { id: dto.categorieId },
      });

      if (!categorie) {
        throw new NotFoundException(
          `Catégorie #${dto.categorieId} non trouvée`,
        );
      }

      if (categorie.companyId !== currentUser.companyId) {
        throw new ForbiddenException('Accès non autorisé à cette catégorie');
      }
    }

    const updated = await this.prisma.prestation.update({
      where: { id },
      data: dto,
      include: {
        categorie: true,
      },
    });

    const priceFields = [
      { field: 'prixVenteMin', oldValue: previous.prixVenteMin, newValue: updated.prixVenteMin },
      { field: 'prixVenteMax', oldValue: previous.prixVenteMax, newValue: updated.prixVenteMax },
    ];

    for (const item of priceFields) {
      if (item.oldValue !== item.newValue) {
        await this.auditService.logPriceChange({
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entite: 'Prestation',
          entiteId: updated.id,
          field: item.field,
          label: updated.nom,
          oldValue: item.oldValue,
          newValue: item.newValue,
          metadata: { unite: updated.unite },
        });
      }
    }

    return updated;
  }

  /**
   * Supprimer une prestation (hard delete + purge des relations)
   */
  async deletePrestation(id: number, currentUser: CurrentUserPayload) {
    await this.findOnePrestation(id, currentUser);

    const options = await this.prisma.optionPrestation.findMany({
      where: { prestationId: id },
      select: { id: true, choix: { select: { id: true } } },
    });

    const optionIds = options.map((option) => option.id);
    const choixIds = options.flatMap((option) =>
      option.choix.map((choix) => choix.id),
    );

    const deletedChoixCompositions = choixIds.length
      ? await this.prisma.choixOptionComposition.deleteMany({
          where: { choixOptionId: { in: choixIds } },
        })
      : { count: 0 };

    const detachedLignesDevis = await this.prisma.ligneDevis.updateMany({
      where: { prestationId: id },
      data: { prestationId: null },
    });

    const deletedPrestationCompositions =
      await this.prisma.prestationComposition.deleteMany({
        where: { prestationId: id },
      });

    const deletedOptions = optionIds.length
      ? await this.prisma.optionPrestation.deleteMany({
          where: { id: { in: optionIds } },
        })
      : { count: 0 };

    const deletedPrestation = await this.prisma.prestation.delete({
      where: { id },
    });

    return {
      message: 'Prestation supprimee definitivement avec ses relations.',
      prestationId: deletedPrestation.id,
      prestationCompositionsSupprimees: deletedPrestationCompositions.count,
      choixOptionCompositionsSupprimees: deletedChoixCompositions.count,
      optionsSupprimees: deletedOptions.count,
      lignesDevisDetachees: detachedLignesDevis.count,
    };
  }

  // ═══════════════════════════════════════════════
  // CHIFFRAGE AUTOMATIQUE
  // ═══════════════════════════════════════════════

  /**
   * Calcule le chiffrage automatique d'une prestation pour une quantité donnée.
   * Retourne le détail des coûts matériaux + MO + prix de vente suggéré.
   */
  async chiffrage(
    prestationId: number,
    quantite: number,
    currentUser: CurrentUserPayload,
  ) {
    const prestation = await this.findOnePrestation(prestationId, currentUser);

    let totalCoutMateriaux = 0;
    let totalCoutMo = 0;
    const detailMateriaux: {
      materiauId: number;
      nom: string;
      unite: string;
      quantiteNecessaire: number;
      prixUnitaire: number;
      coutTotal: number;
    }[] = [];
    const detailMo: {
      serviceMainOeuvreId: number;
      nom: string;
      unite: string;
      quantiteNecessaire: number;
      prixUnitaire: number;
      coutTotal: number;
    }[] = [];

    for (const comp of prestation.compositions ?? []) {
      const qte = quantite * comp.quantiteParUnite;

      if (comp.materiau) {
        const cout = qte * comp.materiau.prixAchatFixe;
        totalCoutMateriaux += cout;
        detailMateriaux.push({
          materiauId: comp.materiau.id,
          nom: comp.materiau.nom,
          unite: comp.materiau.unite,
          quantiteNecessaire: Math.round(qte * 100) / 100,
          prixUnitaire: comp.materiau.prixAchatFixe,
          coutTotal: Math.round(cout * 100) / 100,
        });
      }

      if (comp.serviceMainOeuvre) {
        const cout = qte * comp.serviceMainOeuvre.prixUnitaire;
        totalCoutMo += cout;
        detailMo.push({
          serviceMainOeuvreId: comp.serviceMainOeuvre.id,
          nom: comp.serviceMainOeuvre.nom,
          unite: comp.serviceMainOeuvre.unite,
          quantiteNecessaire: Math.round(qte * 100) / 100,
          prixUnitaire: comp.serviceMainOeuvre.prixUnitaire,
          coutTotal: Math.round(cout * 100) / 100,
        });
      }
    }

    const coutTotalParUnite =
      (totalCoutMateriaux + totalCoutMo) / (quantite || 1);
    const coutTotal = totalCoutMateriaux + totalCoutMo;
    const prixVenteSuggere =
      (prestation.prixVenteMin + prestation.prixVenteMax) / 2;
    const totalVenteHT = prixVenteSuggere * quantite;
    const profit = totalVenteHT - coutTotal;
    const margePourcent = totalVenteHT > 0 ? (profit / totalVenteHT) * 100 : 0;

    return {
      prestation: {
        id: prestation.id,
        nom: prestation.nom,
        unite: prestation.unite,
        prixVenteMin: prestation.prixVenteMin,
        prixVenteMax: prestation.prixVenteMax,
      },
      quantite,
      detailMateriaux,
      detailMo,
      totaux: {
        coutMateriaux: Math.round(totalCoutMateriaux * 100) / 100,
        coutMainOeuvre: Math.round(totalCoutMo * 100) / 100,
        coutTotal: Math.round(coutTotal * 100) / 100,
        coutParUnite: Math.round(coutTotalParUnite * 100) / 100,
        prixVenteSuggereUnite: prixVenteSuggere,
        totalVenteHT: Math.round(totalVenteHT * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margePourcent: Math.round(margePourcent * 100) / 100,
      },
    };
  }

  /**
   * Liste toutes les prestations AVEC compositions pour l'affichage checklist.
   * Regroupe par catégorie.
   */
  async findAllWithCompositions(currentUser: CurrentUserPayload) {
    const categories = await this.prisma.categoriePrestation.findMany({
      where: { companyId: currentUser.companyId, actif: true },
      orderBy: { nom: 'asc' },
      include: {
        sousCategories: {
          where: { actif: true },
          orderBy: { nom: 'asc' },
          include: {
            prestations: {
              where: { actif: true },
              orderBy: { nom: 'asc' },
              include: {
                compositions: {
                  include: {
                    materiau: {
                      select: {
                        id: true,
                        nom: true,
                        unite: true,
                        prixAchatFixe: true,
                      },
                    },
                    serviceMainOeuvre: {
                      select: {
                        id: true,
                        nom: true,
                        unite: true,
                        prixUnitaire: true,
                      },
                    },
                  },
                },
                options: {
                  orderBy: { ordre: 'asc' },
                  include: {
                    choix: {
                      where: { actif: true },
                      orderBy: { ordre: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        prestations: {
          where: { actif: true, sousCategorieId: null },
          orderBy: { nom: 'asc' },
          include: {
            compositions: {
              include: {
                materiau: {
                  select: {
                    id: true,
                    nom: true,
                    unite: true,
                    prixAchatFixe: true,
                  },
                },
                serviceMainOeuvre: {
                  select: {
                    id: true,
                    nom: true,
                    unite: true,
                    prixUnitaire: true,
                  },
                },
              },
            },
            options: {
              orderBy: { ordre: 'asc' },
              include: {
                choix: { where: { actif: true }, orderBy: { ordre: 'asc' } },
              },
            },
          },
        },
      },
    });

    return categories;
  }

  /**
   * Catalogue complet enrichi : catégories → sous-catégories → prestations
   * + questions diagnostiques + infos requises par prestation
   * Utilisé par le technicien et le futur chatbot.
   */
  async findCatalogueComplet(currentUser: CurrentUserPayload) {
    const categories = await this.prisma.categoriePrestation.findMany({
      where: { companyId: currentUser.companyId, actif: true },
      orderBy: { nom: 'asc' },
      include: {
        sousCategories: {
          where: { actif: true },
          orderBy: { nom: 'asc' },
          include: {
            prestations: {
              where: { actif: true },
              orderBy: { nom: 'asc' },
              include: {
                compositions: {
                  include: {
                    materiau: {
                      select: {
                        id: true,
                        nom: true,
                        unite: true,
                        prixAchatFixe: true,
                      },
                    },
                    serviceMainOeuvre: {
                      select: {
                        id: true,
                        nom: true,
                        unite: true,
                        prixUnitaire: true,
                      },
                    },
                  },
                },
                options: {
                  orderBy: { ordre: 'asc' },
                  include: {
                    choix: {
                      where: { actif: true },
                      orderBy: { ordre: 'asc' },
                      include: {
                        compositions: {
                          include: {
                            materiau: {
                              select: {
                                id: true,
                                nom: true,
                                unite: true,
                                prixAchatFixe: true,
                              },
                            },
                            serviceMainOeuvre: {
                              select: {
                                id: true,
                                nom: true,
                                unite: true,
                                prixUnitaire: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        prestations: {
          where: { actif: true, sousCategorieId: null },
          orderBy: { nom: 'asc' },
          include: {
            compositions: {
              include: {
                materiau: {
                  select: {
                    id: true,
                    nom: true,
                    unite: true,
                    prixAchatFixe: true,
                  },
                },
                serviceMainOeuvre: {
                  select: {
                    id: true,
                    nom: true,
                    unite: true,
                    prixUnitaire: true,
                  },
                },
              },
            },
            options: {
              orderBy: { ordre: 'asc' },
              include: {
                choix: {
                  where: { actif: true },
                  orderBy: { ordre: 'asc' },
                  include: {
                    compositions: {
                      include: {
                        materiau: {
                          select: {
                            id: true,
                            nom: true,
                            unite: true,
                            prixAchatFixe: true,
                          },
                        },
                        serviceMainOeuvre: {
                          select: {
                            id: true,
                            nom: true,
                            unite: true,
                            prixUnitaire: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return categories;
  }

  /**
   * Récupérer les compositions spécifiques associées à un choix d'option
   */
  async getChoixCompositions(choixId: number, currentUser: CurrentUserPayload) {
    const choix = await this.prisma.choixOption.findUnique({
      where: { id: choixId },
      include: {
        option: {
          include: {
            prestation: true,
          },
        },
        compositions: {
          include: {
            materiau: {
              select: { id: true, nom: true, unite: true, prixAchatFixe: true },
            },
            serviceMainOeuvre: {
              select: { id: true, nom: true, unite: true, prixUnitaire: true },
            },
          },
        },
      },
    });

    if (!choix) {
      throw new NotFoundException(`Choix #${choixId} non trouvé`);
    }

    // Vérifier que l'utilisateur a accès à cette prestation
    if (choix.option.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    // Retourner les compositions du choix
    return choix.compositions;
  }

  // ═══════════════════════════════════════════════
  // COMPOSITIONS DE PRESTATION
  // ═══════════════════════════════════════════════

  async createPrestationComposition(
    dto: CreatePrestationCompositionDto,
    currentUser: CurrentUserPayload,
  ) {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id: dto.prestationId },
      select: { id: true, companyId: true },
    });

    if (!prestation) {
      throw new NotFoundException(
        `Prestation #${dto.prestationId} non trouvée`,
      );
    }
    if (prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette prestation');
    }

    if (!dto.materiauId && !dto.serviceMainOeuvreId) {
      throw new ConflictException(
        "Une composition doit contenir au moins un matériau ou un service main d'oeuvre",
      );
    }

    if (dto.materiauId) {
      await this.assertMateriauAccess(dto.materiauId, currentUser);
    }
    if (dto.serviceMainOeuvreId) {
      await this.assertServiceMoAccess(dto.serviceMainOeuvreId, currentUser);
    }

    return this.prisma.prestationComposition.create({
      data: {
        prestationId: dto.prestationId,
        materiauId: dto.materiauId,
        serviceMainOeuvreId: dto.serviceMainOeuvreId,
        quantiteParUnite: dto.quantiteParUnite,
      },
      include: {
        materiau: {
          select: { id: true, nom: true, unite: true, prixAchatFixe: true },
        },
        serviceMainOeuvre: {
          select: { id: true, nom: true, unite: true, prixUnitaire: true },
        },
      },
    });
  }

  async updatePrestationComposition(
    id: number,
    dto: UpdatePrestationCompositionDto,
    currentUser: CurrentUserPayload,
  ) {
    const composition = await this.prisma.prestationComposition.findUnique({
      where: { id },
      include: { prestation: { select: { id: true, companyId: true } } },
    });

    if (!composition) {
      throw new NotFoundException(`Composition #${id} non trouvée`);
    }
    if (composition.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette composition');
    }

    const nextMateriauId =
      dto.materiauId !== undefined ? dto.materiauId : composition.materiauId;
    const nextServiceMoId =
      dto.serviceMainOeuvreId !== undefined
        ? dto.serviceMainOeuvreId
        : composition.serviceMainOeuvreId;

    if (!nextMateriauId && !nextServiceMoId) {
      throw new ConflictException(
        "Une composition doit contenir au moins un matériau ou un service main d'oeuvre",
      );
    }

    if (typeof nextMateriauId === 'number') {
      await this.assertMateriauAccess(nextMateriauId, currentUser);
    }
    if (typeof nextServiceMoId === 'number') {
      await this.assertServiceMoAccess(nextServiceMoId, currentUser);
    }

    return this.prisma.prestationComposition.update({
      where: { id },
      data: {
        materiauId: dto.materiauId !== undefined ? dto.materiauId : undefined,
        serviceMainOeuvreId:
          dto.serviceMainOeuvreId !== undefined
            ? dto.serviceMainOeuvreId
            : undefined,
        quantiteParUnite: dto.quantiteParUnite,
      },
      include: {
        materiau: {
          select: { id: true, nom: true, unite: true, prixAchatFixe: true },
        },
        serviceMainOeuvre: {
          select: { id: true, nom: true, unite: true, prixUnitaire: true },
        },
      },
    });
  }

  async deletePrestationComposition(
    id: number,
    currentUser: CurrentUserPayload,
  ) {
    const composition = await this.prisma.prestationComposition.findUnique({
      where: { id },
      include: { prestation: { select: { id: true, companyId: true } } },
    });

    if (!composition) {
      throw new NotFoundException(`Composition #${id} non trouvée`);
    }
    if (composition.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé à cette composition');
    }

    return this.prisma.prestationComposition.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════
  // OPTIONS DE PRESTATION
  // ═══════════════════════════════════════════════

  async createOptionPrestation(
    dto: CreateOptionPrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    const prestation = await this.findOnePrestation(
      dto.prestationId,
      currentUser,
    );

    const option = await this.prisma.optionPrestation.create({
      data: {
        prestationId: dto.prestationId,
        nom: dto.nom,
        description: dto.description,
        obligatoire: dto.obligatoire ?? false,
        ordre: dto.ordre ?? 0,
      },
    });

    if (dto.choix?.length) {
      for (const c of dto.choix) {
        await this.prisma.choixOption.create({
          data: {
            optionId: option.id,
            nom: c.nom,
            description: c.description,
            impactPrix: c.impactPrix ?? 0,
            ordre: c.ordre ?? 0,
          },
        });
      }
    }

    return this.prisma.optionPrestation.findUnique({
      where: { id: option.id },
      include: { choix: { orderBy: { ordre: 'asc' } } },
    });
  }

  async findOptionsByPrestation(
    prestationId: number,
    currentUser: CurrentUserPayload,
  ) {
    await this.findOnePrestation(prestationId, currentUser);

    return this.prisma.optionPrestation.findMany({
      where: { prestationId },
      orderBy: { ordre: 'asc' },
      include: {
        choix: {
          where: { actif: true },
          orderBy: { ordre: 'asc' },
        },
      },
    });
  }

  async updateOptionPrestation(
    id: number,
    dto: UpdateOptionPrestationDto,
    currentUser: CurrentUserPayload,
  ) {
    const option = await this.prisma.optionPrestation.findUnique({
      where: { id },
      include: { prestation: true },
    });
    if (!option) {
      throw new NotFoundException(`Option #${id} non trouvée`);
    }
    if (option.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.optionPrestation.update({
      where: { id },
      data: dto,
      include: { choix: { orderBy: { ordre: 'asc' } } },
    });
  }

  async deleteOptionPrestation(id: number, currentUser: CurrentUserPayload) {
    const option = await this.prisma.optionPrestation.findUnique({
      where: { id },
      include: { prestation: true },
    });
    if (!option) {
      throw new NotFoundException(`Option #${id} non trouvée`);
    }
    if (option.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.optionPrestation.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════
  // CHOIX D'OPTION
  // ═══════════════════════════════════════════════

  async addChoixToOption(
    optionId: number,
    dto: CreateChoixOptionDto,
    currentUser: CurrentUserPayload,
  ) {
    const option = await this.prisma.optionPrestation.findUnique({
      where: { id: optionId },
      include: { prestation: true },
    });
    if (!option) {
      throw new NotFoundException(`Option #${optionId} non trouvée`);
    }
    if (option.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.choixOption.create({
      data: {
        optionId,
        nom: dto.nom,
        description: dto.description,
        impactPrix: dto.impactPrix ?? 0,
        ordre: dto.ordre ?? 0,
      },
    });
  }

  async deleteChoixOption(id: number, currentUser: CurrentUserPayload) {
    const choix = await this.prisma.choixOption.findUnique({
      where: { id },
      include: { option: { include: { prestation: true } } },
    });
    if (!choix) {
      throw new NotFoundException(`Choix #${id} non trouvé`);
    }
    if (choix.option.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.choixOption.delete({ where: { id } });
  }

  async updateChoixOption(
    id: number,
    dto: UpdateChoixOptionDto,
    currentUser: CurrentUserPayload,
  ) {
    const choix = await this.prisma.choixOption.findUnique({
      where: { id },
      include: { option: { include: { prestation: true } } },
    });
    if (!choix) {
      throw new NotFoundException(`Choix #${id} non trouvé`);
    }
    if (choix.option.prestation.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return this.prisma.choixOption.update({
      where: { id },
      data: dto,
    });
  }

  // ═══════════════════════════════════════════════
  // PARAMÈTRES DE CHIFFRAGE + PUBLICATION CATALOGUE
  // ═══════════════════════════════════════════════

  async getChiffrageSettings(currentUser: CurrentUserPayload) {
    const { settings, latestUpdatedAt } =
      await this.resolveCurrentChiffrageSettings(currentUser.companyId);

    return {
      ...settings,
      updatedAt: latestUpdatedAt,
    };
  }

  async updateChiffrageSettings(
    dto: UpdateChiffrageSettingsDto,
    currentUser: CurrentUserPayload,
  ) {
    const { settings: currentSettings } =
      await this.resolveCurrentChiffrageSettings(currentUser.companyId);

    const nextSettings: ChiffrageSettings = {
      ...currentSettings,
      ...dto,
      tvaDefaut: dto.tvaDefaut ?? currentSettings.tvaDefaut,
      devise: dto.devise ?? currentSettings.devise,
      margeCiblePourcent:
        dto.margeCiblePourcent ?? currentSettings.margeCiblePourcent,
      fraisFixeDeplacement:
        dto.fraisFixeDeplacement ?? currentSettings.fraisFixeDeplacement,
      pasArrondiPrix: dto.pasArrondiPrix ?? currentSettings.pasArrondiPrix,
    };

    await this.prisma.company.update({
      where: { id: currentUser.companyId },
      data: {
        tvaDefaut: nextSettings.tvaDefaut,
        devise: nextSettings.devise,
      },
    });

    const log = await this.prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        action: 'CHIFFRAGE_SETTINGS_UPDATED',
        entite: CHIFFRAGE_SETTINGS_ENTITY,
        entiteId: currentUser.companyId,
        nouvelleValeur: nextSettings,
      },
    });

    return {
      ...nextSettings,
      updatedAt: log.createdAt,
    };
  }

  async validateCatalogue(currentUser: CurrentUserPayload) {
    const [activeCategoriesCount, prestations] = await Promise.all([
      this.prisma.categoriePrestation.count({
        where: { companyId: currentUser.companyId, actif: true },
      }),
      this.prisma.prestation.findMany({
        where: { companyId: currentUser.companyId, actif: true },
        include: {
          compositions: {
            select: {
              id: true,
              quantiteParUnite: true,
              materiauId: true,
              serviceMainOeuvreId: true,
            },
          },
          options: {
            select: {
              id: true,
              obligatoire: true,
              choix: {
                where: { actif: true },
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    const errors: CatalogueIssue[] = [];
    const warnings: CatalogueIssue[] = [];

    if (activeCategoriesCount === 0) {
      errors.push({
        type: 'CATEGORIES_EMPTY',
        message: "Aucune catégorie active n'est disponible dans le catalogue.",
      });
    }

    if (prestations.length === 0) {
      errors.push({
        type: 'PRESTATIONS_EMPTY',
        message: "Aucune prestation active n'est disponible dans le catalogue.",
      });
    }

    for (const prestation of prestations) {
      if (prestation.prixVenteMin < 0 || prestation.prixVenteMax < 0) {
        errors.push({
          type: 'NEGATIVE_PRICE',
          prestationId: prestation.id,
          message: `La prestation #${prestation.id} a un prix de vente négatif.`,
        });
      }

      if (prestation.prixVenteMin > prestation.prixVenteMax) {
        errors.push({
          type: 'PRICE_RANGE_INVALID',
          prestationId: prestation.id,
          message: `La prestation #${prestation.id} a un prix min supérieur au prix max.`,
        });
      }

      if ((prestation.compositions?.length ?? 0) === 0) {
        errors.push({
          type: 'NO_COMPOSITION',
          prestationId: prestation.id,
          message: `La prestation #${prestation.id} n\'a aucune composition.`,
        });
      }

      for (const composition of prestation.compositions ?? []) {
        if (!composition.materiauId && !composition.serviceMainOeuvreId) {
          errors.push({
            type: 'COMPOSITION_COMPONENT_MISSING',
            prestationId: prestation.id,
            message: `La prestation #${prestation.id} contient une composition sans matériau ni service.`,
          });
        }
        if (composition.quantiteParUnite <= 0) {
          errors.push({
            type: 'COMPOSITION_QUANTITY_INVALID',
            prestationId: prestation.id,
            message: `La prestation #${prestation.id} contient une composition avec quantité <= 0.`,
          });
        }
      }

      for (const option of prestation.options ?? []) {
        if (option.obligatoire && (option.choix?.length ?? 0) === 0) {
          errors.push({
            type: 'REQUIRED_OPTION_WITHOUT_CHOICES',
            prestationId: prestation.id,
            optionId: option.id,
            message: `L'option obligatoire #${option.id} de la prestation #${prestation.id} n'a aucun choix actif.`,
          });
        }
        if (!option.obligatoire && (option.choix?.length ?? 0) === 0) {
          warnings.push({
            type: 'OPTIONAL_OPTION_WITHOUT_CHOICES',
            prestationId: prestation.id,
            optionId: option.id,
            message: `L'option facultative #${option.id} de la prestation #${prestation.id} n'a aucun choix actif.`,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      validatedAt: new Date().toISOString(),
      stats: {
        activeCategories: activeCategoriesCount,
        activePrestations: prestations.length,
        errors: errors.length,
        warnings: warnings.length,
      },
      errors,
      warnings,
    };
  }

  async getCataloguePublicationStatus(currentUser: CurrentUserPayload) {
    const [lastPublication, currentSettings] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: {
          companyId: currentUser.companyId,
          entite: CATALOGUE_PUBLICATION_ENTITY,
          action: 'CATALOGUE_PUBLISHED',
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.resolveCurrentChiffrageSettings(currentUser.companyId),
    ]);

    return {
      lastPublication: lastPublication
        ? {
            publishedAt: lastPublication.createdAt,
            details: lastPublication.nouvelleValeur,
          }
        : null,
      chiffrageSettings: {
        ...currentSettings.settings,
        updatedAt: currentSettings.latestUpdatedAt,
      },
    };
  }

  async getCataloguePublicationHistory(currentUser: CurrentUserPayload) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        companyId: currentUser.companyId,
        entite: CATALOGUE_PUBLICATION_ENTITY,
        action: 'CATALOGUE_PUBLISHED',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        nouvelleValeur: true,
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    });

    return logs.map((log) => {
      const details =
        log.nouvelleValeur &&
        typeof log.nouvelleValeur === 'object' &&
        !Array.isArray(log.nouvelleValeur)
          ? (log.nouvelleValeur as Record<string, unknown>)
          : null;

      const validationStats =
        details &&
        typeof details.validationStats === 'object' &&
        details.validationStats !== null
          ? (details.validationStats as Record<string, unknown>)
          : null;

      return {
        id: log.id,
        publishedAt: log.createdAt,
        publishedBy: log.user
          ? {
              id: log.user.id,
              fullName: `${log.user.prenom} ${log.user.nom}`.trim(),
              email: log.user.email,
            }
          : null,
        validationStats: validationStats
          ? {
              activeCategories:
                typeof validationStats.activeCategories === 'number'
                  ? validationStats.activeCategories
                  : null,
              activePrestations:
                typeof validationStats.activePrestations === 'number'
                  ? validationStats.activePrestations
                  : null,
              errors:
                typeof validationStats.errors === 'number'
                  ? validationStats.errors
                  : null,
              warnings:
                typeof validationStats.warnings === 'number'
                  ? validationStats.warnings
                  : null,
            }
          : null,
      };
    });
  }

  async publishCatalogue(currentUser: CurrentUserPayload) {
    const validation = await this.validateCatalogue(currentUser);

    if (!validation.isValid) {
      throw new ConflictException({
        message:
          'Publication refusée: le catalogue doit être valide avant publication.',
        validation,
      });
    }

    const publicationLog = await this.prisma.auditLog.create({
      data: {
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        action: 'CATALOGUE_PUBLISHED',
        entite: CATALOGUE_PUBLICATION_ENTITY,
        entiteId: currentUser.companyId,
        nouvelleValeur: {
          publishedAt: new Date().toISOString(),
          validationStats: validation.stats,
        },
      },
    });

    return {
      message: 'Catalogue publié avec succès.',
      publishedAt: publicationLog.createdAt,
      validation,
    };
  }
}
