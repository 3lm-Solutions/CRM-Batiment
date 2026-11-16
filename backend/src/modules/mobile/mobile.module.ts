import { Module } from '@nestjs/common';
import { DemandesDevisModule } from '../commercial/demandes-devis/demandes-devis.module';
import { UploadMulterModule } from '../core/storage/upload.config';
import { ClientsModule } from '../referentiel/clients/clients.module';
import { AppareilsController } from './appareils/appareils.controller';
import { AppareilsService } from './appareils/appareils.service';
import { ProspectsTerrainController } from './prospects-terrain/prospects-terrain.controller';
import { ProspectsTerrainService } from './prospects-terrain/prospects-terrain.service';

/**
 * Routes used only by the mobile app (16/11, lot B1). The web never calls them; every other
 * mobile screen uses the same routes as the web.
 */
@Module({
  imports: [ClientsModule, DemandesDevisModule, UploadMulterModule],
  controllers: [AppareilsController, ProspectsTerrainController],
  providers: [AppareilsService, ProspectsTerrainService],
})
export class MobileModule {}
