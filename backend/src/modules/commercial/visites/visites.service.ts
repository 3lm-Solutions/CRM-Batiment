import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { type AuthUser, BusinessException, paginate, toSkipTake } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../pilotage/notifications/notifications.service';
import type {
  AnnulerVisiteDto,
  CreateVisiteDto,
  QueryVisitesDto,
  TerminerVisiteDto,
  UpdateVisiteDto,
} from './visites.dto';

const SELECT = {
  id: true,
  dateHeure: true,
  dureeMinutes: true,
  adresse: true,
  objet: true,
  statut: true,
  compteRendu: true,
  motifAnnulation: true,
  createdAt: true,
  client: { select: { id: true, nom: true, prenom: true, telephone: true } },
  demandeDevis: { select: { id: true, reference: true, statut: true } },
  commercial: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.VisiteSelect;

/**
 * 16/11 (mobile lot 1) — appointments of the sales team at the client's (« visites
 * programmées »). A TECHNICO sees and manages his own; ADMIN and ASSISTANTE see everybody's
 * and can plan one for a commercial. Reminder by notification (+ push) the day before.
 */
@Injectable()
export class VisitesService {
  private readonly logger = new Logger(VisitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private scope(user: AuthUser): Prisma.VisiteWhereInput {
    return {
      companyId: user.companyId,
      ...(user.role === Role.TECHNICO && { commercialId: user.id }),
    };
  }

  async findAll(user: AuthUser, query: QueryVisitesDto) {
    const where: Prisma.VisiteWhereInput = {
      AND: [
        this.scope(user),
        {
          clientId: query.clientId,
          commercialId: query.commercialId,
          ...(query.statuts?.length && { statut: { in: query.statuts } }),
          ...((query.du || query.au) && {
            dateHeure: {
              ...(query.du && { gte: new Date(query.du) }),
              ...(query.au && { lt: finDuJour(query.au) }),
            },
          }),
        },
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.visite.findMany({
        where,
        select: SELECT,
        orderBy: { dateHeure: 'asc' },
        ...toSkipTake(query),
      }),
      this.prisma.visite.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const visite = await this.prisma.visite.findFirst({
      where: { id, ...this.scope(user) },
      select: SELECT,
    });
    if (!visite) throw new NotFoundException(`Visite #${id} introuvable`);
    return visite;
  }

  async create(user: AuthUser, dto: CreateVisiteDto) {
    const commercialId =
      dto.commercialId && user.role !== Role.TECHNICO ? dto.commercialId : user.id;
    if (commercialId !== user.id) {
      const ok = await this.prisma.user.count({
        where: {
          id: commercialId,
          companyId: user.companyId,
          actif: true,
          role: { in: [Role.TECHNICO, Role.ADMIN, Role.ASSISTANTE] },
        },
      });
      if (!ok) throw new BusinessException('COMMERCIAL_INVALIDE', 'Commercial introuvable.');
    }
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId: user.companyId },
      select: { adresseChantier: true, adresseClient: true },
    });
    if (!client) throw new NotFoundException(`Client #${dto.clientId} introuvable`);
    await this.assertDemande(user.companyId, dto.demandeDevisId, dto.clientId);
    const visite = await this.prisma.visite.create({
      data: {
        companyId: user.companyId,
        commercialId,
        clientId: dto.clientId,
        demandeDevisId: dto.demandeDevisId ?? null,
        dateHeure: new Date(dto.dateHeure),
        dureeMinutes: dto.dureeMinutes ?? 60,
        adresse: dto.adresse ?? client.adresseChantier ?? client.adresseClient,
        objet: dto.objet ?? null,
      },
      select: SELECT,
    });
    if (commercialId !== user.id) {
      await this.notifications.notifyUsers(user.companyId, [commercialId], {
        type: 'VISITE_PLANIFIEE',
        niveau: 'INFO',
        titre: 'Nouvelle visite programmée',
        message: `${nomClient(visite.client)} — ${formatDateHeure(visite.dateHeure)}`,
        lien: `/visites/${visite.id}`,
      });
    }
    return visite;
  }

  async update(user: AuthUser, id: number, dto: UpdateVisiteDto) {
    const visite = await this.assertPrevue(user, id);
    await this.assertDemande(user.companyId, dto.demandeDevisId, visite.clientId);
    return this.prisma.visite.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateHeure && { dateHeure: new Date(dto.dateHeure), rappelEnvoyeLe: null }),
      },
      select: SELECT,
    });
  }

  async terminer(user: AuthUser, id: number, dto: TerminerVisiteDto) {
    await this.assertPrevue(user, id);
    return this.changer(id, { statut: 'FAITE', compteRendu: dto.compteRendu ?? null });
  }

  async annuler(user: AuthUser, id: number, dto: AnnulerVisiteDto) {
    await this.assertPrevue(user, id);
    return this.changer(id, { statut: 'ANNULEE', motifAnnulation: dto.motif ?? null });
  }

  /** Tomorrow's planned visits, for the commercial dashboard. */
  prochaines(user: AuthUser, moi: boolean, take = 5) {
    const where: Prisma.VisiteWhereInput = {
      companyId: user.companyId,
      ...((moi || user.role === Role.TECHNICO) && { commercialId: user.id }),
      statut: 'PREVUE',
      dateHeure: { gte: new Date() },
    };
    return this.prisma.$transaction([
      this.prisma.visite.count({ where }),
      this.prisma.visite.findMany({ where, select: SELECT, orderBy: { dateHeure: 'asc' }, take }),
    ]);
  }

  /** Every evening at 18:00: reminder of tomorrow's visits (once per visit). */
  @Cron('0 18 * * *', { name: 'visites-rappel', timeZone: 'Europe/Paris' })
  async rappels(now: Date = new Date()): Promise<number> {
    const demain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const apresDemain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const visites = await this.prisma.visite.findMany({
      where: {
        statut: 'PREVUE',
        rappelEnvoyeLe: null,
        dateHeure: { gte: demain, lt: apresDemain },
      },
      select: {
        id: true,
        companyId: true,
        commercialId: true,
        dateHeure: true,
        adresse: true,
        client: { select: { nom: true, prenom: true } },
      },
    });
    for (const v of visites) {
      const { count } = await this.prisma.visite.updateMany({
        where: { id: v.id, rappelEnvoyeLe: null },
        data: { rappelEnvoyeLe: now },
      });
      if (!count) continue;
      await this.notifications.notifyUsers(v.companyId, [v.commercialId], {
        type: 'VISITE_RAPPEL',
        niveau: 'INFO',
        titre: `Visite demain — ${nomClient(v.client)}`,
        message: `${formatDateHeure(v.dateHeure)}${v.adresse ? ` · ${v.adresse}` : ''}`,
        lien: `/visites/${v.id}`,
      });
    }
    if (visites.length) this.logger.log(`${visites.length} rappel(s) de visite envoyé(s)`);
    return visites.length;
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async assertPrevue(user: AuthUser, id: number) {
    const visite = await this.prisma.visite.findFirst({
      where: { id, ...this.scope(user) },
      select: { id: true, statut: true, clientId: true },
    });
    if (!visite) throw new NotFoundException(`Visite #${id} introuvable`);
    if (visite.statut !== 'PREVUE') {
      throw new BusinessException(
        'VISITE_TERMINEE',
        'Cette visite est déjà faite ou annulée : elle ne change plus.',
      );
    }
    return visite;
  }

  private async changer(id: number, data: Prisma.VisiteUpdateManyMutationInput) {
    const { count } = await this.prisma.visite.updateMany({
      where: { id, statut: 'PREVUE' },
      data,
    });
    if (!count) {
      throw new BusinessException('VISITE_MODIFIEE', 'La visite vient d’être modifiée. Rechargez.');
    }
    return this.prisma.visite.findUniqueOrThrow({ where: { id }, select: SELECT });
  }

  private async assertDemande(
    companyId: number,
    demandeDevisId: number | null | undefined,
    clientId: number,
  ) {
    if (!demandeDevisId) return;
    const ok = await this.prisma.demandeDevis.count({
      where: { id: demandeDevisId, companyId, clientId },
    });
    if (!ok) {
      throw new BusinessException(
        'DEMANDE_INVALIDE',
        'Cette demande de devis n’existe pas ou concerne un autre client.',
      );
    }
  }
}

function finDuJour(jour: string): Date {
  const d = new Date(jour);
  return new Date(d.getTime() + (/T/.test(jour) ? 1 : 86_400_000));
}

function nomClient(c: { nom: string; prenom: string | null }) {
  return [c.prenom, c.nom].filter(Boolean).join(' ');
}

function formatDateHeure(d: Date) {
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
