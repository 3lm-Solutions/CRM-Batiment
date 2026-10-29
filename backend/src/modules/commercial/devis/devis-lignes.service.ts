import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AuthUser, BusinessException, roundMoney, toDecimal } from '../../../common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { PricingService } from '../../referentiel/catalogue/pricing/pricing.service';
import { computeLine } from './devis.calculator';
import { DevisEvents, type DevisPriceChangedEvent } from './devis.events';
import { DevisService } from './devis.service';
import { assertEditable } from './devis-status';
import { ReordonnerLignesDto } from './dto/devis.dto';
import { AddLigneDto, UpdateLigneDto } from './dto/lignes.dto';

interface UnitPrices {
  prixUnitaireVente: Prisma.Decimal;
  prixAchat: Prisma.Decimal;
  mainOeuvre: Prisma.Decimal;
}

/**
 * Quote lines. Every write: checks the quote is editable, writes the line, recomputes the
 * quote totals — all in ONE transaction, so totals can never drift from the lines.
 */
@Injectable()
export class DevisLignesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devis: DevisService,
    private readonly pricing: PricingService,
    private readonly events: EventEmitter2,
  ) {}

  async add(user: AuthUser, devisId: number, dto: AddLigneDto) {
    return this.addMany(user, devisId, [dto]);
  }

  /**
   * Several lines in ONE transaction (used by the quote assistant, Step 15): either every line
   * is added or none. Prices are computed BEFORE the transaction (pricing reads the catalogue).
   */
  async addMany(user: AuthUser, devisId: number, dtos: AddLigneDto[]) {
    const prepared: Omit<Prisma.LigneDevisCreateManyInput, 'devisId' | 'ordre'>[] = [];
    for (const dto of dtos) prepared.push(await this.prepare(user, dto));

    await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, devisId, tx);
      assertEditable(devis.statut);
      const first = await tx.ligneDevis.count({ where: { devisId } });
      await tx.ligneDevis.createMany({
        data: prepared.map((data, i) => ({ ...data, devisId, ordre: first + i })),
      });
      await this.devis.recalculate(tx, devisId);
    });
    return this.devis.findOne(user, devisId);
  }

  /** Validates one line and computes its prices (catalogue or free line). */
  private async prepare(
    user: AuthUser,
    dto: AddLigneDto,
  ): Promise<Omit<Prisma.LigneDevisCreateManyInput, 'devisId' | 'ordre'>> {
    const fromCatalogue = dto.prestationId
      ? await this.priceFromCatalogue(user, dto.prestationId, dto.choixIds)
      : null;

    if (!fromCatalogue) {
      if (!dto.description) {
        throw new BusinessException(
          'LIGNE_INCOMPLETE',
          'Une ligne libre doit avoir une description.',
        );
      }
      if (dto.prixUnitaireVente === undefined) {
        throw new BusinessException(
          'LIGNE_INCOMPLETE',
          'Une ligne libre doit avoir un prix de vente.',
        );
      }
      await this.assertComponent(user, dto);
    }

    const unit: UnitPrices = {
      prixUnitaireVente: toDecimal(dto.prixUnitaireVente ?? fromCatalogue!.unit.prixUnitaireVente),
      prixAchat: toDecimal(dto.prixAchat ?? fromCatalogue?.unit.prixAchat ?? 0),
      mainOeuvre: toDecimal(dto.mainOeuvre ?? fromCatalogue?.unit.mainOeuvre ?? 0),
    };

    return {
      prestationId: dto.prestationId,
      materiauId: dto.materiauId,
      serviceMainOeuvreId: dto.serviceMainOeuvreId,
      description: dto.description ?? fromCatalogue?.description,
      optionsChoisies: fromCatalogue
        ? (fromCatalogue.choix as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      quantite: dto.quantite,
      unite: dto.unite ?? fromCatalogue?.unite,
      dimension: dto.dimension,
      couleur: dto.couleur,
      finition: dto.finition,
      ...unit,
      ...computeLine({ quantite: dto.quantite, ...unit }),
    };
  }

  async update(user: AuthUser, devisId: number, ligneId: number, dto: UpdateLigneDto) {
    const ligne = await this.findLigne(user, devisId, ligneId);

    // Changing the choices of a catalogue line re-prices its costs (and the suggested price,
    // unless a sale price is given explicitly)
    let repriced: Awaited<ReturnType<DevisLignesService['priceFromCatalogue']>> | null = null;
    if (dto.choixIds !== undefined) {
      if (!ligne.prestationId) {
        throw new BusinessException('LIGNE_LIBRE', 'Une ligne libre n’a pas de choix d’options.');
      }
      repriced = await this.priceFromCatalogue(user, ligne.prestationId, dto.choixIds);
    }

    const unit: UnitPrices = {
      prixUnitaireVente: toDecimal(
        dto.prixUnitaireVente ?? repriced?.unit.prixUnitaireVente ?? ligne.prixUnitaireVente,
      ),
      prixAchat: toDecimal(dto.prixAchat ?? repriced?.unit.prixAchat ?? ligne.prixAchat),
      mainOeuvre: toDecimal(dto.mainOeuvre ?? repriced?.unit.mainOeuvre ?? ligne.mainOeuvre),
    };
    const quantite = dto.quantite ?? ligne.quantite;
    const { choixIds: _choixIds, ...fields } = dto;

    const reference = await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, devisId, tx);
      assertEditable(devis.statut);
      await tx.ligneDevis.update({
        where: { id: ligneId },
        data: {
          ...fields,
          ...(repriced && { optionsChoisies: repriced.choix as unknown as Prisma.InputJsonValue }),
          ...unit,
          ...computeLine({ quantite, ...unit }),
        },
      });
      await this.devis.recalculate(tx, devisId);
      return devis.reference;
    });

    // Manual price change → price history (audit, Step 10)
    if (
      dto.prixUnitaireVente !== undefined &&
      !ligne.prixUnitaireVente.equals(dto.prixUnitaireVente)
    ) {
      this.events.emit(DevisEvents.PRIX_MODIFIE, {
        companyId: user.companyId,
        devisId,
        reference,
        userId: user.id,
        at: new Date(),
        ligneId,
        libelle: ligne.description ?? `Ligne #${ligneId}`,
        ancienPrix: ligne.prixUnitaireVente.toNumber(),
        nouveauPrix: dto.prixUnitaireVente,
      } satisfies DevisPriceChangedEvent);
    }
    return this.devis.findOne(user, devisId);
  }

  async remove(user: AuthUser, devisId: number, ligneId: number) {
    await this.findLigne(user, devisId, ligneId);
    await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, devisId, tx);
      assertEditable(devis.statut);
      await tx.ligneDevis.delete({ where: { id: ligneId } });
      await this.devis.recalculate(tx, devisId);
    });
    return this.devis.findOne(user, devisId);
  }

  async reorder(user: AuthUser, devisId: number, dto: ReordonnerLignesDto) {
    await this.prisma.$transaction(async (tx) => {
      const devis = await this.devis.getForUpdate(user.companyId, devisId, tx);
      assertEditable(devis.statut);
      const existing = await tx.ligneDevis.findMany({ where: { devisId }, select: { id: true } });
      const ids = new Set(existing.map((l) => l.id));
      if (ids.size !== dto.ligneIds.length || !dto.ligneIds.every((id) => ids.has(id))) {
        throw new BusinessException(
          'ORDRE_INCOMPLET',
          'La liste doit contenir exactement toutes les lignes du devis.',
        );
      }
      await Promise.all(
        dto.ligneIds.map((id, ordre) => tx.ligneDevis.update({ where: { id }, data: { ordre } })),
      );
    });
    return this.devis.findOne(user, devisId);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /**
   * Unit costs from the pricing engine: total cost / quantity. Priced on a quantity of 1,
   * since unit costs do not depend on the quantity.
   */
  private async priceFromCatalogue(user: AuthUser, prestationId: number, choixIds: number[] = []) {
    const { prestation, choix, result } = await this.pricing.price(user, prestationId, {
      quantite: 1,
      choixIds,
    });
    const suffix = choix.length ? ` (${choix.map((c) => c.choixNom).join(', ')})` : '';
    return {
      description: `${prestation.nom}${suffix}`,
      unite: prestation.unite,
      choix,
      unit: {
        prixUnitaireVente: result.prixVenteSuggereUnite,
        prixAchat: roundMoney(result.coutMateriaux),
        mainOeuvre: roundMoney(result.coutMainOeuvre),
      },
    };
  }

  private async assertComponent(user: AuthUser, dto: AddLigneDto): Promise<void> {
    if (dto.materiauId) {
      const ok = await this.prisma.materiau.count({
        where: { id: dto.materiauId, companyId: user.companyId, actif: true },
      });
      if (!ok)
        throw new BusinessException(
          'COMPOSANT_INTROUVABLE',
          `Matériau #${dto.materiauId} introuvable ou inactif.`,
        );
    }
    if (dto.serviceMainOeuvreId) {
      const ok = await this.prisma.serviceMainOeuvre.count({
        where: { id: dto.serviceMainOeuvreId, companyId: user.companyId, actif: true },
      });
      if (!ok)
        throw new BusinessException(
          'COMPOSANT_INTROUVABLE',
          `Service #${dto.serviceMainOeuvreId} introuvable ou inactif.`,
        );
    }
  }

  private async findLigne(
    user: AuthUser,
    devisId: number,
    ligneId: number,
    db: DbClient = this.prisma,
  ) {
    const ligne = await db.ligneDevis.findFirst({
      where: { id: ligneId, devisId, devis: { companyId: user.companyId } },
    });
    if (!ligne) throw new NotFoundException(`Ligne #${ligneId} introuvable sur ce devis`);
    return ligne;
  }
}
