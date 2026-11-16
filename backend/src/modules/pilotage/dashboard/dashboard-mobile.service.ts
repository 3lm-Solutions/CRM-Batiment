import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { VisitesService } from '../../commercial/visites/visites.service';
import { rate } from './weekly-series';

/** Items returned per block (the total is always given). */
const MAX = 5;
const JOUR_MS = 86_400_000;
/** A quote sent this long ago without an answer is « to follow up » */
const RELANCE_JOURS = 7;

const debutDuJour = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Dashboards of the mobile app (16/11, lot B1). The web admin dashboard (GET /dashboard) is
 * unchanged. Same visibility rules as the list routes they summarise.
 */
@Injectable()
export class DashboardMobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visites: VisitesService,
  ) {}

  /**
   * GET /dashboard/chef — chef de chantier: HIS job sites; office: every job site.
   * No amount anywhere (the chef never sees prices).
   */
  async chef(user: AuthUser) {
    const chef = user.role === Role.CHEF_CHANTIER;
    const companyId = user.companyId;
    const aujourdhui = debutDuJour();
    const demain = new Date(aujourdhui.getTime() + JOUR_MS);

    const chantierScope: Prisma.ChantierWhereInput = chef
      ? { companyId, chefChantierId: user.id }
      : { companyId };
    const chantiersDuJour: Prisma.ChantierWhereInput = {
      ...chantierScope,
      statut: { in: ['PLANIFIE', 'EN_COURS'] },
      AND: [
        { OR: [{ dateDebut: null }, { dateDebut: { lt: demain } }] },
        { OR: [{ dateFin: null }, { dateFin: { gte: aujourdhui } }] },
      ],
    };
    const tachesRetard: Prisma.TacheWhereInput = {
      chantier: { ...chantierScope, statut: { in: ['PLANIFIE', 'EN_COURS', 'SUSPENDU'] } },
      statut: { not: 'TERMINEE' },
      dateFin: { lt: aujourdhui },
    };
    const livraisons: Prisma.CommandeFournisseurWhereInput = {
      companyId,
      statutLivraison: { in: ['ENVOYEE', 'EXPEDIEE', 'PARTIELLE'] },
      ...(chef && {
        OR: [
          { devis: { chantier: { chefChantierId: user.id } } },
          { chantier: { chefChantierId: user.id } },
        ],
      }),
    };
    const sav: Prisma.SavTicketWhereInput = {
      companyId,
      statut: { in: ['OUVERT', 'EN_COURS', 'EN_ATTENTE_CLIENT'] },
      ...(chef && { OR: [{ assignedToId: user.id }, { chantier: { chefChantierId: user.id } }] }),
    };

    const [
      nbChantiers,
      chantiers,
      nbTaches,
      taches,
      nbLivraisons,
      commandes,
      nbSav,
      savUrgents,
      tickets,
    ] = await Promise.all([
      this.prisma.chantier.count({ where: chantiersDuJour }),
      this.prisma.chantier.findMany({
        where: chantiersDuJour,
        orderBy: [{ dateDebut: 'asc' }, { id: 'asc' }],
        take: MAX,
        select: {
          id: true,
          reference: true,
          statut: true,
          adresse: true,
          dateDebut: true,
          dateFin: true,
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          taches: { select: { avancement: true } },
        },
      }),
      this.prisma.tache.count({ where: tachesRetard }),
      this.prisma.tache.findMany({
        where: tachesRetard,
        orderBy: { dateFin: 'asc' },
        take: MAX,
        select: {
          id: true,
          libelle: true,
          statut: true,
          avancement: true,
          dateFin: true,
          chantier: { select: { id: true, reference: true } },
          affectations: { select: { user: { select: { id: true, nom: true, prenom: true } } } },
        },
      }),
      this.prisma.commandeFournisseur.count({ where: livraisons }),
      this.prisma.commandeFournisseur.findMany({
        where: livraisons,
        orderBy: [{ dateLivraisonPrevue: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        take: MAX,
        select: {
          id: true,
          reference: true,
          statutLivraison: true,
          dateLivraisonPrevue: true,
          fournisseur: { select: { id: true, nom: true } },
          chantier: { select: { id: true, reference: true } },
        },
      }),
      this.prisma.savTicket.count({ where: sav }),
      this.prisma.savTicket.count({ where: { ...sav, priorite: { in: ['HAUTE', 'URGENTE'] } } }),
      this.prisma.savTicket.findMany({
        where: sav,
        // URGENTE > HAUTE > NORMALE > BASSE is the enum order reversed
        orderBy: [{ priorite: 'desc' }, { createdAt: 'asc' }],
        take: MAX,
        select: {
          id: true,
          reference: true,
          titre: true,
          statut: true,
          priorite: true,
          chantierId: true,
          client: { select: { id: true, nom: true, prenom: true } },
        },
      }),
    ]);

    return {
      date: aujourdhui,
      perimetre: chef ? 'MES_CHANTIERS' : 'TOUS',
      chantiersDuJour: {
        total: nbChantiers,
        items: chantiers.map(({ taches: t, ...c }) => ({
          ...c,
          nombreTaches: t.length,
          avancement: t.length ? Math.round(t.reduce((n, x) => n + x.avancement, 0) / t.length) : 0,
        })),
      },
      tachesEnRetard: {
        total: nbTaches,
        items: taches.map(({ affectations, ...t }) => ({
          ...t,
          joursRetard: t.dateFin
            ? Math.max(
                1,
                Math.floor((aujourdhui.getTime() - debutDuJour(t.dateFin).getTime()) / JOUR_MS),
              )
            : 0,
          intervenants: affectations.map((a) => a.user).filter(Boolean),
        })),
      },
      livraisonsAttendues: {
        total: nbLivraisons,
        items: commandes.map((c) => ({
          ...c,
          enRetard: !!c.dateLivraisonPrevue && c.dateLivraisonPrevue < aujourdhui,
        })),
      },
      savOuverts: { total: nbSav, urgents: savUrgents, items: tickets },
    };
  }

  /**
   * GET /dashboard/commercial — TECHNICO: his own prospects and quotes; ADMIN / ASSISTANTE:
   * the whole company (or only theirs with ?moi=true).
   */
  async commercial(user: AuthUser, jours: number, moi = false) {
    const companyId = user.companyId;
    const perso = moi || user.role === Role.TECHNICO;
    const createur = perso ? { createurId: user.id } : {};
    const now = new Date();
    const since = new Date(now.getTime() - jours * JOUR_MS);
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const relanceAvant = new Date(now.getTime() - RELANCE_JOURS * JOUR_MS);

    const devisWhere = (w: Prisma.DevisWhereInput): Prisma.DevisWhereInput => ({
      companyId,
      ...createur,
      ...w,
    });
    const aRelancerWhere = devisWhere({
      statut: { in: ['ENVOYE', 'RENVOYE'] },
      dateEnvoi: { lt: relanceAvant },
    });

    const [
      prospectsParStatut,
      parStatut,
      envoyesPeriode,
      signesMois,
      nbARelancer,
      aRelancer,
      papierAVerifier,
      derniersProspects,
    ] = await Promise.all([
      this.prisma.demandeDevis.groupBy({
        by: ['statut'],
        where: { companyId, ...createur, statut: { in: ['NOUVEAU', 'EN_COURS', 'QUALIFIE'] } },
        _count: { _all: true },
      }),
      this.prisma.devis.groupBy({
        by: ['statut'],
        where: devisWhere({
          statut: { in: ['BROUILLON', 'REVISE', 'ENVOYE', 'RENVOYE', 'ACCEPTE', 'SIGNE_PAPIER'] },
        }),
        _count: { _all: true },
      }),
      this.prisma.devis.groupBy({
        by: ['statut'],
        where: devisWhere({ dateEnvoi: { gte: since } }),
        _count: { _all: true },
      }),
      this.prisma.devis.aggregate({
        where: devisWhere({ statut: 'SIGNE', dateValidation: { gte: debutMois } }),
        _sum: { totalHT: true },
        _count: { _all: true },
      }),
      this.prisma.devis.count({ where: aRelancerWhere }),
      this.prisma.devis.findMany({
        where: aRelancerWhere,
        orderBy: { dateEnvoi: 'asc' },
        take: MAX,
        select: {
          id: true,
          reference: true,
          statut: true,
          dateEnvoi: true,
          remisLe: true,
          totalTTC: true,
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      }),
      this.prisma.devis.count({ where: devisWhere({ statut: 'SIGNE_PAPIER' }) }),
      this.prisma.demandeDevis.findMany({
        where: { companyId, ...createur, statut: { in: ['NOUVEAU', 'EN_COURS', 'QUALIFIE'] } },
        orderBy: { createdAt: 'desc' },
        take: MAX,
        select: {
          id: true,
          reference: true,
          statut: true,
          source: true,
          createdAt: true,
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      }),
    ]);

    const [nbVisites, prochainesVisites] = await this.visites.prochaines(user, moi);
    const compte = (rows: { statut: string; _count: { _all: number } }[], statuts: string[]) =>
      rows.filter((r) => statuts.includes(r.statut)).reduce((n, r) => n + r._count._all, 0);
    const envoyes = envoyesPeriode.reduce((n, r) => n + r._count._all, 0);
    const gagnes = compte(envoyesPeriode, ['ACCEPTE', 'SIGNE', 'SIGNE_PAPIER']);

    return {
      perimetre: perso ? 'MOI' : 'ENTREPRISE',
      periodeJours: jours,
      prospects: {
        total: prospectsParStatut.reduce((n, r) => n + r._count._all, 0),
        nouveaux: compte(prospectsParStatut, ['NOUVEAU']),
        enCours: compte(prospectsParStatut, ['EN_COURS']),
        qualifies: compte(prospectsParStatut, ['QUALIFIE']),
        derniers: derniersProspects,
      },
      devis: {
        brouillons: compte(parStatut, ['BROUILLON', 'REVISE']),
        enAttenteClient: compte(parStatut, ['ENVOYE', 'RENVOYE']),
        acceptes: compte(parStatut, ['ACCEPTE']),
        signesPapierAVerifier: papierAVerifier,
      },
      conversion: { envoyes, gagnes, taux: rate(gagnes, envoyes) },
      chiffreAffaires: {
        signeMoisHT: signesMois._sum.totalHT ?? 0,
        devisSignesMois: signesMois._count._all,
      },
      aRelancer: { total: nbARelancer, joursSansReponse: RELANCE_JOURS, items: aRelancer },
      // 16/11 (lot 1): visites programmées à venir
      visites: { aVenir: nbVisites, prochaines: prochainesVisites },
    };
  }
}
