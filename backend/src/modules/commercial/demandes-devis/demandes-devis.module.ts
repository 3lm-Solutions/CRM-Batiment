import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { DevisModule } from '../devis/devis.module';
import { DemandesDevisController } from './demandes-devis.controller';
import { DemandesDevisService } from './demandes-devis.service';

@Module({
  imports: [DevisModule, UploadMulterModule],
  controllers: [DemandesDevisController],
  providers: [DemandesDevisService],
  exports: [DemandesDevisService],
})
export class DemandesDevisModule {}
