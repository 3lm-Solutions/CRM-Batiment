import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { DevisService } from './devis.service.js';
import { DevisController } from './devis.controller.js';
import { DevisPublicController } from './devis-public.controller.js';
// P0.5 — Import du module commun contenant WorkflowStateService
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [AuthModule, MailModule, CommonModule], // Ajout de CommonModule
  controllers: [DevisController, DevisPublicController],
  providers: [DevisService],
  exports: [DevisService],
})
export class DevisModule {}