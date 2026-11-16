import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { DevisStatut, ChantierStatut } from '../generated/prisma/client.js';
import {
  CHANTIER_TRANSITIONS,
  DEVIS_TRANSITIONS,
  validateChantierStatusTransition,
  validateDevisStatusTransition,
} from './workflow-transitions.js';

/**
 * Définition des transitions autorisées pour les Devis
 */
export { CHANTIER_TRANSITIONS, DEVIS_TRANSITIONS } from './workflow-transitions.js';

/**
 * Définition simplifiée des transitions pour les Chantiers
 */

@Injectable()
export class WorkflowStateService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  static validateDevisStatusTransition(current: DevisStatut, next: DevisStatut) {
    validateDevisStatusTransition(current, next);
  }

  static validateChantierStatusTransition(
    current: ChantierStatut,
    next: ChantierStatut,
  ) {
    validateChantierStatusTransition(current, next);
  }

  /**
   * Valide si une transition de statut pour un Devis est autorisée.
   * Source unique de vérité pour les transitions de statut Devis (P0.5) :
   * appelée par DevisService.updateStatut au lieu d'une table dupliquée.
   */
  async validateDevisTransition(devisId: number, nextStatut: DevisStatut, companyId: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: { _count: { select: { lignes: true } } }
    });

    if (!devis) throw new BadRequestException('Devis introuvable');

    const current = devis.statut;
    WorkflowStateService.validateDevisStatusTransition(current, nextStatut);

    // P0.6 : Impossible de signer/accepter un devis sans lignes
    if ((nextStatut === 'ACCEPTE' || nextStatut === 'SIGNE') && devis._count.lignes === 0) {
      throw new BadRequestException('Impossible de valider un devis ne contenant aucune ligne.');
    }

    return devis;
  }

  async ensureDevisHasLines(devisId: number, companyId: number) {
    const devis = await this.prisma.devis.findFirst({
      where: { id: devisId, companyId },
      include: { _count: { select: { lignes: true } } },
    });
    if (!devis) throw new BadRequestException('Devis introuvable');
    if (devis._count.lignes === 0) {
      throw new BadRequestException('Impossible de signer un devis ne contenant aucune ligne.');
    }
    return devis;
  }

  /**
   * Valide si une transition de statut pour un Chantier est autorisée (P0.5).
   * Appelée par ChantiersService.update avant toute écriture de `statut`.
   */
  async validateChantierTransition(chantierId: number, nextStatut: ChantierStatut, companyId: number) {
    const chantier = await this.prisma.chantier.findFirst({
      where: { id: chantierId, companyId },
    });

    if (!chantier) throw new BadRequestException('Chantier introuvable');

    const current = chantier.statut;
    if (current === nextStatut) {
      return chantier;
    }

    WorkflowStateService.validateChantierStatusTransition(current, nextStatut);

    return chantier;
  }

  /**
   * P0.6 : Validation Métier - Empêcher la suppression d'un matériau utilisé dans un devis signé
   */
  async canDeleteMaterial(materiauId: number, companyId: number) {
    const usage = await this.prisma.ligneDevis.findFirst({
      where: {
        materiauId,
        devis: { statut: 'SIGNE', companyId }
      }
    });

    if (usage) {
      throw new ForbiddenException('Impossible de supprimer ce matériau car il est utilisé dans un devis déjà signé.');
    }
  }
}