import { Module } from '@nestjs/common';
import { DevisModule } from '../devis/devis.module';
import { DemandesDevisController } from './demandes-devis.controller';
import { DemandesDevisService } from './demandes-devis.service';

@Module({
  imports: [DevisModule],
  controllers: [DemandesDevisController],
  providers: [DemandesDevisService],
  exports: [DemandesDevisService],
})
export class DemandesDevisModule {}
