import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { DbClient } from '../../prisma/prisma.types';
import { DevisHooks } from '../commercial/devis/devis-hooks';
import type { DevisRow } from '../commercial/devis/devis.service';
import { ChantiersService } from '../execution/chantiers/chantiers.service';
import { CommandesService } from '../finance/commandes-fournisseur/commandes.service';
import { FacturesService } from '../finance/factures/factures.service';

/**
 * The automated chain of the spec (P0.2 → P0.4), wired at start-up:
 *
 *   ACCEPTE → supplier orders (CREEE), grouped by supplier            (P0.4)
 *   SIGNE   → job site (PLANIFIE) + deposit invoice (BROUILLON, 35 %)  (P0.2, P0.3)
 *             + supplier orders if the quote went straight to SIGNE (verbal agreement)
 *
 * Every handler runs inside the quote's transaction and is idempotent.
 */
@Injectable()
export class DevisWorkflowService implements OnModuleInit {
  private readonly logger = new Logger(DevisWorkflowService.name);

  constructor(
    private readonly hooks: DevisHooks,
    private readonly chantiers: ChantiersService,
    private readonly factures: FacturesService,
    private readonly commandes: CommandesService,
  ) {}

  onModuleInit(): void {
    this.hooks.onAccepted((tx, devis) => this.onAccepted(tx, devis));
    this.hooks.onSigned((tx, devis) => this.onSigned(tx, devis));
  }

  async onAccepted(tx: DbClient, devis: DevisRow): Promise<void> {
    const { created } = await this.commandes.createFromDevis(tx, devis);
    this.logger.log(
      `Devis ${devis.reference} accepté : ${created} commande(s) fournisseur créée(s)`,
    );
  }

  async onSigned(tx: DbClient, devis: DevisRow): Promise<void> {
    // Signed totals are read again inside the transaction (the row passed in predates the update)
    const current = await tx.devis.findUniqueOrThrow({
      where: { id: devis.id },
      include: { client: { select: { adresseChantier: true, adresseClient: true } } },
    });
    await this.commandes.createFromDevis(tx, current); // no-op if already created at ACCEPTE
    const chantierId = await this.chantiers.createFromDevis(tx, current);
    const factureId = await this.factures.createAcompte(tx, current);
    this.logger.log(
      `Devis ${devis.reference} signé : chantier #${chantierId}, acompte #${factureId ?? '—'}`,
    );
  }
}
