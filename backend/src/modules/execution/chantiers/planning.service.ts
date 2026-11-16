import { Injectable } from '@nestjs/common';
import { type AuthUser, BusinessException } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueryPlanningDto } from './planning.dto';

/** At most ~6 weeks at once (a month view with its overflow days). */
const MAX_JOURS = 45;

/**
 * Team planning (21/10): the dated tasks of the open job sites over a period, with who does them,
 * and the periods when sous-traitants said they are NOT available. Same visibility as the job sites.
 */
@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async periode(user: AuthUser, q: QueryPlanningDto) {
    const du = new Date(q.du);
    const au = new Date(q.au);
    au.setUTCHours(23, 59, 59, 999);
    if (au < du) throw new BusinessException('DATES_INVALIDES', 'La fin précède le début.');
    if (au.getTime() - du.getTime() > MAX_JOURS * 86_400_000)
      throw new BusinessException('PERIODE_TROP_LONGUE', `${MAX_JOURS} jours au maximum.`);

    const chantier: Prisma.ChantierWhereInput = {
      companyId: user.companyId,
      statut: { notIn: ['ANNULE', 'CLOTURE'] },
      ...(user.role === Role.CHEF_CHANTIER ? { chefChantierId: user.id } : {}),
      ...(q.chantierId ? { id: q.chantierId } : {}),
    };
    const [taches, indisponibilites] = await Promise.all([
      this.prisma.tache.findMany({
        where: {
          chantier,
          dateDebut: { not: null, lte: au },
          // no end date: a one-day task
          OR: [{ dateFin: { gte: du } }, { dateFin: null, dateDebut: { gte: du } }],
          ...(q.userId ? { affectations: { some: { userId: q.userId } } } : {}),
        },
        orderBy: [{ dateDebut: 'asc' }, { ordre: 'asc' }],
        select: {
          id: true,
          libelle: true,
          statut: true,
          avancement: true,
          dateDebut: true,
          dateFin: true,
          chantier: { select: { id: true, reference: true, adresse: true, statut: true } },
          affectations: {
            select: { user: { select: { id: true, nom: true, prenom: true, role: true } } },
          },
        },
        take: 1000,
      }),
      this.prisma.disponibiliteSousTraitant.findMany({
        where: {
          disponible: false,
          dateDebut: { lte: au },
          dateFin: { gte: du },
          sousTraitant: { companyId: user.companyId, ...(q.userId ? { userId: q.userId } : {}) },
        },
        orderBy: { dateDebut: 'asc' },
        select: {
          id: true,
          dateDebut: true,
          dateFin: true,
          notes: true,
          sousTraitant: { select: { id: true, nom: true, userId: true } },
        },
      }),
    ]);
    return {
      du,
      au,
      taches: taches.map(({ affectations, ...t }) => ({
        ...t,
        intervenants: affectations.map((a) => a.user).filter((u) => u !== null),
      })),
      indisponibilites,
    };
  }
}
