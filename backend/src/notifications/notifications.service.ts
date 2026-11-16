import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ChantierStatut,
  DemoRequestStatut,
  CommandeFournisseurStatut,
  FactureStatut,
  Prisma,
  Role,
  SavTicketPriorite,
  SavTicketStatut,
} from '../../generated/prisma/client.js';
import type { CurrentUserPayload } from '../common/interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsGateway, type RealtimeEventPayload } from './notifications.gateway.js';

type NotificationLevel = 'info' | 'success' | 'warning' | 'danger';
type NotificationCategory =
  | 'SUPPLIER_STATUS'
  | 'RECEPTION_PARTIELLE'
  | 'RECEPTION_COMPLETE' | 'ASSURANCE_EXPIRATION'
  | 'FACTURES_IMPAYEES'
  | 'CHANTIERS_RETARD'
  | 'COMMANDES_ATTENTE'
  | 'SIGNATURE_DEVIS'
  | 'MODIFICATION_PRIX'
  | 'SAV_TICKET'
  | 'SAV_URGENT'
  | 'SAV_NOTE'
  | 'DEMO_REQUEST'
  | 'DEMO_SCHEDULED'
  | 'CHANTIER_DOCUMENT'
  | 'STOCK_BAS'
  | 'AUDIT_RECENT';

interface CreateInternalNotificationPayload {
  companyId: number;
  userId?: number;
  entite: string;
  entiteId: number;
  action: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonObject;
  ancienneValeur?: Prisma.InputJsonObject;
}

interface InternalNotificationItem {
  id: number;
  action: string;
  createdAt: Date;
  entite: string;
  entiteId: number;
  title: string;
  message: string;
  category: NotificationCategory;
  level: NotificationLevel;
  metadata: Prisma.JsonObject;
  actor: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    role: Role;
  } | null;
}

const allowedInternalRoles = [
  Role.ADMIN,
  Role.ASSISTANTE,
  Role.CHEF_CHANTIER,
  Role.TECHNICO,
  Role.SOUS_TRAITANT,
] as const;

const legacyNotificationActions = [
  'NOTIFICATION_SUPPLIER_STATUS_UPDATED',
  'NOTIFICATION_RECEPTION_PARTIELLE',
  'NOTIFICATION_RECEPTION_COMPLETE',
  'NOTIFICATION_ASSISTANT_URGENT_DEVIS',
  'NOTIFICATION_SOUS_TRAITANT_DOCUMENT',
  'NOTIFICATION_CHANTIER_DOCUMENT_ADDED',
  'NOTIFICATION_STOCK_BAS',
];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  private ensureInternalUser(currentUser: CurrentUserPayload) {
    if (
      !allowedInternalRoles.includes(
        currentUser.role as (typeof allowedInternalRoles)[number],
      )
    ) {
      throw new ForbiddenException('Acces reserve aux notifications internes.');
    }
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private getStableAlertDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  }

  private canRoleSeeCategory(role: string, category: NotificationCategory) {
    if (role === Role.ADMIN) return true;

    if (role === Role.CHEF_CHANTIER) {
      return [
        'CHANTIERS_RETARD',
        'COMMANDES_ATTENTE',
        'SUPPLIER_STATUS',
        'RECEPTION_PARTIELLE',
        'RECEPTION_COMPLETE',
        'SAV_TICKET',
        'SAV_URGENT',
        'SAV_NOTE',
        'CHANTIER_DOCUMENT',
      ].includes(category);
    }

    if (role === Role.TECHNICO) {
      return category !== 'AUDIT_RECENT';
    }

    if (role === Role.ASSISTANTE) {
      return category !== 'MODIFICATION_PRIX' && category !== 'AUDIT_RECENT';
    }

    if (role === Role.SOUS_TRAITANT) {
      return category === 'CHANTIER_DOCUMENT';
    }

    return false;
  }

  async createInternalNotification(payload: CreateInternalNotificationPayload) {
    const notification = await this.prisma.auditLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        action: payload.action,
        entite: payload.entite,
        entiteId: payload.entiteId,
        ancienneValeur: payload.ancienneValeur,
        nouvelleValeur: {
          audience: 'INTERNAL',
          category: payload.category,
          level: payload.level,
          title: payload.title,
          message: payload.message,
          metadata: payload.metadata ?? {},
        } as Prisma.InputJsonObject,
      },
    });

    this.emitCompanyEvent(payload.companyId, 'notifications:changed', {
      reason: payload.action,
      entity: payload.entite,
      entityId: payload.entiteId,
      actorId: payload.userId ?? null,
    });

    return notification;
  }

  emitCompanyEvent(
    companyId: number,
    event: string,
    payload: RealtimeEventPayload,
  ) {
    this.gateway.emitToCompany(companyId, event, payload);
  }

  private buildLegacyLogNotification(log: {
    id: number;
    action: string;
    createdAt: Date;
    entite: string;
    entiteId: number;
    nouvelleValeur: Prisma.JsonValue | null;
    user: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
      role: Role;
    } | null;
  }): InternalNotificationItem {
    const payload =
      log.nouvelleValeur && typeof log.nouvelleValeur === 'object'
        ? (log.nouvelleValeur as Prisma.JsonObject)
        : {};

    const metadata =
      payload.metadata && typeof payload.metadata === 'object'
        ? (payload.metadata as Prisma.JsonObject)
        : {};

    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      entite: log.entite,
      entiteId: log.entiteId,
      title:
        typeof payload.title === 'string'
          ? payload.title
          : 'Notification interne',
      message:
        typeof payload.message === 'string'
          ? payload.message
          : 'Mise a jour interne',
      category:
        typeof payload.category === 'string'
          ? (payload.category as NotificationCategory)
          : 'AUDIT_RECENT',
      level:
        typeof payload.level === 'string'
          ? (payload.level as NotificationLevel)
          : 'info',
      metadata,
      actor: log.user,
    };
  }

  private buildAuditNotification(log: {
    id: number;
    action: string;
    createdAt: Date;
    entite: string;
    entiteId: number;
    ancienneValeur: Prisma.JsonValue | null;
    nouvelleValeur: Prisma.JsonValue | null;
    user: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
      role: Role;
    } | null;
  }): InternalNotificationItem {
    const oldValue =
      log.ancienneValeur && typeof log.ancienneValeur === 'object'
        ? (log.ancienneValeur as Prisma.JsonObject)
        : {};
    const newValue =
      log.nouvelleValeur && typeof log.nouvelleValeur === 'object'
        ? (log.nouvelleValeur as Prisma.JsonObject)
        : {};

    if (log.action === 'SIGNATURE_DEVIS') {
      const reference =
        typeof newValue.reference === 'string'
          ? newValue.reference
          : `#${log.entiteId}`;
      const statut =
        typeof newValue.statut === 'string'
          ? newValue.statut
          : typeof newValue.status === 'string'
            ? newValue.status
            : 'mis a jour';

      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        entite: log.entite,
        entiteId: log.entiteId,
        title: 'Signature de devis',
        message: `Le devis ${reference} est passe au statut ${statut}.`,
        category: 'SIGNATURE_DEVIS',
        level: 'success',
        metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
        actor: log.user,
      };
    }

    const field =
      typeof newValue.field === 'string'
        ? newValue.field
        : typeof oldValue.field === 'string'
          ? oldValue.field
          : 'prix';
    const label =
      typeof newValue.label === 'string'
        ? newValue.label
        : typeof oldValue.label === 'string'
          ? oldValue.label
          : log.entite;
    const oldPrice = typeof oldValue.value === 'number' ? oldValue.value : null;
    const newPrice = typeof newValue.value === 'number' ? newValue.value : null;

    const priceText =
      oldPrice !== null && newPrice !== null
        ? `${this.formatCurrency(oldPrice)} → ${this.formatCurrency(newPrice)}`
        : 'valeur modifiee';

    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      entite: log.entite,
      entiteId: log.entiteId,
      title: 'Modification de prix',
      message: `${label} : ${field} modifie (${priceText}).`,
      category: 'MODIFICATION_PRIX',
      level: 'warning',
      metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
      actor: log.user,
    };
  }

  private buildSavNotification(log: {
    id: number;
    action: string;
    createdAt: Date;
    entite: string;
    entiteId: number;
    ancienneValeur: Prisma.JsonValue | null;
    nouvelleValeur: Prisma.JsonValue | null;
    user: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
      role: Role;
    } | null;
  }): InternalNotificationItem {
    const oldValue =
      log.ancienneValeur && typeof log.ancienneValeur === 'object'
        ? (log.ancienneValeur as Prisma.JsonObject)
        : {};
    const newValue =
      log.nouvelleValeur && typeof log.nouvelleValeur === 'object'
        ? (log.nouvelleValeur as Prisma.JsonObject)
        : {};

    const reference =
      typeof newValue.reference === 'string'
        ? newValue.reference
        : typeof newValue.ticketReference === 'string'
          ? newValue.ticketReference
          : `#${log.entiteId}`;

    const titre =
      typeof newValue.titre === 'string'
        ? newValue.titre
        : typeof oldValue.titre === 'string'
          ? oldValue.titre
          : 'Ticket SAV';

    const statut =
      typeof newValue.statut === 'string'
        ? newValue.statut
        : typeof oldValue.statut === 'string'
          ? oldValue.statut
          : undefined;

    const priorite =
      typeof newValue.priorite === 'string'
        ? newValue.priorite
        : typeof oldValue.priorite === 'string'
          ? oldValue.priorite
          : undefined;

    if (log.action === 'SAV_TICKET_CREATED') {
      const isUrgent = priorite === 'URGENTE';

      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        entite: log.entite,
        entiteId: log.entiteId,
        title: isUrgent ? 'Nouveau ticket SAV urgent' : 'Nouveau ticket SAV',
        message: `${reference} - ${titre}${priorite ? ` (${priorite})` : ''}.`,
        category: 'SAV_TICKET',
        level: isUrgent ? 'danger' : 'warning',
        metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
        actor: log.user,
      };
    }

    if (log.action === 'SAV_NOTE_CREATED') {
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        entite: log.entite,
        entiteId: log.entiteId,
        title: 'Nouvelle note SAV',
        message: `Une note interne a ete ajoutee au ticket ${reference}.`,
        category: 'SAV_NOTE',
        level: 'info',
        metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
        actor: log.user,
      };
    }

    const isResolved = statut === 'RESOLU' || statut === 'CLOTURE';
    const isUrgent = priorite === 'URGENTE';

    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      entite: log.entite,
      entiteId: log.entiteId,
      title: isResolved ? 'Ticket SAV resolu' : 'Ticket SAV mis a jour',
      message: `${reference} - ${titre}${statut ? ` : statut ${statut}` : ''}.`,
      category: 'SAV_TICKET',
      level: isResolved ? 'success' : isUrgent ? 'danger' : 'info',
      metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
      actor: log.user,
    };
  }


  private buildDemoNotification(log: {
    id: number;
    action: string;
    createdAt: Date;
    entite: string;
    entiteId: number;
    ancienneValeur: Prisma.JsonValue | null;
    nouvelleValeur: Prisma.JsonValue | null;
    user: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
      role: Role;
    } | null;
  }): InternalNotificationItem {
    const oldValue =
      log.ancienneValeur && typeof log.ancienneValeur === 'object'
        ? (log.ancienneValeur as Prisma.JsonObject)
        : {};
    const newValue =
      log.nouvelleValeur && typeof log.nouvelleValeur === 'object'
        ? (log.nouvelleValeur as Prisma.JsonObject)
        : {};

    const nom =
      typeof newValue.nom === 'string'
        ? newValue.nom
        : typeof oldValue.nom === 'string'
          ? oldValue.nom
          : 'Prospect';
    const prenom =
      typeof newValue.prenom === 'string'
        ? newValue.prenom
        : typeof oldValue.prenom === 'string'
          ? oldValue.prenom
          : '';
    const entreprise =
      typeof newValue.entreprise === 'string'
        ? newValue.entreprise
        : typeof oldValue.entreprise === 'string'
          ? oldValue.entreprise
          : undefined;
    const statut =
      typeof newValue.statut === 'string'
        ? newValue.statut
        : typeof oldValue.statut === 'string'
          ? oldValue.statut
          : undefined;

    if (log.action === 'DEMO_REQUEST_CREATED') {
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        entite: log.entite,
        entiteId: log.entiteId,
        title: 'Nouvelle demande de démo',
        message: `${prenom ? `${prenom} ` : ''}${nom}${entreprise ? ` (${entreprise})` : ''} souhaite une démonstration.`,
        category: 'DEMO_REQUEST',
        level: 'warning',
        metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
        actor: log.user,
      };
    }

    const scheduled = statut === 'SCHEDULED';

    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      entite: log.entite,
      entiteId: log.entiteId,
      title: scheduled ? 'Démo planifiée' : 'Demande de démo mise à jour',
      message: `${prenom ? `${prenom} ` : ''}${nom}${statut ? ` : statut ${statut}` : ''}.`,
      category: scheduled ? 'DEMO_SCHEDULED' : 'DEMO_REQUEST',
      level: scheduled ? 'success' : 'info',
      metadata: { ancienneValeur: oldValue, nouvelleValeur: newValue },
      actor: log.user,
    };
  }

  async listInternalNotifications(currentUser: CurrentUserPayload, limit = 8) {
    this.ensureInternalUser(currentUser);

    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const alertDate = this.getStableAlertDate();

    const [
      facturesImpayees,
      chantiersEnRetard,
      commandesEnAttente,
      stockBas,
      savOuverts,
      savEnCours,
      savUrgents,
      demoPending,
      demoScheduledSoon,
      legacyLogs,
      auditLogs,
      savLogs,
      demoLogs,
    ] = await Promise.all([
      this.prisma.facture.aggregate({
        where: {
          statut: FactureStatut.ENVOYEE,
          devis: { companyId: currentUser.companyId },
        },
        _count: { _all: true },
        _sum: { montantTTC: true },
      }),

      this.prisma.chantier.count({
        where: {
          companyId: currentUser.companyId,
          dateFin: { lt: new Date() },
          statut: {
            notIn: [ChantierStatut.TERMINE, ChantierStatut.CLOTURE],
          },
        },
      }),

      this.prisma.commandeFournisseur.count({
        where: {
          devis: { companyId: currentUser.companyId },
          statutLivraison: {
            in: [
              CommandeFournisseurStatut.CREEE,
              CommandeFournisseurStatut.ENVOYEE,
              CommandeFournisseurStatut.EXPEDIEE,
              CommandeFournisseurStatut.PARTIELLE,
            ],
          },
        },
      }),

      this.prisma.materiau.count({
        where: {
          companyId: currentUser.companyId,
          actif: true,
          stockActuel: { lte: this.prisma.materiau.fields.stockMinimum },
        },
      }),

      this.prisma.savTicket.count({
        where: {
          companyId: currentUser.companyId,
          statut: { notIn: [SavTicketStatut.RESOLU, SavTicketStatut.CLOTURE] },
        },
      }),

      this.prisma.savTicket.count({
        where: {
          companyId: currentUser.companyId,
          statut: SavTicketStatut.EN_COURS,
        },
      }),

      this.prisma.savTicket.count({
        where: {
          companyId: currentUser.companyId,
          priorite: SavTicketPriorite.URGENTE,
          statut: { notIn: [SavTicketStatut.RESOLU, SavTicketStatut.CLOTURE] },
        },
      }),

      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.PENDING,
        },
      }),

      this.prisma.demoRequest.count({
        where: {
          companyId: currentUser.companyId,
          statut: DemoRequestStatut.SCHEDULED,
          dateDemo: {
            gte: new Date(),
            lte: new Date(new Date().setDate(new Date().getDate() + 1)),
          },
        },
      }),

      this.prisma.auditLog.findMany({
        where: {
          companyId: currentUser.companyId,
          action: { in: legacyNotificationActions },
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),

      this.prisma.auditLog.findMany({
        where: {
          companyId: currentUser.companyId,
          action: { in: ['SIGNATURE_DEVIS', 'MODIFICATION_PRIX'] },
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),

      this.prisma.auditLog.findMany({
        where: {
          companyId: currentUser.companyId,
          action: { in: ['SAV_TICKET_CREATED', 'SAV_TICKET_UPDATED', 'SAV_NOTE_CREATED'] },
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),

      this.prisma.auditLog.findMany({
        where: {
          companyId: currentUser.companyId,
          action: { in: ['DEMO_REQUEST_CREATED', 'DEMO_REQUEST_UPDATED'] },
        },
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),
    ]);

    const alertItems: InternalNotificationItem[] = [];
    const unpaidAmount = this.round(facturesImpayees._sum.montantTTC ?? 0);
    const unpaidCount = facturesImpayees._count._all;

    if (unpaidCount > 0) {
      alertItems.push({
        id: -1,
        action: 'ALERT_FACTURES_IMPAYEES',
        createdAt: alertDate,
        entite: 'Facture',
        entiteId: 0,
        title: 'Factures impayees',
        message: `${unpaidCount} facture(s) envoyee(s) restent a relancer pour ${this.formatCurrency(unpaidAmount)}.`,
        category: 'FACTURES_IMPAYEES',
        level: 'danger',
        metadata: { nombre: unpaidCount, montant: unpaidAmount },
        actor: null,
      });
    }

    if (chantiersEnRetard > 0) {
      alertItems.push({
        id: -2,
        action: 'ALERT_CHANTIERS_RETARD',
        createdAt: alertDate,
        entite: 'Chantier',
        entiteId: 0,
        title: 'Chantiers en retard',
        message: `${chantiersEnRetard} chantier(s) ont depasse la date de fin prevue.`,
        category: 'CHANTIERS_RETARD',
        level: 'warning',
        metadata: { nombre: chantiersEnRetard },
        actor: null,
      });
    }

    if (commandesEnAttente > 0) {
      alertItems.push({
        id: -3,
        action: 'ALERT_COMMANDES_ATTENTE',
        createdAt: alertDate,
        entite: 'CommandeFournisseur',
        entiteId: 0,
        title: 'Commandes fournisseur en attente',
        message: `${commandesEnAttente} commande(s) fournisseur demandent un suivi.`,
        category: 'COMMANDES_ATTENTE',
        level: 'info',
        metadata: { nombre: commandesEnAttente },
        actor: null,
      });
    }

    if (stockBas > 0) {
      alertItems.push({
        id: -7,
        action: 'ALERT_STOCK_BAS',
        createdAt: alertDate,
        entite: 'Materiau',
        entiteId: 0,
        title: 'Stock à réapprovisionner',
        message: `${stockBas} matériau(x) ont atteint leur seuil minimum.`,
        category: 'STOCK_BAS',
        level: 'warning',
        metadata: { nombre: stockBas },
        actor: null,
      });
    }

    if (savUrgents > 0) {
      alertItems.push({
        id: -4,
        action: 'ALERT_SAV_URGENT',
        createdAt: alertDate,
        entite: 'SavTicket',
        entiteId: 0,
        title: 'Tickets SAV urgents',
        message: `${savUrgents} ticket(s) SAV urgent(s) demandent une intervention rapide.`,
        category: 'SAV_URGENT',
        level: 'danger',
        metadata: { urgents: savUrgents, ouverts: savOuverts, enCours: savEnCours },
        actor: null,
      });
    }


    if (demoPending > 0) {
      alertItems.push({
        id: -5,
        action: 'ALERT_DEMO_PENDING',
        createdAt: alertDate,
        entite: 'DemoRequest',
        entiteId: 0,
        title: 'Demandes de démo à traiter',
        message: `${demoPending} demande(s) de démo attendent un premier contact commercial.`,
        category: 'DEMO_REQUEST',
        level: 'warning',
        metadata: { pending: demoPending },
        actor: null,
      });
    }

    if (demoScheduledSoon > 0) {
      alertItems.push({
        id: -6,
        action: 'ALERT_DEMO_SCHEDULED_SOON',
        createdAt: alertDate,
        entite: 'DemoRequest',
        entiteId: 0,
        title: 'Démos planifiées bientôt',
        message: `${demoScheduledSoon} démonstration(s) sont planifiées aujourd'hui ou demain.`,
        category: 'DEMO_SCHEDULED',
        level: 'success',
        metadata: { scheduledSoon: demoScheduledSoon },
        actor: null,
      });
    }

    const items = [
      ...alertItems,
      ...savLogs.map((log) => this.buildSavNotification(log)),
      ...demoLogs.map((log) => this.buildDemoNotification(log)),
      ...auditLogs.map((log) => this.buildAuditNotification(log)),
      ...legacyLogs.map((log) => this.buildLegacyLogNotification(log)),
    ]
      .filter((item) => this.canRoleSeeCategory(currentUser.role, item.category))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, safeLimit);

    return {
      items,
      summary: {
        total: items.length,
        unreadPotential: items.length,
        alerts: items.filter((item) =>
          [
            'FACTURES_IMPAYEES',
            'CHANTIERS_RETARD',
            'COMMANDES_ATTENTE',
            'SUPPLIER_STATUS',
            'RECEPTION_PARTIELLE',
            'RECEPTION_COMPLETE',
            'CHANTIER_DOCUMENT',
            'STOCK_BAS',
            'AUDIT_RECENT',
          ].includes(item.category),
        ).length,
        facturesImpayees: this.canRoleSeeCategory(
          currentUser.role,
          'FACTURES_IMPAYEES',
        )
          ? unpaidCount
          : 0,
        montantFacturesImpayees: this.canRoleSeeCategory(
          currentUser.role,
          'FACTURES_IMPAYEES',
        )
          ? unpaidAmount
          : 0,
        chantiersEnRetard: this.canRoleSeeCategory(
          currentUser.role,
          'CHANTIERS_RETARD',
        )
          ? chantiersEnRetard
          : 0,
        commandesEnAttente: this.canRoleSeeCategory(
          currentUser.role,
          'COMMANDES_ATTENTE',
        )
          ? commandesEnAttente
          : 0,
        stockBas: this.canRoleSeeCategory(currentUser.role, 'STOCK_BAS')
          ? stockBas
          : 0,
        savOuverts,
        savEnCours,
        savUrgents,
        savNotifications: items.filter((item) =>
          item.category.startsWith('SAV'),
        ).length,
        demoPending: this.canRoleSeeCategory(currentUser.role, 'DEMO_REQUEST')
          ? demoPending
          : 0,
        demoScheduledSoon: this.canRoleSeeCategory(
          currentUser.role,
          'DEMO_SCHEDULED',
        )
          ? demoScheduledSoon
          : 0,
        demoNotifications: items.filter((item) =>
          item.category.startsWith('DEMO'),
        ).length,
        signatures: items.filter(
          (item) => item.category === 'SIGNATURE_DEVIS',
        ).length,
        modificationsPrix: items.filter(
          (item) => item.category === 'MODIFICATION_PRIX',
        ).length,
        supplierUpdates: items.filter(
          (item) => item.category === 'SUPPLIER_STATUS',
        ).length,
        receptionsPartielles: items.filter(
          (item) => item.category === 'RECEPTION_PARTIELLE',
        ).length,
        receptionsCompletes: items.filter(
          (item) => item.category === 'RECEPTION_COMPLETE',
        ).length,
      },
    };
  }
}
