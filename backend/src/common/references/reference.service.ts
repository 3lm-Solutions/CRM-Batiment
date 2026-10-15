import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DbClient } from '../../prisma/prisma.types';

/** Document prefixes — same formats as the old project (DEV-2026-0001, CH-…, FAC-…). */
export const ReferencePrefix = {
  DEMANDE: 'DEM',
  DEVIS: 'DEV',
  CHANTIER: 'CH',
  FACTURE: 'FAC',
  COMMANDE_FOURNISSEUR: 'CMD',
  BON_COMMANDE: 'BC',
  SAV: 'SAV',
  CONTRAT_SOUS_TRAITANT: 'CST',
} as const;
export type ReferencePrefix = (typeof ReferencePrefix)[keyof typeof ReferencePrefix];

export function formatReference(prefix: string, year: number, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
}

/**
 * Generates unique, sequential references.
 *
 * Old approach (copied in 6 services): read the last reference, add 1, insert.
 * Two simultaneous creations read the same "last" and collide (P2002), and
 * `count + 1` in the seed reused numbers after deletions.
 *
 * New approach: one atomic INSERT … ON CONFLICT … RETURNING on a counter row.
 * PostgreSQL locks the row, so concurrent calls get 1, 2, 3… — never twice the same.
 * Pass the transaction client as `db` so a rollback also releases the number.
 */
@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(
    prefix: ReferencePrefix,
    companyId: number,
    db: DbClient = this.prisma,
    date: Date = new Date(),
  ): Promise<string> {
    const year = date.getFullYear();

    const rows = await db.$queryRaw<{ value: number }[]>`
      INSERT INTO "reference_counters" ("companyId", "prefix", "year", "value")
      VALUES (${companyId}, ${prefix}, ${year}, 1)
      ON CONFLICT ("companyId", "prefix", "year")
      DO UPDATE SET "value" = "reference_counters"."value" + 1
      RETURNING "value"`;

    return formatReference(prefix, year, Number(rows[0].value));
  }
}
