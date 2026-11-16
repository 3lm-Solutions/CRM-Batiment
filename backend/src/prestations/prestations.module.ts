import { Module } from '@nestjs/common';
import { PrestationsService } from './prestations.service.js';
import { PrestationsController } from './prestations.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [PrestationsController],
  providers: [PrestationsService],
  exports: [PrestationsService],
})
export class PrestationsModule {}
