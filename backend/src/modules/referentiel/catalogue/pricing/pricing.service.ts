import { Injectable } from '@nestjs/common';
import { type AuthUser, BusinessException } from '../../../../common';
import { CompanyService } from '../../../core/company/company.service';
import { PrestationsService } from '../prestations/prestations.service';
import { computePricing, type PricingComponent, type PricingResult } from './pricing.calculator';
import type { ChiffrageDto } from './pricing.dto';

type PrestationDetail = Awaited<ReturnType<PrestationsService['findOne']>>;
type ComponentRow = PrestationDetail['compositions'][number];

/** Snapshot of a selected choice, stored on quote lines (LigneDevis.optionsChoisies). */
export interface ChoixSnapshot {
  optionId: number;
  optionNom: string;
  choixId: number;
  choixNom: string;
  impactPrix: number;
}

export interface DetailedPricing {
  prestation: PrestationDetail;
  choix: ChoixSnapshot[];
  result: PricingResult;
}

/** Loads a prestation + company settings, then delegates to the pure calculator. */
@Injectable()
export class PricingService {
  constructor(
    private readonly prestations: PrestationsService,
    private readonly company: CompanyService,
  ) {}

  /** HTTP-facing: the pricing result plus a short prestation header. */
  async chiffrer(
    user: AuthUser,
    prestationId: number,
    dto: ChiffrageDto,
  ): Promise<PricingResult & { prestation: object }> {
    const { prestation, result } = await this.price(user, prestationId, dto);
    return {
      prestation: { id: prestation.id, nom: prestation.nom, unite: prestation.unite },
      ...result,
    };
  }

  /** Used by quote lines: also returns the full prestation and the selected choices. */
  async price(user: AuthUser, prestationId: number, dto: ChiffrageDto): Promise<DetailedPricing> {
    const [prestation, settings] = await Promise.all([
      this.prestations.findOne(user, prestationId),
      this.company.getSettingsRecord(user.companyId),
    ]);

    if (!prestation.actif) {
      throw new BusinessException(
        'PRESTATION_INACTIVE',
        `La prestation « ${prestation.nom} » est désactivée.`,
      );
    }
    const allChoices = prestation.options.flatMap((o) =>
      o.choix.filter((c) => c.actif).map((c) => ({ ...c, optionId: o.id, optionNom: o.nom })),
    );
    const selected = (dto.choixIds ?? []).map((id) => {
      const choix = allChoices.find((c) => c.id === id);
      if (!choix) {
        throw new BusinessException(
          'CHOIX_INVALIDE',
          `Le choix #${id} n'appartient pas à cette prestation.`,
        );
      }
      return choix;
    });

    const optionIds = selected.map((c) => c.optionId);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new BusinessException('CHOIX_MULTIPLES', 'Un seul choix par option.');
    }

    const result = computePricing({
      quantite: dto.quantite,
      prixVenteMin: prestation.prixVenteMin,
      prixVenteMax: prestation.prixVenteMax,
      baseComponents: prestation.compositions.map(toComponent),
      selectedChoices: selected.map((c) => ({
        id: c.id,
        nom: c.nom,
        impactPrix: c.impactPrix,
        components: c.compositions.map(toComponent),
      })),
      settings,
    });

    return {
      prestation,
      result,
      choix: selected.map((c) => ({
        optionId: c.optionId,
        optionNom: c.optionNom,
        choixId: c.id,
        choixNom: c.nom,
        impactPrix: c.impactPrix.toNumber(),
      })),
    };
  }
}

function toComponent(row: ComponentRow): PricingComponent {
  if (row.materiau) {
    return {
      kind: 'MATERIAU',
      id: row.materiau.id,
      nom: row.materiau.nom,
      unite: row.materiau.unite,
      prixUnitaire: row.materiau.prixAchatFixe,
      quantiteParUnite: row.quantiteParUnite,
    };
  }
  if (row.serviceMainOeuvre) {
    return {
      kind: 'MAIN_OEUVRE',
      id: row.serviceMainOeuvre.id,
      nom: row.serviceMainOeuvre.nom,
      unite: row.serviceMainOeuvre.unite,
      prixUnitaire: row.serviceMainOeuvre.prixUnitaire,
      quantiteParUnite: row.quantiteParUnite,
    };
  }
  throw new BusinessException(
    'COMPOSITION_INVALIDE',
    `Composition #${row.id} sans matériau ni service.`,
  );
}
