import { Module } from '@nestjs/common';
import { ChantiersController } from './chantiers.controller.js';
import { ChantiersService } from './chantiers.service.js';
// P0.5 — Import du module commun contenant WorkflowStateService
import { CommonModule } from '../common/common.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [CommonModule, NotificationsModule], // Ajout de CommonModule et NotificationsModule
  controllers: [ChantiersController],
  providers: [ChantiersService],
  exports: [ChantiersService],
})
export class ChantiersModule {}