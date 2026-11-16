import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  Unite,
  type ChantierStatut,
} from '../../generated/prisma/client.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReceptionDto } from './dto/create-reception.dto.js';
import { QueryCommandesFournisseurDto } from './dto/query-commandes-fournisseur.dto.js';
import { UpdateCommandeFournisseurDto } from './dto/update-commande-fournisseur.dto.js';

const allowedRoles = [
  Role.ADMIN,
  Role.ASSISTANTE,
  Role.CHEF_CHANTIER,
  Role.TECHNICO,
] as const;

const fournisseurSelect = {
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

const commandeInclude = {
  fournisseur: {
    select: fournisseurSelect,
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
      companyId: true,
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

type CommandeRecord = Prisma.CommandeFournisseurGetPayload<{
  include: typeof commandeInclude;
}>;

@Injectable()
export class CommandesFournisseurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private ensureRole(currentUser: CurrentUserPayload) {
    if (
      !allowedRoles.includes(currentUser.role as (typeof allowedRoles)[number])
    ) {
      throw new ForbiddenException(
        'Acces non autorise aux commandes fournisseur.',
      );
    }
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private buildDeliveryDate(delaiLivraison?: number | null) {
    if (!delaiLivraison || delaiLivraison <= 0) {
      return null;
    }

    return new Date(Date.now() + delaiLivraison * 24 * 60 * 60 * 1000);
  }

  private buildTracking(order: CommandeRecord) {
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
              detail: 'Une partie des materiaux est deja disponible ou livree.',
            }
          : ['RECUE', 'CLOTUREE'].includes(order.statutLivraison)
            ? {
                state: 'COMPLETE',
                label: 'Disponibilite complete',
                detail:
                  'Les materiaux de cette commande sont consideres disponibles.',
              }
            : {
                state: 'CONFIRMEE',
                label: 'Disponibilite confirmee',
                detail:
                  'Le fournisseur a confirme la prise en charge de la commande.',
              };

    const livraison =
      order.statutLivraison === 'EXPEDIEE'
        ? {
            state: 'EN_COURS',
            label: 'Livraison en cours',
            detail: order.dateLivraisonPrevue
              ? `Livraison prevue le ${order.dateLivraisonPrevue.toLocaleDateString('fr-FR')}.`
              : 'Transport en cours.',
          }
        : order.statutLivraison === 'PARTIELLE'
          ? {
              state: 'PARTIELLE',
              label: 'Livraison partielle',
              detail: 'Une partie des materiaux a ete livree.',
            }
          : ['RECUE', 'CLOTUREE'].includes(order.statutLivraison)
            ? {
                state: 'TERMINEE',
                label: 'Livraison terminee',
                detail: 'La livraison est finalisee pour cette commande.',
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
            detail: 'Aucune reception chantier n a encore ete saisie.',
          }
        : totalQuantiteRecue < totalQuantiteCommandee
          ? {
              state: 'PARTIELLE',
              label: 'Reception partielle',
              detail: `${totalQuantiteRecue} / ${totalQuantiteCommandee} unites recues sur chantier.`,
            }
          : {
              state: 'COMPLETE',
              label: 'Reception complete',
              detail: `${totalQuantiteRecue} / ${totalQuantiteCommandee} unites recues sur chantier.`,
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

  private mapOrder(order: CommandeRecord) {
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
      devis: {
        id: order.devis.id,
        reference: order.devis.reference,
        statut: order.devis.statut,
        bonCommandeStatut: null,
        bonCommandeReference: null,
        client: order.devis.client,
        chantier: order.devis.chantier,
      },
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

  private async findCompanyOrderOrFail(id: number, companyId: number) {
    const order = await this.prisma.commandeFournisseur.findFirst({
      where: {
        id,
        devis: {
          is: {
            companyId,
          },
        },
      },
      include: commandeInclude,
    });

    if (!order) {
      throw new NotFoundException(`Commande fournisseur #${id} introuvable.`);
    }

    return order;
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

  async findAll(
    currentUser: CurrentUserPayload,
    query: QueryCommandesFournisseurDto,
  ) {
    this.ensureRole(currentUser);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.CommandeFournisseurWhereInput = {
      devis: {
        is: {
          companyId: currentUser.companyId,
        },
      },
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
          fournisseur: {
            is: {
              nom: {
                contains: search,
                mode: 'insensitive',
              },
            },
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

    let orders: CommandeRecord[] = [];
    let total = 0;
    try {
      [orders, total] = await Promise.all([
        this.prisma.commandeFournisseur.findMany({
          where,
          include: commandeInclude,
          orderBy: [{ dateLivraisonPrevue: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.commandeFournisseur.count({ where }),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        throw new BadRequestException(
          'Base de donnees incomplete pour les commandes fournisseur. Lancez les migrations Prisma.',
        );
      }
      throw error;
    }

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
    this.ensureRole(currentUser);
    let order: CommandeRecord;
    try {
      order = await this.findCompanyOrderOrFail(id, currentUser.companyId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        throw new BadRequestException(
          'Base de donnees incomplete pour les commandes fournisseur. Lancez les migrations Prisma.',
        );
      }
      throw error;
    }
    return this.mapOrder(order);
  }

  async update(
    id: number,
    dto: UpdateCommandeFournisseurDto,
    currentUser: CurrentUserPayload,
  ) {
    this.ensureRole(currentUser);

    const order = await this.findCompanyOrderOrFail(id, currentUser.companyId);

    if (order.statutLivraison !== 'CREEE' || order.dateEnvoi) {
      throw new BadRequestException(
        'Seules les commandes non envoyees peuvent etre modifiees manuellement.',
      );
    }

    const lignes = dto.lignes.map((line) => ({
      materiauNom: line.materiauNom.trim(),
      quantite: this.round2(line.quantite),
      unite: line.unite as Unite,
      prixUnitaire: this.round2(line.prixUnitaire),
      totalHT: this.round2(line.quantite * line.prixUnitaire),
    }));

    if (lignes.some((line) => !line.materiauNom)) {
      throw new BadRequestException(
        'Chaque ligne doit contenir un nom de materiau.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ligneCommandeFournisseur.deleteMany({
        where: { commandeFournisseurId: order.id },
      });

      await tx.commandeFournisseur.update({
        where: { id: order.id },
        data: {
          dateLivraisonPrevue:
            dto.dateLivraisonPrevue !== undefined
              ? new Date(dto.dateLivraisonPrevue)
              : undefined,
          notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
          lignes: {
            create: lignes,
          },
        },
      });
    });

    const updatedOrder = await this.findCompanyOrderOrFail(
      order.id,
      currentUser.companyId,
    );

    return {
      message: 'Commande fournisseur mise a jour.',
      order: this.mapOrder(updatedOrder),
    };
  }

  async send(id: number, currentUser: CurrentUserPayload) {
    this.ensureRole(currentUser);

    const order = await this.findCompanyOrderOrFail(id, currentUser.companyId);
    let bonCommande: { statut: string; reference: string } | null = null;
    try {
      bonCommande = await this.prisma.bonCommande.findUnique({
        where: { devisId: order.devisId },
        select: { statut: true, reference: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        throw new BadRequestException(
          'Base de donnees incomplete: table bon de commande manquante. Lancez les migrations Prisma.',
        );
      }
      throw error;
    }

    if (!bonCommande || bonCommande.statut === 'BROUILLON') {
      throw new BadRequestException(
        'Validez le bon de commande avant d envoyer la commande fournisseur.',
      );
    }

    if (order.dateEnvoi || order.statutLivraison !== 'CREEE') {
      throw new BadRequestException(
        'Cette commande fournisseur a deja ete envoyee ou n est plus modifiable.',
      );
    }

    if (!order.fournisseur.email) {
      throw new BadRequestException(
        'Le fournisseur doit avoir un email avant l envoi de la commande.',
      );
    }

    if (order.lignes.length === 0) {
      throw new BadRequestException(
        'Impossible d envoyer une commande fournisseur sans ligne.',
      );
    }

    await this.mailService.sendSupplierOrderEmail({
      to: order.fournisseur.email,
      supplierName: order.fournisseur.nom,
      reference: order.reference,
      companyName: 'CRM Batiment',
      devisReference: order.devis.reference,
      lines: order.lignes.map((line) => ({
        materiauNom: line.materiauNom,
        quantite: line.quantite,
        unite: line.unite,
        prixUnitaire: line.prixUnitaire,
        totalHT: line.totalHT,
      })),
    });

    await this.prisma.commandeFournisseur.update({
      where: { id: order.id },
      data: {
        statutLivraison: 'ENVOYEE',
        dateEnvoi: new Date(),
        dateLivraisonPrevue:
          order.dateLivraisonPrevue ??
          this.buildDeliveryDate(order.fournisseur.delaiLivraison) ??
          undefined,
      },
    });

    await this.prisma.bonCommande.updateMany({
      where: { devisId: order.devisId },
      data: { statut: 'ENVOYE' },
    });

    const updatedOrder = await this.findCompanyOrderOrFail(
      order.id,
      currentUser.companyId,
    );

    await this.notificationsService.createInternalNotification({
      companyId: updatedOrder.devis.companyId,
      userId: currentUser.userId,
      entite: 'CommandeFournisseur',
      entiteId: updatedOrder.id,
      action: 'NOTIFICATION_COMMANDE_FOURNISSEUR_ENVOYEE',
      category: 'SUPPLIER_STATUS',
      level: 'info',
      title: 'Commande fournisseur envoyee',
      message: `${updatedOrder.reference} a ete envoyee a ${updatedOrder.fournisseur.nom}.`,
      metadata: {
        commandeReference: updatedOrder.reference,
        devisReference: updatedOrder.devis.reference,
        fournisseurNom: updatedOrder.fournisseur.nom,
        fournisseurEmail: updatedOrder.fournisseur.email,
      },
    });

    return {
      message: `Commande fournisseur ${updatedOrder.reference} envoyee a ${updatedOrder.fournisseur.nom}.`,
      order: this.mapOrder(updatedOrder),
    };
  }

  async validateBeforeSend(id: number, currentUser: CurrentUserPayload) {
    this.ensureRole(currentUser);

    const order = await this.findCompanyOrderOrFail(id, currentUser.companyId);
    if (order.statutLivraison !== 'CREEE' || order.dateEnvoi) {
      throw new BadRequestException(
        'Seules les commandes non envoyees peuvent etre validees.',
      );
    }

    let bonCommande: { id: number; reference: string; statut: string } | null =
      null;
    try {
      bonCommande = await this.prisma.bonCommande.findUnique({
        where: { devisId: order.devisId },
        select: { id: true, reference: true, statut: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        throw new BadRequestException(
          'Base de donnees incomplete: table bon de commande manquante. Lancez les migrations Prisma.',
        );
      }
      throw error;
    }

    if (!bonCommande) {
      throw new NotFoundException(
        `Bon de commande introuvable pour le devis #${order.devisId}.`,
      );
    }

    if (bonCommande.statut === 'BROUILLON') {
      await this.prisma.bonCommande.update({
        where: { id: bonCommande.id },
        data: { statut: 'VALIDE' },
      });
    }

    const updatedOrder = await this.findCompanyOrderOrFail(
      order.id,
      currentUser.companyId,
    );

    return {
      message: `Commande ${updatedOrder.reference} validee avant envoi.`,
      order: this.mapOrder(updatedOrder),
    };
  }

  async createReception(
    id: number,
    dto: CreateReceptionDto,
    currentUser: CurrentUserPayload,
  ) {
    this.ensureRole(currentUser);

    const order = await this.findCompanyOrderOrFail(id, currentUser.companyId);
    const totalQuantiteCommandee = this.round2(
      order.lignes.reduce((sum, line) => sum + line.quantite, 0),
    );
    const totalQuantiteRecueAvant = this.round2(
      order.receptions.reduce(
        (sum, reception) => sum + reception.quantiteRecue,
        0,
      ),
    );
    const quantiteRestante = this.round2(
      totalQuantiteCommandee - totalQuantiteRecueAvant,
    );

    if (quantiteRestante <= 0) {
      throw new BadRequestException(
        'Cette commande est deja entierement receptionnee.',
      );
    }

    if (dto.quantiteRecue > quantiteRestante + 0.001) {
      throw new BadRequestException(
        `La quantite recue ne peut pas depasser le reste a receptionner (${quantiteRestante}).`,
      );
    }

    const totalApresReception = this.round2(
      totalQuantiteRecueAvant + dto.quantiteRecue,
    );
    const receptionPartielle =
      totalApresReception + 0.001 < totalQuantiteCommandee;
    const nextStatus = receptionPartielle ? 'PARTIELLE' : 'RECUE';

    await this.prisma.reception.create({
      data: {
        commandeFournisseurId: order.id,
        dateReception: dto.dateReception
          ? new Date(dto.dateReception)
          : undefined,
        quantiteRecue: this.round2(dto.quantiteRecue),
        quantiteAttendue: totalQuantiteCommandee,
        partielle: receptionPartielle,
        notes: dto.notes?.trim() || undefined,
      },
    });

    await this.prisma.commandeFournisseur.update({
      where: { id: order.id },
      data: {
        statutLivraison: nextStatus,
      },
    });

    await this.syncChantierStatusForDevis(order.devisId);

    const updatedOrder = await this.findCompanyOrderOrFail(
      order.id,
      currentUser.companyId,
    );
    const totalQuantiteRecueApres = this.round2(
      updatedOrder.receptions.reduce(
        (sum, reception) => sum + reception.quantiteRecue,
        0,
      ),
    );

    await this.notificationsService.createInternalNotification({
      companyId: updatedOrder.devis.companyId,
      userId: currentUser.userId,
      entite: 'CommandeFournisseur',
      entiteId: updatedOrder.id,
      action: receptionPartielle
        ? 'NOTIFICATION_RECEPTION_PARTIELLE'
        : 'NOTIFICATION_RECEPTION_COMPLETE',
      category: receptionPartielle
        ? 'RECEPTION_PARTIELLE'
        : 'RECEPTION_COMPLETE',
      level: receptionPartielle ? 'warning' : 'success',
      title: receptionPartielle
        ? 'Reception partielle chantier'
        : 'Reception complete chantier',
      message: `${updatedOrder.reference} a ete receptionnee a hauteur de ${dto.quantiteRecue}.`,
      ancienneValeur: {
        totalQuantiteRecueAvant,
      },
      metadata: {
        commandeReference: updatedOrder.reference,
        devisReference: updatedOrder.devis.reference,
        chantierReference: updatedOrder.devis.chantier?.reference ?? null,
        fournisseurNom: updatedOrder.fournisseur.nom,
        quantiteRecue: this.round2(dto.quantiteRecue),
        totalQuantiteCommandee,
        totalQuantiteRecueApres,
        receptionPartielle,
      },
    });

    return {
      message: receptionPartielle
        ? 'Reception partielle enregistree.'
        : 'Reception complete enregistree.',
      order: this.mapOrder(updatedOrder),
      summary: {
        totalQuantiteCommandee,
        totalQuantiteRecueAvant,
        totalQuantiteRecueApres,
      },
    };
  }
}
