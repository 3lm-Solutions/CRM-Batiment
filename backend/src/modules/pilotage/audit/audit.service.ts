import { Injectable, Logger } from '@nestjs/common';
import { type AuthUser, paginate, toSkipTake } from '../../../common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueryAuditDto } from './audit.dto';

export interface AuditEntry {
  companyId: number;
  userId: number | null;
  action: string;
  entite: string;
  entiteId: number;
  ancienneValeur?: Prisma.InputJsonValue;
  nouvelleValeur?: Prisma.InputJsonValue;
}

/** Append-only history ("Historique des modifications", spec Audit P0). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: a failing audit write must not break the business action that triggered it. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (error) {
      this.logger.error(
        `Audit non enregistré (${entry.action} ${entry.entite}#${entry.entiteId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(user: AuthUser, query: QueryAuditDto) {
    const where: Prisma.AuditLogWhereInput = {
      companyId: user.companyId,
      entite: query.entite,
      entiteId: query.entiteId,
      action: query.action,
      userId: query.userId,
      createdAt:
        query.du || query.au
          ? {
              gte: query.du ? new Date(query.du) : undefined,
              lte: query.au ? new Date(query.au) : undefined,
            }
          : undefined,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nom: true, prenom: true } } },
        ...toSkipTake(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, query);
  }
}
