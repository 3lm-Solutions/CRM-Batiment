import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { InstallateurController } from './installateur.controller';
import { InstallateurService } from './installateur.service';
import { InstallationPvService } from './installation-pv.service';
import { InstallationsController } from './installations.controller';
import { InstallationsService } from './installations.service';

/**
 * 18/11 (mobile lot B): delegated installations — office follow-up and the installer's missions.
 * FichiersService, ReferenceService and NotificationsService are global.
 */
@Module({
  imports: [UploadMulterModule],
  controllers: [InstallationsController, InstallateurController],
  providers: [InstallationsService, InstallateurService, InstallationPvService],
  exports: [InstallationsService],
})
export class InstallationsModule {}
