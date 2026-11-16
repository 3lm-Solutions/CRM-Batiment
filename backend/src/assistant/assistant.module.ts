import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller.js';
import { AssistantAdminController } from './assistant-admin.controller.js';
import { AssistantService } from './assistant.service.js';
import { AssistantLlmService } from './assistant-llm.service.js';
import { AssistantRagService } from './assistant-rag.service.js';
import { DevisModule } from '../devis/devis.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [DevisModule, ClientsModule, NotificationsModule],
  controllers: [AssistantController, AssistantAdminController],
  providers: [AssistantService, AssistantLlmService, AssistantRagService],
  exports: [AssistantService],
})
export class AssistantModule {}
