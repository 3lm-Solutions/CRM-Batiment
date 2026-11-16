import { Module } from '@nestjs/common';
import { DevisModule } from '../../commercial/devis/devis.module';
import { RelancesController } from './relances.controller';
import { RelancesService } from './relances.service';

@Module({
  imports: [DevisModule],
  controllers: [RelancesController],
  providers: [RelancesService],
  exports: [RelancesService],
})
export class RelancesModule {}
