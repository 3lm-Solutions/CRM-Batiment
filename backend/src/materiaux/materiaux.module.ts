import { Module } from '@nestjs/common';
import { MateriauxService } from './materiaux.service.js';
import { MateriauxController } from './materiaux.controller.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [MateriauxController],
  providers: [MateriauxService],
  exports: [MateriauxService],
})
export class MateriauxModule {}
