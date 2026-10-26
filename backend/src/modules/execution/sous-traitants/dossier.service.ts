import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, BusinessException, sumMoney, toDecimal } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FichiersService } from '../../core/storage/fichiers.service';
import { assertDateRange } from '../chantiers/tache-rules';
import { assuranceStatut, noteGlobale } from './assurance-status';
import { CreateAssuranceDto, CreateDisponibiliteDto, CreateNotationDto, CreatePaiementDto, UpdateAssuranceDto, UpdatePaiementDto } from './dto/sous-traitants.dto';
import { SousTraitantsService } from './sous-traitants.service';

/** Insurance certificates, payments, availability and ratings of a sous-traitant. */
@Injectable()
export class DossierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sousTraitants: SousTraitantsService,
    private readonly fichiers: FichiersService,
  ) {}

  // ── assurances (status always derived from the date) ────────────────────

  async addAssurance(user: AuthUser, stId: number, dto: CreateAssuranceDto) {
    await this.sousTraitants.assertExists(user, stId);
    if (dto.fichierId) await this.fichiers.assertAttachable(user, dto.fichierId);
    const dateExpiration = new Date(dto.dateExpiration);
    return this.prisma.assuranceSousTraitant.create({
      data: { ...dto, dateExpiration, statut: assuranceStatut(dateExpiration), companyId: user.companyId, sousTraitantId: stId },
    });
  }

  async updateAssurance(user: AuthUser, stId: number, id: number, dto: UpdateAssuranceDto) {
    await this.findChild('assuranceSousTraitant', user, stId, id);
    if (dto.fichierId) await this.fichiers.assertAttachable(user, dto.fichierId);
    const dateExpiration = dto.dateExpiration ? new Date(dto.dateExpiration) : undefined;
    return this.prisma.assuranceSousTraitant.update({
      where: { id },
      // Renewal (new date) resets the status — the old code never did
      data: { ...dto, ...(dateExpiration && { dateExpiration, statut: assuranceStatut(dateExpiration) }) },
    });
  }

  async removeAssurance(user: AuthUser, stId: number, id: number) {
    await this.findChild('assuranceSousTraitant', user, stId, id);
    await this.prisma.assuranceSousTraitant.delete({ where: { id } });
  }

  // ── paiements ───────────────────────────────────────────────────────────

  async addPaiement(user: AuthUser, stId: number, dto: CreatePaiementDto) {
    await this.sousTraitants.assertExists(user, stId);
    await this.assertPaiement(user, stId, {
      contratId: dto.contratId ?? null,
      montantHT: dto.montantHT,
      montantTTC: dto.montantTTC,
      statut: dto.statut ?? 'REGLE',
    });
    return this.prisma.paiementSousTraitant.create({
      data: { ...dto, datePaiement: new Date(dto.datePaiement), companyId: user.companyId, sousTraitantId: stId },
    });
  }

  /** Every field can be corrected (report of 20/10); the same checks as a new payment apply. */
  async updatePaiement(user: AuthUser, stId: number, id: number, dto: UpdatePaiementDto) {
    await this.findChild('paiementSousTraitant', user, stId, id);
    const current = await this.prisma.paiementSousTraitant.findUniqueOrThrow({ where: { id } });
    await this.assertPaiement(
      user,
      stId,
      {
        contratId: dto.contratId !== undefined ? dto.contratId : current.contratId,
        montantHT: dto.montantHT ?? current.montantHT.toNumber(),
        montantTTC: dto.montantTTC ?? current.montantTTC.toNumber(),
        statut: dto.statut ?? current.statut,
      },
      id,
    );
    return this.prisma.paiementSousTraitant.update({
      where: { id },
      data: { ...dto, ...(dto.datePaiement && { datePaiement: new Date(dto.datePaiement) }) },
    });
  }

  /** A payment entered by mistake disappears (an executed payment is better marked ANNULE). */
  async removePaiement(user: AuthUser, stId: number, id: number) {
    await this.findChild('paiementSousTraitant', user, stId, id);
    await this.prisma.paiementSousTraitant.delete({ where: { id } });
  }

  /** TTC ≥ HT, and the contract (if any) is never paid beyond its amount — `ignoreId` = the payment being edited. */
  private async assertPaiement(
    user: AuthUser,
    stId: number,
    p: { contratId: number | null; montantHT: number; montantTTC: number; statut: string },
    ignoreId?: number,
  ) {
    if (p.montantTTC < p.montantHT) {
      throw new BusinessException('MONTANTS_INCOHERENTS', 'Le montant TTC ne peut pas être inférieur au HT.');
    }
    if (!p.contratId) return;
    const contrat = await this.prisma.contratSousTraitant.findFirst({
      where: { id: p.contratId, sousTraitantId: stId, companyId: user.companyId },
      include: {
        paiements: { where: { statut: { not: 'ANNULE' }, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { montantHT: true } },
      },
    });
    if (!contrat) throw new BusinessException('CONTRAT_INVALIDE', 'Ce contrat n’appartient pas à ce sous-traitant.');
    if (p.statut === 'ANNULE') return;
    const dejaPaye = sumMoney(contrat.paiements.map((x) => x.montantHT));
    if (dejaPaye.plus(p.montantHT).gt(contrat.montantHT)) {
      throw new BusinessException(
        'PAIEMENT_SUPERIEUR_AU_CONTRAT',
        `Dépassement du contrat : ${dejaPaye.toString()} € HT déjà réglés sur ${contrat.montantHT.toString()} € HT.`,
      );
    }
  }

  // ── disponibilités ──────────────────────────────────────────────────────

  async addDisponibilite(user: AuthUser, stId: number, dto: CreateDisponibiliteDto) {
    await this.sousTraitants.assertExists(user, stId);
    assertDateRange(dto.dateDebut, dto.dateFin);
    return this.prisma.disponibiliteSousTraitant.create({
      data: { ...dto, dateDebut: new Date(dto.dateDebut), dateFin: new Date(dto.dateFin), companyId: user.companyId, sousTraitantId: stId },
    });
  }

  async removeDisponibilite(user: AuthUser, stId: number, id: number) {
    await this.findChild('disponibiliteSousTraitant', user, stId, id);
    await this.prisma.disponibiliteSousTraitant.delete({ where: { id } });
  }

  // ── notations ───────────────────────────────────────────────────────────

  async addNotation(user: AuthUser, stId: number, dto: CreateNotationDto) {
    await this.sousTraitants.assertExists(user, stId);
    if (dto.chantierId) {
      const ok = await this.prisma.chantier.count({ where: { id: dto.chantierId, companyId: user.companyId } });
      if (!ok) throw new BusinessException('CHANTIER_INTROUVABLE', 'Chantier introuvable.');
    }
    // One rating per sous-traitant and job site -> P2002 -> 409
    return this.prisma.notationSousTraitant.create({
      data: {
        ...dto,
        noteGlobale: toDecimal(noteGlobale(dto.noteQualite, dto.noteDelai, dto.noteCommunication)),
        companyId: user.companyId,
        sousTraitantId: stId,
      },
    });
  }

  async removeNotation(user: AuthUser, stId: number, id: number) {
    await this.findChild('notationSousTraitant', user, stId, id);
    await this.prisma.notationSousTraitant.delete({ where: { id } });
  }

  private async findChild(
    model: 'assuranceSousTraitant' | 'paiementSousTraitant' | 'disponibiliteSousTraitant' | 'notationSousTraitant',
    user: AuthUser,
    sousTraitantId: number,
    id: number,
  ) {
    const where = { id, sousTraitantId, companyId: user.companyId };
    // Each delegate has the same shape for this query
    const delegate = this.prisma[model] as unknown as { count(args: { where: typeof where }): Promise<number> };
    if (!(await delegate.count({ where }))) throw new NotFoundException(`Élément #${id} introuvable pour ce sous-traitant`);
  }
}
