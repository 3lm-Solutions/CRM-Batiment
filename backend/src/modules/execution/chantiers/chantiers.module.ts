import { Module } from '@nestjs/common';
import { ChantiersController } from './chantiers.controller';
import { ChantiersService } from './chantiers.service';
import { TachesController } from './taches.controller';
import { TachesService } from './taches.service';

@Module({
  controllers: [ChantiersController, TachesController],
  providers: [ChantiersService, TachesService],
  exports: [ChantiersService],
})
export class ChantiersModule {}
