import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, paginate, toSkipTake } from '../../../common';
import { Prisma, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSousTraitantDto,
  LierCompteDto,
  QuerySousTraitantsDto,
  UpdateSousTraitantDto,
} from './dto/sous-traitants.dto';

/** The sous-traitant company record (Step 11 adds the portal view for its own account). */
@Injectable()
export class SousTraitantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: QuerySousTraitantsDto) {
    const where: Prisma.SousTraitantWhereInput = {
      companyId: user.companyId,
      statut: query.statut,
      ...(query.search && {
        OR: [
          { nom: { contains: query.search, mode: 'insensitive' } },
          { specialite: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sousTraitant.findMany({
        where,
        orderBy: { nom: 'asc' },
        include: {
          assurances: { select: { typeAssurance: true, statut: true, dateExpiration: true } },
          notations: { select: { noteGlobale: true } },
          _count: { select: { contrats: true } },
        },
        ...toSkipTake(query),
      }),
      this.prisma.sousTraitant.count({ where }),
    ]);
    const data = rows.map(({ notations, assurances, ...st }) => ({
      ...st,
      noteMoyenne: notations.length
        ? Math.round(
            (notations.reduce((s, n) => s + n.noteGlobale.toNumber(), 0) / notations.length) * 100,
          ) / 100
        : null,
      assurancesAlerte: assurances.filter((a) => a.statut !== 'VALIDE'),
    }));
    return paginate(data, total, query);
  }

  async findOne(user: AuthUser, id: number) {
    const st = await this.prisma.sousTraitant.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        utilisateur: { select: { id: true, email: true, actif: true } },
        contrats: {
          orderBy: { createdAt: 'desc' },
          include: { chantier: { select: { id: true, reference: true } } },
        },
        assurances: { orderBy: { dateExpiration: 'asc' } },
        paiements: { orderBy: { datePaiement: 'desc' } },
        disponibilites: { orderBy: { dateDebut: 'asc' }, where: { dateFin: { gte: new Date() } } },
        notations: {
          orderBy: { createdAt: 'desc' },
          include: { chantier: { select: { id: true, reference: true } } },
        },
      },
    });
    if (!st) throw new NotFoundException(`Sous-traitant #${id} introuvable`);
    return st;
  }

  async assertExists(user: AuthUser, id: number) {
    const st = await this.prisma.sousTraitant.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!st) throw new NotFoundException(`Sous-traitant #${id} introuvable`);
    return st;
  }

  /** Can be created straight from an existing SOUS_TRAITANT account (decision F1 of 20/10). */
  async create(user: AuthUser, dto: CreateSousTraitantDto) {
    if (dto.userId) await this.assertCompteLibre(user, dto.userId);
    // Same SIRET twice in the company -> P2002 -> 409
    return this.prisma.sousTraitant.create({ data: { ...dto, companyId: user.companyId } });
  }

  async update(user: AuthUser, id: number, dto: UpdateSousTraitantDto) {
    await this.assertExists(user, id);
    return this.prisma.sousTraitant.update({ where: { id }, data: dto });
  }

  /** Links (or unlinks) the portal login of this sous-traitant. */
  async lierCompte(user: AuthUser, id: number, dto: LierCompteDto) {
    await this.assertExists(user, id);
    if (dto.userId) await this.assertCompteLibre(user, dto.userId, id);
    return this.prisma.sousTraitant.update({ where: { id }, data: { userId: dto.userId } });
  }

  /** A SOUS_TRAITANT account of the company, not yet linked to another record (clear message instead of a 409). */
  private async assertCompteLibre(user: AuthUser, userId: number, sousTraitantId?: number) {
    const account = await this.prisma.user.count({
      where: { id: userId, companyId: user.companyId, role: Role.SOUS_TRAITANT },
    });
    if (!account)
      throw new BusinessException('COMPTE_INVALIDE', 'Le compte doit avoir le rôle SOUS_TRAITANT.');
    const other = await this.prisma.sousTraitant.findFirst({
      where: { userId, ...(sousTraitantId ? { NOT: { id: sousTraitantId } } : {}) },
      select: { nom: true },
    });
    if (other)
      throw new BusinessException(
        'COMPTE_DEJA_LIE',
        `Ce compte est déjà lié au sous-traitant « ${other.nom} ». Déliez-le d’abord.`,
      );
  }

  /** Only without history; otherwise set statut INACTIF. */
  async remove(user: AuthUser, id: number): Promise<void> {
    await this.assertExists(user, id);
    const [contrats, paiements] = await Promise.all([
      this.prisma.contratSousTraitant.count({ where: { sousTraitantId: id } }),
      this.prisma.paiementSousTraitant.count({ where: { sousTraitantId: id } }),
    ]);
    if (contrats || paiements) {
      throw new BusinessException(
        'SOUS_TRAITANT_AVEC_HISTORIQUE',
        'Ce sous-traitant a des contrats ou des paiements : supprimez-les d’abord (un contrat brouillon ou résilié, sans paiement, se supprime) ou passez-le INACTIF.',
      );
    }
    await this.prisma.sousTraitant.delete({ where: { id } });
  }
}
