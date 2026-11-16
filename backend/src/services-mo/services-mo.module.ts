import { Module } from '@nestjs/common';
import { ServicesMoService } from './services-mo.service.js';
import { ServicesMoController } from './services-mo.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [ServicesMoController],
  providers: [ServicesMoService],
  exports: [ServicesMoService],
})
export class ServicesMoModule {}
