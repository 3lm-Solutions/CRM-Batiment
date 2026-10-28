import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { PhotosChantierController, PortailPhotosController } from './photos-avancement.controller';
import { PhotosAvancementService } from './photos-avancement.service';

/**
 * Before / after photos of the tasks (Étapes 3–4 of 26/10). FichiersService and
 * NotificationsService are global; UploadMulterModule caps the size and number of photos.
 */
@Module({ imports: [UploadMulterModule], controllers: [PhotosChantierController, PortailPhotosController], providers: [PhotosAvancementService] })
export class PhotosAvancementModule {}
