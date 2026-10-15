import { Module } from '@nestjs/common';
import { AssurancesAlertService } from './assurances-alert.service';
import { ContratsController } from './contrats.controller';
import { ContratsService } from './contrats.service';
import { DossierService } from './dossier.service';
import { SousTraitantsController } from './sous-traitants.controller';
import { SousTraitantsService } from './sous-traitants.service';

@Module({
  controllers: [SousTraitantsController, ContratsController],
  providers: [SousTraitantsService, ContratsService, DossierService, AssurancesAlertService],
  exports: [SousTraitantsService],
})
export class SousTraitantsModule {}
