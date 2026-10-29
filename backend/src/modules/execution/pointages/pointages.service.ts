import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, toSkipTake } from '../../../common';
import { ChantierStatut, Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../pilotage/notifications/notifications.service';
import { CreatePointageDto, QueryPointagesDto, RefuserPointageDto } from './pointages.dto';
import { assertJourPointable, assertTotalJour, bornesMois, jourUtc } from './pointage-rules';

/** Job sites on which hours can be entered (a cancelled or closed site is frozen). */
const POINTABLES: ChantierStatut[] = ['PLANIFIE', 'EN_COURS', 'SUSPENDU', 'TERMINE'];

const INCLUDE = {
  sousTraitant: { select: { id: true, nom: true } },
  chantier: { select: { id: true, reference: true, adresse: true } },
  tache: { select: { id: true, libelle: true } },
  validePar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.PointageInclude;

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);

/**
 * Time tracking of the sous-traitants (21/10): entered in their portal, validated or refused by the
 * chef of the job site or the office. Follow-up only — payments stay entered separately.
 */
@Injectable()
export class PointagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── portal (role SOUS_TRAITANT) ─────────────────────────────────────────

  async mesPointages(user: AuthUser, mois?: string) {
    const sousTraitantId = await this.monDossier(user);
    const bornes = bornesMois(mois);
    const data = await this.prisma.pointage.findMany({
      where: { sousTraitantId, date: { gte: bornes.du, lt: bornes.au } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        date: true,
        heures: true,
        commentaire: true,
        statut: true,
        motifRefus: true,
        chantier: { select: { id: true, reference: true, adresse: true } },
        tache: { select: { id: true, libelle: true } },
      },
    });
    const total = (s: string) =>
      data.filter((p) => p.statut === s).reduce((sum, p) => sum + num(p.heures), 0);
    return {
      mois: bornes.mois,
      data,
      totaux: { valide: total('VALIDE'), soumis: total('SOUMIS'), refuse: total('REFUSE') },
    };
  }

  async pointer(user: AuthUser, dto: CreatePointageDto) {
    const sousTraitantId = await this.monDossier(user);
    const jour = jourUtc(dto.date);
    assertJourPointable(jour);

    const chantier = await this.prisma.chantier.findFirst({
      where: {
        id: dto.chantierId,
        companyId: user.companyId,
        sousTraitantsVisibles: { some: { userId: user.id } },
      },
      select: { id: true, reference: true, statut: true, chefChantierId: true },
    });
    if (!chantier) throw new NotFoundException(`Chantier #${dto.chantierId} introuvable`);
    if (!POINTABLES.includes(chantier.statut))
      throw new BusinessException('CHANTIER_FERME', 'Ce chantier est clôturé ou annulé.');
    if (dto.tacheId) {
      const ok = await this.prisma.tache.count({
        where: { id: dto.tacheId, chantierId: chantier.id },
      });
      if (!ok)
        throw new BusinessException('TACHE_INVALIDE', 'Cette tâche n’appartient pas au chantier.');
    }

    const deja = await this.prisma.pointage.aggregate({
      where: { sousTraitantId, date: jour, statut: { not: 'REFUSE' } },
      _sum: { heures: true },
    });
    assertTotalJour(num(deja._sum.heures), dto.heures);

    const created = await this.prisma.pointage.create({
      data: {
        companyId: user.companyId,
        sousTraitantId,
        chantierId: chantier.id,
        tacheId: dto.tacheId ?? null,
        date: jour,
        heures: dto.heures,
        commentaire: dto.commentaire ?? null,
        saisiParId: user.id,
      },
      include: INCLUDE,
    });

    // To validate: the chef of the job site, or the office when there is none
    const input = {
      type: 'POINTAGE_A_VALIDER',
      titre: 'Heures à valider',
      message: `${created.sousTraitant.nom} : ${dto.heures} h le ${jour.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} sur ${chantier.reference}.`,
      lien: '/pointages',
    };
    if (chantier.chefChantierId)
      await this.notifications.notifyUsers(user.companyId, [chantier.chefChantierId], input);
    else await this.notifications.notifyRoles(user.companyId, [Role.ADMIN, Role.ASSISTANTE], input);
    return created;
  }

  /** Only what has not been validated yet (a validated day is corrected by the office). */
  async supprimerMien(user: AuthUser, id: number): Promise<void> {
    const sousTraitantId = await this.monDossier(user);
    const p = await this.prisma.pointage.findFirst({ where: { id, sousTraitantId } });
    if (!p) throw new NotFoundException(`Pointage #${id} introuvable`);
    if (p.statut === 'VALIDE')
      throw new BusinessException(
        'POINTAGE_VALIDE',
        'Ce pointage est déjà validé : demandez à l’entreprise de le corriger.',
      );
    await this.prisma.pointage.delete({ where: { id } });
  }

  // ── office and chef ─────────────────────────────────────────────────────

  async findAll(user: AuthUser, q: QueryPointagesDto) {
    const where: Prisma.PointageWhereInput = {
      AND: [
        this.scope(user),
        {
          statut: q.statut,
          chantierId: q.chantierId,
          sousTraitantId: q.sousTraitantId,
          ...(q.du || q.au
            ? {
                date: {
                  ...(q.du ? { gte: jourUtc(q.du) } : {}),
                  ...(q.au ? { lte: jourUtc(q.au) } : {}),
                },
              }
            : {}),
        },
      ],
    };
    const [data, total, sums] = await this.prisma.$transaction([
      this.prisma.pointage.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        ...toSkipTake(q),
      }),
      this.prisma.pointage.count({ where }),
      this.prisma.pointage.groupBy({
        by: ['statut'],
        where,
        _sum: { heures: true },
        orderBy: { statut: 'asc' },
      }),
    ]);
    const heures = (s: string) => num(sums.find((x) => x.statut === s)?._sum?.heures ?? null);
    return {
      ...paginate(data, total, q),
      totaux: { valide: heures('VALIDE'), soumis: heures('SOUMIS'), refuse: heures('REFUSE') },
    };
  }

  /** Hours per job site for one sous-traitant (his record). */
  async resume(user: AuthUser, sousTraitantId: number) {
    const rows = await this.prisma.pointage.groupBy({
      by: ['chantierId', 'statut'],
      where: { AND: [this.scope(user), { sousTraitantId, statut: { not: 'REFUSE' } }] },
      _sum: { heures: true },
      orderBy: { chantierId: 'asc' },
    });
    const ids = [...new Set(rows.map((r) => r.chantierId))];
    const chantiers = await this.prisma.chantier.findMany({
      where: { id: { in: ids } },
      select: { id: true, reference: true },
    });
    return chantiers.map((c) => ({
      chantier: c,
      valide: num(
        rows.find((r) => r.chantierId === c.id && r.statut === 'VALIDE')?._sum?.heures ?? null,
      ),
      soumis: num(
        rows.find((r) => r.chantierId === c.id && r.statut === 'SOUMIS')?._sum?.heures ?? null,
      ),
    }));
  }

  /** Several at once (the usual case: a week checked by the chef). Only those still pending. */
  async valider(user: AuthUser, ids: number[]) {
    const { count } = await this.prisma.pointage.updateMany({
      where: { AND: [this.scope(user), { id: { in: ids }, statut: 'SOUMIS' }] },
      data: { statut: 'VALIDE', valideParId: user.id, valideLe: new Date(), motifRefus: null },
    });
    return { valides: count };
  }

  async refuser(user: AuthUser, id: number, dto: RefuserPointageDto) {
    const p = await this.prisma.pointage.findFirst({
      where: { AND: [this.scope(user), { id }] },
      include: {
        sousTraitant: { select: { userId: true } },
        chantier: { select: { reference: true } },
      },
    });
    if (!p) throw new NotFoundException(`Pointage #${id} introuvable`);
    if (p.statut !== 'SOUMIS')
      throw new BusinessException('POINTAGE_TRAITE', 'Ce pointage a déjà été traité.');
    await this.prisma.pointage.update({
      where: { id },
      data: { statut: 'REFUSE', motifRefus: dto.motif, valideParId: user.id, valideLe: new Date() },
    });
    await this.notifications.notifyUsers(user.companyId, [p.sousTraitant.userId], {
      type: 'POINTAGE_REFUSE',
      titre: 'Heures refusées',
      message: `${num(p.heures)} h le ${p.date.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} (${p.chantier.reference}) : ${dto.motif}`,
      lien: '/portail/heures',
    });
    return this.prisma.pointage.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** The chef sees the hours of HIS job sites only. */
  private scope(user: AuthUser): Prisma.PointageWhereInput {
    return user.role === Role.CHEF_CHANTIER
      ? { companyId: user.companyId, chantier: { chefChantierId: user.id } }
      : { companyId: user.companyId };
  }

  private async monDossier(user: AuthUser): Promise<number> {
    const st = await this.prisma.sousTraitant.findFirst({
      where: { userId: user.id, companyId: user.companyId },
      select: { id: true },
    });
    if (!st)
      throw new ForbiddenException(
        'Votre compte n’est pas encore lié à une fiche sous-traitant. Contactez l’entreprise.',
      );
    return st.id;
  }
}
