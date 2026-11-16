import { Global, Module } from '@nestjs/common';
import { FichiersController } from './fichiers.controller';
import { FichiersService } from './fichiers.service';
import { StorageService } from './storage.service';
import { UploadMulterModule } from './upload.config';

/**
 * Files (Step 11). Global like PrismaModule: documents, insurance certificates and portal
 * reports all attach files through FichiersService without importing this module.
 */
@Global()
@Module({
  imports: [UploadMulterModule],
  controllers: [FichiersController],
  providers: [StorageService, FichiersService],
  exports: [FichiersService],
})
export class StorageModule {}
