import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SavController } from './sav.controller.js';
import { SavService } from './sav.service.js';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [SavController],
  providers: [SavService],
})
export class SavModule {}
