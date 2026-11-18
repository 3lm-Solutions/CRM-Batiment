import { Module } from '@nestjs/common';
import { DevisModule } from '../commercial/devis/devis.module';
import { ChantiersModule } from '../execution/chantiers/chantiers.module';
import { InstallationsModule } from '../execution/installations/installations.module';
import { CommandesModule } from '../finance/commandes-fournisseur/commandes.module';
import { FacturesModule } from '../finance/factures/factures.module';
import { DevisWorkflowService } from './devis-workflow.service';

/** Top layer: orchestrates commercial → execution → finance. Nothing imports it. */
@Module({
  imports: [DevisModule, ChantiersModule, FacturesModule, CommandesModule, InstallationsModule],
  providers: [DevisWorkflowService],
})
export class WorkflowModule {}
