import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { AssuranceStatut } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RENEWAL_WARNING_DAYS } from './assurance-status';
import { type AssuranceStatutEvent, SousTraitantEvents } from './sous-traitants.events';

/**
 * Daily: re-derive every insurance status from its date, and emit an event for each insurance
 * that just became A_RENOUVELER or EXPIREE (Step 10 turns them into notifications).
 * Three set-based updates instead of the old row-by-row loop.
 */
@Injectable()
export class AssurancesAlertService {
  private readonly logger = new Logger(AssurancesAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'Europe/Paris' })
  async run(now: Date = new Date()): Promise<{ expirees: number; aRenouveler: number }> {
    const limit = new Date(now.getTime() + RENEWAL_WARNING_DAYS * 86_400_000);

    const changing = async (statut: AssuranceStatut, dateFilter: { lte?: Date; gt?: Date }) => {
      const rows = await this.prisma.assuranceSousTraitant.findMany({
        where: { statut: { not: statut }, dateExpiration: dateFilter },
        include: { sousTraitant: { select: { nom: true } } },
      });
      if (rows.length) {
        await this.prisma.assuranceSousTraitant.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { statut } });
      }
      return rows;
    };

    const expirees = await changing('EXPIREE', { lte: now });
    const aRenouveler = await changing('A_RENOUVELER', { gt: now, lte: limit });
    await this.prisma.assuranceSousTraitant.updateMany({
      where: { statut: { not: 'VALIDE' }, dateExpiration: { gt: limit } },
      data: { statut: 'VALIDE' },
    });

    for (const [rows, statut] of [[expirees, 'EXPIREE'], [aRenouveler, 'A_RENOUVELER']] as const) {
      for (const a of rows) {
        this.events.emit(SousTraitantEvents.ASSURANCE_STATUT, {
          companyId: a.companyId,
          assuranceId: a.id,
          sousTraitantId: a.sousTraitantId,
          sousTraitantNom: a.sousTraitant.nom,
          typeAssurance: a.typeAssurance,
          statut,
          dateExpiration: a.dateExpiration,
        } satisfies AssuranceStatutEvent);
      }
    }

    this.logger.log(`Assurances : ${expirees.length} expirée(s), ${aRenouveler.length} à renouveler`);
    return { expirees: expirees.length, aRenouveler: aRenouveler.length };
  }
}
