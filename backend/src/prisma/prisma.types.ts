import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from './prisma.service';

/**
 * A client usable both outside and inside a transaction.
 *
 * Domain services take `db: DbClient = this.prisma` as their last parameter, so the
 * workflow orchestrator (Step 7) can pass its transaction client and make
 * "devis signé → chantier + acompte + commandes" all-or-nothing.
 */
export type DbClient = PrismaService | Prisma.TransactionClient;
