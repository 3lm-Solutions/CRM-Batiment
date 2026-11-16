import { Module } from '@nestjs/common';
import { ChantiersController } from './chantiers.controller';
import { ChantiersService } from './chantiers.service';
import { ChecklistController } from './checklist/checklist.controller';
import { ChecklistService } from './checklist/checklist.service';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { TachesController } from './taches.controller';
import { TachesService } from './taches.service';

@Module({
  controllers: [ChantiersController, TachesController, ChecklistController, PlanningController],
  providers: [ChantiersService, TachesService, ChecklistService, PlanningService],
  exports: [ChantiersService, ChecklistService],
})
export class ChantiersModule {}
