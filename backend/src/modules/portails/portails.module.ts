import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../core/storage/upload.config';
import { ChantiersModule } from '../execution/chantiers/chantiers.module';
import { SavModule } from '../pilotage/sav/sav.module';
import { EspaceClientAdminController, EspaceClientPublicController } from './espace-client/espace-client.controller';
import { EspaceClientService } from './espace-client/espace-client.service';
import { PortailFournisseurController } from './fournisseur/portail-fournisseur.controller';
import { PortailFournisseurService } from './fournisseur/portail-fournisseur.service';
import { RapportsController } from './rapports/rapports.controller';
import { RapportsService } from './rapports/rapports.service';
import { PortailSousTraitantController } from './sous-traitant/portail-sous-traitant.controller';
import { PortailSousTraitantService } from './sous-traitant/portail-sous-traitant.service';

/**
 * Step 11 — the three outside views of the CRM:
 *  - sous-traitant portal (account, role SOUS_TRAITANT): opened job sites, his tasks, reports + photos;
 *  - supplier portal (account, role FOURNISSEUR, tied by Fournisseur.userId): his orders;
 *  - client online space (NO account, emailed link — like the old quote links).
 * Plus the office side of the reports (review). Files go through the global StorageModule.
 */
@Module({
  imports: [UploadMulterModule, ChantiersModule, SavModule],
  controllers: [
    PortailSousTraitantController,
    RapportsController,
    PortailFournisseurController,
    EspaceClientAdminController,
    EspaceClientPublicController,
  ],
  providers: [PortailSousTraitantService, RapportsService, PortailFournisseurService, EspaceClientService],
})
export class PortailsModule {}
