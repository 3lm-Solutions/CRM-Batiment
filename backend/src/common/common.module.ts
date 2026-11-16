import { Module } from '@nestjs/common';
import { WorkflowStateService } from './workflow-state.service.js';

// ─────────────────────────────────────────────────────────
// P0.5 — CommonModule
// Module partagé qui exporte le WorkflowStateService
// pour être utilisé dans DevisModule et ChantiersModule
// ─────────────────────────────────────────────────────────
@Module({
  providers: [WorkflowStateService],
  exports: [WorkflowStateService],
})
export class CommonModule {}