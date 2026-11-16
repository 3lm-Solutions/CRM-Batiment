import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type ChantierStatut,
  type CommandeFournisseurStatut,
} from '../../generated/prisma/client.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryCommandeFournisseurDto } from './dto/query-commande-fournisseur.dto.js';
import { UpdateCommandeFournisseurStatutDto } from './dto/update-commande-fournisseur-statut.dto.js';

const supplierIdentitySelect = {
  id: true,
  companyId: true,
  nom: true,
  contact: true,
  email: true,
  telephone: true,
  adresse: true,
  typesMateriaux: true,
  delaiLivraison: true,
  conditions: true,
  actif: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FournisseurSelect;

const supplierOrderInclude = {
  fournisseur: {
    select: supplierIdentitySelect,
  },
  lignes: {
    orderBy: { id: 'asc' },
  },
  receptions: {
    orderBy: { dateReception: 'desc' },
  },
  devis: {
    select: {
      id: true,
      reference: true,
      statut: true,
      client: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
        },
      },
      chantier: {
        select: {
          id: true,
          reference: true,
          adresse: true,
          statut: true,
        },
      },
    },
  },
} satisfies Prisma.CommandeFournisseurInclude;

type SupplierIdentity = Prisma.FournisseurGetPayload<{
  select: typeof supplierIdentitySelect;
}>;

type SupplierOrderRecord = Prisma.CommandeFournisseurGetPayload<{
  include: typeof supplierOrderInclude;
}>;

@Injectable()
export class PortailFournisseurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private async findLinkedSupplierOrFail(currentUser: CurrentUserPayload) {
    if (currentUser.role !== 'SOUS_TRAITANT') {
      throw new ForbiddenException('Acces reserve aux comptes fournisseur.');
    }

    let fournisseur = await this.prisma.fournisseur.findFirst({
      where: {
        companyId: currentUser.companyId,
        actif: true,
        email: currentUser.email,
      },
      select: supplierIdentitySelect,
    });

    if (!fournisseur) {
      const fournisseurs = await this.prisma.fournisseur.findMany({
        where: {
          companyId: currentUser.companyId,
          actif: true,
          email: { not: null },
        },
        select: supplierIdentitySelect,
      });

      fournisseur =
        fournisseurs.find(
          (candidate) =>
            candidate.email?.trim().toLowerCase() ===
            currentUser.email.trim().toLowerCase(),
        ) ?? null;
    }

    if (!fournisseur) {
      throw new NotFoundException(
        "Aucun fournisseur actif n'est lie a cet email. Associez le compte SOUS_TRAITANT a l'email du fournisseur.",
      );
    }

    return fournisseur;
  }

  private buildTracking(order: SupplierOrderRecord) {
    const totalQuantiteCommandee = this.round2(
      order.lignes.reduce((sum, line) => sum + line.quantite, 0),
    );
    const totalQuantiteRecue = this.round2(
      order.receptions.reduce(
        (sum, reception) => sum + reception.quantiteRecue,
        0,
      ),
    );
    const receptionPercent =
      totalQuantiteCommandee > 0
        ? Math.min(
            100,
            this.round2((totalQuantiteRecue / totalQuantiteCommandee) * 100),
          )
        : 0;

    const disponibilite =
      order.statutLivraison === 'CREEE'
        ? {
            state: 'A_CONFIRMER',
            label: 'Disponibilite a confirmer',
            detail: 'La commande attend encore la confirmation du fournisseur.',
          }
        : order.statutLivraison === 'PARTIELLE'
          ? {
              state: 'PARTIELLE',
              label: 'Disponibilite partielle',
              detail: 'Une partie des materiaux est deja disponible.',
            }
          : ['RECUE', 'CLOTUREE'].includes(order.statutLivraison)
            ? {
                state: 'COMPLETE',
                label: 'Disponibilite complete',
                detail:
                  'Les materiaux de la commande sont considers disponibles.',
              }
            : {
                state: 'CONFIRMEE',
                label: 'Disponibilite confirmee',
                detail: 'Le fournisseur a bien pris en charge cette commande.',
              };

    const livraison =
      order.statutLivraison === 'EXPEDIEE'
        ? {
            state: 'EN_COURS',
            label: 'Livraison en cours',
            detail: order.dateLivraisonPrevue
              ? `Livraison prevue le ${order.dateLivraisonPrevue.toLocaleDateString('fr-FR')}.`
              : 'Le transport est en cours.',
          }
        : order.statutLivraison === 'PARTIELLE'
          ? {
              state: 'PARTIELLE',
              label: 'Livraison partielle',
              detail: 'Une partie des materiaux a deja ete livree.',
            }
          : ['RECUE', 'CLOTUREE'].includes(order.statutLivraison)
            ? {
                state: 'TERMINEE',
                label: 'Livraison terminee',
                detail: 'La livraison a ete finalisee sur ce bon d achat.',
              }
            : order.dateLivraisonPrevue
              ? {
                  state: 'PLANIFIEE',
                  label: 'Livraison planifiee',
                  detail: `Date annoncee: ${order.dateLivraisonPrevue.toLocaleDateString('fr-FR')}.`,
                }
              : {
                  state: 'NON_PLANIFIEE',
                  label: 'Livraison non planifiee',
                  detail:
                    'Aucune date de livraison n a encore ete communiquee.',
                };

    const reception =
      totalQuantiteRecue <= 0
        ? {
            state: 'EN_ATTENTE',
            label: 'Reception en attente',
            detail: 'Aucune reception n a encore ete enregistree.',
          }
        : totalQuantiteRecue < totalQuantiteCommandee
          ? {
              state: 'PARTIELLE',
              label: 'Reception partielle',
              detail: `${totalQuantiteRecue} / ${totalQuantiteCommandee} unites recues.`,
            }
          : {
              state: 'COMPLETE',
              label: 'Reception complete',
              detail: `${totalQuantiteRecue} / ${totalQuantiteCommandee} unites recues.`,
            };

    return {
      disponibilite,
      livraison,
      reception,
      metrics: {
        lignesCount: order.lignes.length,
        totalMontantHT: this.round2(
          order.lignes.reduce((sum, line) => sum + line.totalHT, 0),
        ),
        totalQuantiteCommandee,
        totalQuantiteRecue,
        receptionPercent,
      },
    };
  }

  private mapOrder(order: SupplierOrderRecord) {
    const tracking = this.buildTracking(order);

    return {
      id: order.id,
      devisId: order.devisId,
      fournisseurId: order.fournisseurId,
      reference: order.reference,
      date: order.date,
      statutLivraison: order.statutLivraison,
      dateEnvoi: order.dateEnvoi,
      dateLivraisonPrevue: order.dateLivraisonPrevue,
      notes: order.notes,
      pdfUrl: order.pdfUrl,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      fournisseur: order.fournisseur,
      devis: order.devis,
      lignes: order.lignes,
      receptions: order.receptions,
      tracking: {
        disponibilite: tracking.disponibilite,
        livraison: tracking.livraison,
        reception: tracking.reception,
      },
      metrics: tracking.metrics,
    };
  }

  private async syncChantierStatusForDevis(devisId: number) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      select: {
        chantierId: true,
        chantier: {
          select: {
            id: true,
            statut: true,
          },
        },
      },
    });

    if (!devis?.chantierId || !devis.chantier) return;

    const updatableStatuses: ChantierStatut[] = [
      'DEVIS_VALIDE',
      'COMMANDES_GENEREES',
      'MATERIAUX_EN_LIVRAISON',
      'MATERIAUX_RECEPTIONNES',
    ];

    if (!updatableStatuses.includes(devis.chantier.statut)) {
      return;
    }

    const orders = await this.prisma.commandeFournisseur.findMany({
      where: { devisId },
      select: { statutLivraison: true },
    });

    if (orders.length === 0) return;

    let nextStatus: ChantierStatut = 'COMMANDES_GENEREES';

    if (
      orders.every((order) =>
        ['RECUE', 'CLOTUREE'].includes(order.statutLivraison),
      )
    ) {
      nextStatus = 'MATERIAUX_RECEPTIONNES';
    } else if (
      orders.some((order) =>
        ['EXPEDIEE', 'PARTIELLE', 'RECUE', 'CLOTUREE'].includes(
          order.statutLivraison,
        ),
      )
    ) {
      nextStatus = 'MATERIAUX_EN_LIVRAISON';
    }

    if (devis.chantier.statut !== nextStatus) {
      await this.prisma.chantier.update({
        where: { id: devis.chantierId },
        data: { statut: nextStatus },
      });
    }
  }

  async getMe(currentUser: CurrentUserPayload) {
    const fournisseur = await this.findLinkedSupplierOrFail(currentUser);

    return {
      fournisseur,
      liaison: {
        linkedBy: 'email',
        userEmail: currentUser.email,
      },
    };
  }

  async getDashboard(currentUser: CurrentUserPayload) {
    const fournisseur = await this.findLinkedSupplierOrFail(currentUser);
    const orders = await this.prisma.commandeFournisseur.findMany({
      where: { fournisseurId: fournisseur.id },
      include: supplierOrderInclude,
      orderBy: { createdAt: 'desc' },
    });

    const mappedOrders = orders.map((order) => this.mapOrder(order));

    return {
      fournisseur,
      summary: {
        totalCommandes: mappedOrders.length,
        aConfirmer: mappedOrders.filter(
          (order) => order.tracking.disponibilite.state === 'A_CONFIRMER',
        ).length,
        enCoursLivraison: mappedOrders.filter((order) =>
          ['PLANIFIEE', 'EN_COURS', 'PARTIELLE'].includes(
            order.tracking.livraison.state,
          ),
        ).length,
        receptionsPartielles: mappedOrders.filter(
          (order) => order.tracking.reception.state === 'PARTIELLE',
        ).length,
        receptionsCompletes: mappedOrders.filter((order) =>
          ['COMPLETE'].includes(order.tracking.reception.state),
        ).length,
        montantTotalHT: this.round2(
          mappedOrders.reduce(
            (sum, order) => sum + order.metrics.totalMontantHT,
            0,
          ),
        ),
      },
      recentOrders: mappedOrders.slice(0, 5),
    };
  }

  async findOrders(
    currentUser: CurrentUserPayload,
    query: QueryCommandeFournisseurDto,
  ) {
    const fournisseur = await this.findLinkedSupplierOrFail(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.CommandeFournisseurWhereInput = {
      fournisseurId: fournisseur.id,
    };

    if (query.statutLivraison) {
      where.statutLivraison = query.statutLivraison;
    }

    if (search) {
      where.OR = [
        {
          reference: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          devis: {
            is: {
              OR: [
                {
                  reference: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  client: {
                    is: {
                      nom: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
                {
                  client: {
                    is: {
                      prenom: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
                {
                  chantier: {
                    is: {
                      reference: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
                {
                  chantier: {
                    is: {
                      adresse: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.commandeFournisseur.findMany({
        where,
        include: supplierOrderInclude,
        orderBy: [{ dateLivraisonPrevue: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.commandeFournisseur.count({ where }),
    ]);

    return {
      data: orders.map((order) => this.mapOrder(order)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    const fournisseur = await this.findLinkedSupplierOrFail(currentUser);
    const order = await this.prisma.commandeFournisseur.findFirst({
      where: {
        id,
        fournisseurId: fournisseur.id,
      },
      include: supplierOrderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Commande fournisseur #${id} introuvable.`);
    }

    return this.mapOrder(order);
  }

  async updateStatus(
    id: number,
    dto: UpdateCommandeFournisseurStatutDto,
    currentUser: CurrentUserPayload,
  ) {
    const fournisseur = await this.findLinkedSupplierOrFail(currentUser);
    const existing = await this.prisma.commandeFournisseur.findFirst({
      where: {
        id,
        fournisseurId: fournisseur.id,
      },
      include: supplierOrderInclude,
    });

    if (!existing) {
      throw new NotFoundException(`Commande fournisseur #${id} introuvable.`);
    }

    const data: Prisma.CommandeFournisseurUpdateInput = {
      statutLivraison: dto.statutLivraison,
    };

    if (dto.notes !== undefined) {
      const cleanedNotes = dto.notes.trim();
      data.notes = cleanedNotes.length > 0 ? cleanedNotes : null;
    }

    if (dto.dateLivraisonPrevue !== undefined) {
      data.dateLivraisonPrevue = dto.dateLivraisonPrevue
        ? new Date(dto.dateLivraisonPrevue)
        : null;
    } else if (
      !existing.dateLivraisonPrevue &&
      dto.statutLivraison === 'ENVOYEE' &&
      fournisseur.delaiLivraison &&
      fournisseur.delaiLivraison > 0
    ) {
      data.dateLivraisonPrevue = this.addDays(
        new Date(),
        fournisseur.delaiLivraison,
      );
    }

    const updated = await this.prisma.commandeFournisseur.update({
      where: { id: existing.id },
      data,
      include: supplierOrderInclude,
    });

    await this.syncChantierStatusForDevis(updated.devisId);

    await this.notificationsService.createInternalNotification({
      companyId: fournisseur.companyId,
      userId: currentUser.userId,
      entite: 'CommandeFournisseur',
      entiteId: updated.id,
      action: 'NOTIFICATION_SUPPLIER_STATUS_UPDATED',
      category: 'SUPPLIER_STATUS',
      level: updated.statutLivraison === 'EXPEDIEE' ? 'warning' : 'info',
      title: 'Mise a jour fournisseur',
      message: `${fournisseur.nom} a mis a jour ${updated.reference} en ${updated.statutLivraison}.`,
      ancienneValeur: {
        statutLivraison: existing.statutLivraison,
        dateLivraisonPrevue: existing.dateLivraisonPrevue?.toISOString(),
      },
      metadata: {
        commandeReference: updated.reference,
        fournisseurNom: fournisseur.nom,
        statutLivraison: updated.statutLivraison,
        devisReference: updated.devis.reference,
        chantierReference: updated.devis.chantier?.reference ?? null,
        dateLivraisonPrevue: updated.dateLivraisonPrevue?.toISOString() ?? null,
      },
    });

    return this.mapOrder(updated);
  }
}
