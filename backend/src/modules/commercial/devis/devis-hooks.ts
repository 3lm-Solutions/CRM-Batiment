import { Injectable } from '@nestjs/common';
import type { DbClient } from '../../../prisma/prisma.types';
import type { DevisRow } from './devis.service';

/**
 * Extension points run INSIDE the quote's transaction, so the side effects are all-or-nothing
 * with the status change (P0.2–P0.4).
 *
 * The quote module defines them; the workflow module (a layer above) registers the handlers
 * at start-up. The quote module therefore never imports chantiers, invoices or orders.
 */
export type DevisHook = (tx: DbClient, devis: DevisRow) => Promise<void>;

@Injectable()
export class DevisHooks {
  private readonly accepted: DevisHook[] = [];
  private readonly signed: DevisHook[] = [];

  onAccepted(hook: DevisHook): void {
    this.accepted.push(hook);
  }

  onSigned(hook: DevisHook): void {
    this.signed.push(hook);
  }

  async runAccepted(tx: DbClient, devis: DevisRow): Promise<void> {
    for (const hook of this.accepted) await hook(tx, devis);
  }

  async runSigned(tx: DbClient, devis: DevisRow): Promise<void> {
    for (const hook of this.signed) await hook(tx, devis);
  }
}
