import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common';
import type { DevisStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { rate, weeklySeries } from './weekly-series';

const OPEN_CHANTIER = ['PLANIFIE', 'EN_COURS', 'SUSPENDU'] as const;
const PENDING_ORDERS = ['CREEE', 'ENVOYEE', 'EXPEDIEE', 'PARTIELLE'] as const;

/** Admin dashboard (spec "Dashboard Admin" P0 + MUST "Dashboard dirigeant"). One call, all KPIs. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthUser, jours: number) {
    const companyId = user.companyId;
    const now = new Date();
    const since = new Date(now.getTime() - jours * 86_400_000);
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const SERIES_WEEKS = 12;
    const seriesSince = new Date(now.getTime() - SERIES_WEEKS * 7 * 86_400_000);

    const [
      prospects,
      nouveauxClients,
      devisPeriode,
      signesMois,
      margeSignes,
      impayees,
      impayeesRetard,
      chantiersRetard,
      commandesEnAttente,
      savOuverts,
      savUrgents,
      stockAlertes,
      seriesRows,
    ] = await Promise.all([
      this.prisma.demandeDevis.count({ where: { companyId, statut: { in: ['NOUVEAU', 'EN_COURS', 'QUALIFIE'] }, createdAt: { gte: since } } }),
      this.prisma.client.count({ where: { companyId, createdAt: { gte: since } } }),
      this.prisma.devis.groupBy({ by: ['statut'], where: { companyId, dateEnvoi: { gte: since } }, _count: { _all: true } }),
      this.prisma.devis.aggregate({ where: { companyId, statut: 'SIGNE', dateValidation: { gte: debutMois } }, _sum: { totalHT: true }, _count: { _all: true } }),
      this.prisma.devis.aggregate({ where: { companyId, statut: 'SIGNE', dateValidation: { gte: since } }, _avg: { margePourcent: true } }),
      this.prisma.facture.aggregate({ where: { companyId, statut: 'ENVOYEE', typeFacture: { not: 'AVOIR' } }, _sum: { montantTTC: true }, _count: { _all: true } }),
      this.prisma.facture.aggregate({
        where: { companyId, statut: 'ENVOYEE', typeFacture: { not: 'AVOIR' }, dateEcheance: { lt: now } },
        _sum: { montantTTC: true },
        _count: { _all: true },
      }),
      this.prisma.chantier.findMany({
        where: { companyId, statut: { in: [...OPEN_CHANTIER] }, dateFin: { lt: now } },
        orderBy: { dateFin: 'asc' },
        select: { id: true, reference: true, dateFin: true, statut: true, client: { select: { nom: true } } },
      }),
      this.prisma.commandeFournisseur.count({ where: { companyId, statutLivraison: { in: [...PENDING_ORDERS] } } }),
      this.prisma.savTicket.count({ where: { companyId, statut: { notIn: ['RESOLU', 'CLOTURE'] } } }),
      this.prisma.savTicket.count({ where: { companyId, statut: { notIn: ['RESOLU', 'CLOTURE'] }, priorite: 'URGENTE' } }),
      this.prisma.materiau.count({ where: { companyId, actif: true, stockActuel: { lte: this.prisma.materiau.fields.stockMinimum } } }),
      this.prisma.devis.findMany({
        where: { companyId, dateEnvoi: { gte: seriesSince } },
        select: { dateEnvoi: true, statut: true },
      }),
    ]);

    const byStatut = (statuts: string[]) =>
      devisPeriode.filter((g) => statuts.includes(g.statut)).reduce((n, g) => n + g._count._all, 0);
    const envoyes = devisPeriode.reduce((n, g) => n + g._count._all, 0);
    const acceptes = byStatut(['ACCEPTE', 'SIGNE']);

    return {
      periodeJours: jours,
      prospects: { demandesActives: prospects, nouveauxClients },
      devis: { envoyes, acceptes, refuses: byStatut(['REFUSE']), tauxConversion: rate(acceptes, envoyes) },
      chiffreAffaires: { signeMoisHT: signesMois._sum.totalHT ?? 0, devisSignesMois: signesMois._count._all },
      margeMoyennePourcent: margeSignes._avg.margePourcent ?? null,
      facturesImpayees: {
        nombre: impayees._count._all,
        montantTTC: impayees._sum.montantTTC ?? 0,
        enRetard: { nombre: impayeesRetard._count._all, montantTTC: impayeesRetard._sum.montantTTC ?? 0 },
      },
      chantiersEnRetard: {
        nombre: chantiersRetard.length,
        liste: chantiersRetard.slice(0, 5).map((c) => ({
          ...c,
          joursRetard: Math.floor((now.getTime() - c.dateFin!.getTime()) / 86_400_000),
        })),
      },
      commandesEnAttente,
      sav: { ouverts: savOuverts, urgents: savUrgents },
      stockAlertes,
      serieDevis: weeklySeries(
        seriesRows.filter((r): r is { dateEnvoi: Date; statut: DevisStatut } => r.dateEnvoi !== null),
        now,
        SERIES_WEEKS,
      ),
    };
  }
}
