import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SousTraitantsController } from './sous-traitants.controller.js';
import { SousTraitantsService } from './sous-traitants.service.js';
import { SousTraitantsAlertService } from './sous-traitants-alert.service.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SousTraitantsController],
  providers: [SousTraitantsService, SousTraitantsAlertService],
  exports: [SousTraitantsService, SousTraitantsAlertService],
})
export class SousTraitantsModule {}
