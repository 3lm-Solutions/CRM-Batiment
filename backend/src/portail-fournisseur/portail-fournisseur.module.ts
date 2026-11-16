import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PortailFournisseurController } from './portail-fournisseur.controller.js';
import { PortailFournisseurService } from './portail-fournisseur.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [PortailFournisseurController],
  providers: [PortailFournisseurService],
})
export class PortailFournisseurModule {}
