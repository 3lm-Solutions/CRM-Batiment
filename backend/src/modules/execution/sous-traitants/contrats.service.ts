import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, ReferencePrefix, ReferenceService } from '../../../common';
import { ContratSousTraitantStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertDateRange } from '../chantiers/tache-rules';
import { ContratMachine } from './contrat-status';
import { CreateContratDto, UpdateContratDto } from './dto/sous-traitants.dto';

@Injectable()
export class ContratsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly references: ReferenceService,
  ) {}

  findAll(user: AuthUser, filters: { sousTraitantId?: number; chantierId?: number }) {
    return this.prisma.contratSousTraitant.findMany({
      where: { companyId: user.companyId, ...filters },
      orderBy: { createdAt: 'desc' },
      include: {
        sousTraitant: { select: { id: true, nom: true } },
        chantier: { select: { id: true, reference: true } },
        paiements: { select: { montantHT: true, statut: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateContratDto) {
    assertDateRange(dto.dateDebut, dto.dateFin);
    const [st, chantier] = await Promise.all([
      this.prisma.sousTraitant.findFirst({ where: { id: dto.sousTraitantId, companyId: user.companyId } }),
      this.prisma.chantier.count({ where: { id: dto.chantierId, companyId: user.companyId } }),
    ]);
    if (!st) throw new BusinessException('SOUS_TRAITANT_INTROUVABLE', 'Sous-traitant introuvable.');
    if (st.statut !== 'ACTIF') throw new BusinessException('SOUS_TRAITANT_INACTIF', 'Ce sous-traitant n’est pas actif.');
    if (!chantier) throw new BusinessException('CHANTIER_INTROUVABLE', 'Chantier introuvable.');

    return this.prisma.$transaction(async (tx) =>
      tx.contratSousTraitant.create({
        data: { ...dto, companyId: user.companyId, reference: await this.references.next(ReferencePrefix.CONTRAT_SOUS_TRAITANT, user.companyId, tx) },
      }),
    );
  }

  async update(user: AuthUser, id: number, dto: UpdateContratDto) {
    const contrat = await this.find(user, id);
    if (contrat.statut !== 'BROUILLON') throw new BusinessException('CONTRAT_ACTIF', 'Seul un contrat en brouillon se modifie.');
    assertDateRange(dto.dateDebut ?? contrat.dateDebut, dto.dateFin ?? contrat.dateFin);
    return this.prisma.contratSousTraitant.update({ where: { id }, data: dto });
  }

  /**
   * activer / terminer / resilier.
   * Activation requires a valid (non-expired) DECENNALE: a sous-traitant without its ten-year
   * insurance must not start work on a job site.
   */
  async transition(user: AuthUser, id: number, to: ContratSousTraitantStatut) {
    const contrat = await this.find(user, id);
    ContratMachine.assert(contrat.statut, to);

    if (to === 'ACTIF') {
      const decennale = await this.prisma.assuranceSousTraitant.count({
        where: { sousTraitantId: contrat.sousTraitantId, typeAssurance: 'DECENNALE', dateExpiration: { gt: new Date() } },
      });
      if (!decennale) {
        throw new BusinessException('DECENNALE_MANQUANTE', 'Activation impossible : aucune assurance décennale en cours de validité.');
      }
    }

    const { count } = await this.prisma.contratSousTraitant.updateMany({
      where: { id, statut: contrat.statut },
      data: { statut: to },
    });
    if (!count) throw new BusinessException('CONTRAT_MODIFIE', 'Le contrat vient de changer. Rechargez.');
    return this.find(user, id);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const contrat = await this.find(user, id);
    if (contrat.statut !== 'BROUILLON') throw new BusinessException('CONTRAT_ACTIF', 'Seul un brouillon se supprime (résiliez sinon).');
    await this.prisma.contratSousTraitant.delete({ where: { id } });
  }

  private async find(user: AuthUser, id: number) {
    const contrat = await this.prisma.contratSousTraitant.findFirst({ where: { id, companyId: user.companyId } });
    if (!contrat) throw new NotFoundException(`Contrat #${id} introuvable`);
    return contrat;
  }
}
