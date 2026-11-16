import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CommandesFournisseurController } from './commandes-fournisseur.controller.js';
import { CommandesFournisseurService } from './commandes-fournisseur.service.js';

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [CommandesFournisseurController],
  providers: [CommandesFournisseurService],
})
export class CommandesFournisseurModule {}
