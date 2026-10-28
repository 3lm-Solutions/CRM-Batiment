import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { DemandesDevisModule } from '../../commercial/demandes-devis/demandes-devis.module';
import { DevisModule } from '../../commercial/devis/devis.module';
import { ChantiersModule } from '../../execution/chantiers/chantiers.module';
import { ClientsModule } from '../../referentiel/clients/clients.module';
import { DemoScenario } from './demo-scenario';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';

/** Step 15 — online demo (separate instance, reset every night) and sample data for development. */
@Module({
  imports: [AuthModule, ClientsModule, DemandesDevisModule, DevisModule, ChantiersModule],
  controllers: [SandboxController],
  providers: [SandboxService, DemoScenario],
  exports: [SandboxService],
})
export class SandboxModule {}
