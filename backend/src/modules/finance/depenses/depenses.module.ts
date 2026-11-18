import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { DepensesController } from './depenses.controller';
import { DepensesService } from './depenses.service';
import { ValidationsController } from './validations.controller';

/**
 * 18/11 (mobile lot A): supplier invoices (dépenses). FichiersService, ReferenceService and
 * NotificationsService are global; UploadMulterModule caps the size of the photos.
 */
@Module({
  imports: [UploadMulterModule],
  controllers: [DepensesController, ValidationsController],
  providers: [DepensesService],
  exports: [DepensesService],
})
export class DepensesModule {}
