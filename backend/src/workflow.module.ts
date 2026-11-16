import { Module, Global } from '@nestjs/common';
import { WorkflowStateService } from './workflow-state.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [WorkflowStateService],
  exports: [WorkflowStateService],
})
export class WorkflowModule {}