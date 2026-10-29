import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { phoneKey } from './prospect-fields';

/**
 * Spec P0 "éviter les doublons prospects": a visitor who already is a client, or who already
 * chatted recently, is linked instead of creating a second record.
 */
@Injectable()
export class ProspectDedupService {
  constructor(private readonly prisma: PrismaService) {}

  /** Existing (non-archived) client with the same email, or the same phone whatever its formatting. */
  async findClient(
    companyId: number,
    email: string | null | undefined,
    telephone: string | null | undefined,
    db: DbClient = this.prisma,
  ) {
    if (email) {
      const byEmail = await db.client.findFirst({
        where: { companyId, archivedAt: null, email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (byEmail) return byEmail;
    }
    const key = phoneKey(telephone); // last 9 digits: "06 12…", "+33 6 12…" and "0612…" match
    if (!key) return null;
    const rows = await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM clients
      WHERE "companyId" = ${companyId} AND "archivedAt" IS NULL
        AND right(regexp_replace(coalesce(telephone, ''), '[^0-9]', '', 'g'), 9) = ${key}
      ORDER BY id LIMIT 1`;
    return rows[0] ?? null;
  }

  /** Earlier conversation of the same person still waiting (last 60 days). */
  async findSession(
    companyId: number,
    sessionId: number,
    email: string | null | undefined,
    telephone: string | null | undefined,
  ) {
    if (!email && !telephone) return null;
    const since = new Date(Date.now() - 60 * 86_400_000);
    const candidates = await this.prisma.chatSession.findMany({
      where: {
        companyId,
        id: { not: sessionId },
        createdAt: { gte: since },
        statut: { in: ['NOUVEAU', 'A_QUALIFIER'] },
        OR: [
          ...(email ? [{ clientEmail: email }] : []),
          ...(telephone ? [{ clientTelephone: telephone }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: 1,
    });
    return candidates[0] ?? null;
  }
}
