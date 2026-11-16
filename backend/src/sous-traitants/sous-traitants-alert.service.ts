import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SousTraitantsAlertService implements OnModuleInit {
  private readonly logger = new Logger(SousTraitantsAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Démarrage automatique de la vérification des assurances à l\'initialisation...');
    const result = await this.checkExpiringAssurances();
    this.logger.log(`Initialisation terminée. Assurances expirées : ${result.expiredCount}, à renouveler : ${result.warningCount}`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Démarrage de la vérification planifiée des assurances...');
    const result = await this.checkExpiringAssurances();
    this.logger.log(`Vérification terminée. Assurances expirées : ${result.expiredCount}, à renouveler : ${result.warningCount}`);
  }

  async checkExpiringAssurances(daysThreshold = 30) {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);

    // Find all assurances that are not already flagged/expired
    const assurances = await this.prisma.assuranceSousTraitant.findMany({
      where: {
        statut: {
          notIn: ['EXPIREE', 'A_RENOUVELER'],
        },
      },
      include: {
        sousTraitant: true,
      },
    });

    let expiredCount = 0;
    let warningCount = 0;

    for (const assurance of assurances) {
      const expiration = new Date(assurance.dateExpiration);
      const isExpired = expiration <= now;
      const isExpiringSoon = expiration <= thresholdDate && expiration > now;

      if (isExpired) {
        // Expiration
        await this.prisma.assuranceSousTraitant.update({
          where: { id: assurance.id },
          data: { statut: 'EXPIREE' },
        });

        await this.notificationsService.createInternalNotification({
          companyId: assurance.companyId,
          entite: 'AssuranceSousTraitant',
          entiteId: assurance.id,
          action: 'NOTIFICATION_ASSURANCE_EXPIRATION',
          category: 'ASSURANCE_EXPIRATION',
          level: 'warning',
          title: `Assurance expirée - ${assurance.sousTraitant.nom}`,
          message: `L'assurance ${assurance.typeAssurance} (n° ${assurance.numeroAttestation}) a expiré le ${expiration.toLocaleDateString('fr-FR')}.`,
        });

        expiredCount++;
      } else if (isExpiringSoon) {
        // A renouveler
        await this.prisma.assuranceSousTraitant.update({
          where: { id: assurance.id },
          data: { statut: 'A_RENOUVELER' },
        });

        await this.notificationsService.createInternalNotification({
          companyId: assurance.companyId,
          entite: 'AssuranceSousTraitant',
          entiteId: assurance.id,
          action: 'NOTIFICATION_ASSURANCE_EXPIRATION',
          category: 'ASSURANCE_EXPIRATION',
          level: 'warning',
          title: `Assurance à renouveler - ${assurance.sousTraitant.nom}`,
          message: `L'assurance ${assurance.typeAssurance} (n° ${assurance.numeroAttestation}) expire le ${expiration.toLocaleDateString('fr-FR')} dans moins de ${daysThreshold} jours.`,
        });

        warningCount++;
      }
    }

    return { expiredCount, warningCount };
  }
}
