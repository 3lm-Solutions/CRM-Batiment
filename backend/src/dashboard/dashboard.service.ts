import { Injectable } from '@nestjs/common';
import {
  ChantierStatut,
  CommandeFournisseurStatut,
  DevisStatut,
  FactureStatut,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface MonthBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

interface InternalMonthlyStats {
  mois: string;
  ca: number;
  margeSomme: number;
  margeNombre: number;
  prospects: number;
  factures: number;
  chantiers: number;
  commandes: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private getMonthKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private buildLastMonths(count = 12): MonthBucket[] {
    const now = new Date();
    const months: MonthBucket[] = [];

    for (let i = count - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

      const monthLabel = start.toLocaleDateString('fr-FR', {
        month: 'short',
      });

      months.push({
        key: this.getMonthKey(start),
        label: `${monthLabel} ${String(start.getFullYear()).slice(2)}`,
        start,
        end,
      });
    }

    return months;
  }

  private buildMonthlyBase(months: MonthBucket[]) {
    const monthlyMap = new Map<string, InternalMonthlyStats>();

    for (const month of months) {
      monthlyMap.set(month.key, {
        mois: month.label,
        ca: 0,
        margeSomme: 0,
        margeNombre: 0,
        prospects: 0,
        factures: 0,
        chantiers: 0,
        commandes: 0,
      });
    }

    return monthlyMap;
  }

  async getAdminStats(companyId: number) {
    const now = new Date();

    const start30Days = new Date(now);
    start30Days.setDate(now.getDate() - 30);

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const lastMonths = this.buildLastMonths(12);
    const trendStart = lastMonths[0].start;
    const trendEnd = lastMonths[lastMonths.length - 1].end;

    const [
      prospectsActifs,
      devisByStatus,
      caSigne,
      facturesImpayees,
      chantiersEnRetard,
      commandesEnAttente,
      margeDevisAgg,
      margeChantiersAgg,

      devisMensuels,
      prospectsMensuels,
      facturesMensuelles,
      chantiersMensuels,
      commandesMensuelles,
    ] = await Promise.all([
      this.prisma.client.count({
        where: {
          companyId,
          createdAt: { gte: start30Days },
        },
      }),

      this.prisma.devis.groupBy({
        by: ['statut'],
        where: { companyId },
        _count: { _all: true },
      }),

      this.prisma.devis.aggregate({
        where: {
          companyId,
          statut: DevisStatut.SIGNE,
          dateValidation: {
            gte: startMonth,
            lt: nextMonth,
          },
        },
        _sum: { totalTTC: true },
      }),

      this.prisma.facture.aggregate({
        where: {
          statut: FactureStatut.ENVOYEE,
          devis: { companyId },
        },
        _count: { _all: true },
        _sum: { montantTTC: true },
      }),

      this.prisma.chantier.count({
        where: {
          companyId,
          dateFin: { lt: now },
          statut: {
            notIn: [ChantierStatut.TERMINE, ChantierStatut.CLOTURE],
          },
        },
      }),

      this.prisma.commandeFournisseur.count({
        where: {
          devis: { companyId },
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

      this.prisma.devis.aggregate({
        where: {
          companyId,
          statut: {
            in: [
              DevisStatut.ENVOYE,
              DevisStatut.ACCEPTE,
              DevisStatut.SIGNE,
              DevisStatut.REFUSE,
            ],
          },
        },
        _avg: {
          margePourcent: true,
        },
      }),

      this.prisma.devis.aggregate({
        where: {
          companyId,
          chantierId: { not: null },
          statut: {
            in: [DevisStatut.ACCEPTE, DevisStatut.SIGNE],
          },
        },
        _avg: {
          margePourcent: true,
        },
      }),

      this.prisma.devis.findMany({
        where: {
          companyId,
          statut: DevisStatut.SIGNE,
          dateValidation: {
            gte: trendStart,
            lt: trendEnd,
          },
        },
        select: {
          dateValidation: true,
          totalTTC: true,
          margePourcent: true,
        },
      }),

      this.prisma.client.findMany({
        where: {
          companyId,
          createdAt: {
            gte: trendStart,
            lt: trendEnd,
          },
        },
        select: {
          createdAt: true,
        },
      }),

      this.prisma.facture.findMany({
        where: {
          devis: { companyId },
          date: {
            gte: trendStart,
            lt: trendEnd,
          },
        },
        select: {
          date: true,
        },
      }),

      this.prisma.chantier.findMany({
        where: {
          companyId,
          createdAt: {
            gte: trendStart,
            lt: trendEnd,
          },
        },
        select: {
          createdAt: true,
        },
      }),

      this.prisma.commandeFournisseur.findMany({
        where: {
          devis: { companyId },
          date: {
            gte: trendStart,
            lt: trendEnd,
          },
        },
        select: {
          date: true,
        },
      }),
    ]);

    const countByStatus = (statut: DevisStatut) =>
      devisByStatus.find((item) => item.statut === statut)?._count._all ?? 0;

    const envoyes = countByStatus(DevisStatut.ENVOYE);
    const acceptes = countByStatus(DevisStatut.ACCEPTE);
    const signes = countByStatus(DevisStatut.SIGNE);
    const refuses = countByStatus(DevisStatut.REFUSE);
    const brouillons = countByStatus(DevisStatut.BROUILLON);

    const totalTraites = envoyes + acceptes + signes + refuses;
    const tauxConversion =
      totalTraites > 0 ? ((acceptes + signes) / totalTraites) * 100 : 0;

    const monthlyMap = this.buildMonthlyBase(lastMonths);

    for (const devis of devisMensuels) {
      if (!devis.dateValidation) continue;

      const key = this.getMonthKey(devis.dateValidation);
      const month = monthlyMap.get(key);
      if (!month) continue;

      month.ca += devis.totalTTC;
      month.margeSomme += devis.margePourcent;
      month.margeNombre += 1;
    }

    for (const client of prospectsMensuels) {
      const key = this.getMonthKey(client.createdAt);
      const month = monthlyMap.get(key);
      if (month) month.prospects += 1;
    }

    for (const facture of facturesMensuelles) {
      const key = this.getMonthKey(facture.date);
      const month = monthlyMap.get(key);
      if (month) month.factures += 1;
    }

    for (const chantier of chantiersMensuels) {
      const key = this.getMonthKey(chantier.createdAt);
      const month = monthlyMap.get(key);
      if (month) month.chantiers += 1;
    }

    for (const commande of commandesMensuelles) {
      const key = this.getMonthKey(commande.date);
      const month = monthlyMap.get(key);
      if (month) month.commandes += 1;
    }

    const tendancesMensuelles = Array.from(monthlyMap.values()).map((month) => ({
      mois: month.mois,
      ca: this.round(month.ca),
      marge:
        month.margeNombre > 0
          ? this.round(month.margeSomme / month.margeNombre)
          : 0,
      prospects: month.prospects,
      factures: month.factures,
      chantiers: month.chantiers,
      commandes: month.commandes,
    }));

    return {
      prospectsActifs,

      devis: {
        envoyes,
        acceptes,
        refuses,
        brouillons,
        signes,
      },

      tauxConversion: this.round(tauxConversion),

      caSigneMois: this.round(caSigne._sum.totalTTC ?? 0),

      facturesImpayees: {
        montant: this.round(facturesImpayees._sum.montantTTC ?? 0),
        nombre: facturesImpayees._count._all,
      },

      chantiersEnRetard,

      commandesEnAttente,

      margeMoyenne: {
        devis: this.round(margeDevisAgg._avg.margePourcent ?? 0),
        chantiers: this.round(margeChantiersAgg._avg.margePourcent ?? 0),
      },

      tendancesMensuelles,
    };
  }
}