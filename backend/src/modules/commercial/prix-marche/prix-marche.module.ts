import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { PrixMarcheController } from './prix-marche.controller';
import { PrixMarcheService } from './prix-marche.service';

/** Prix de marché (29/10): company prices + imported price list. Used by the quote assistant too. */
@Module({
  imports: [UploadMulterModule],
  controllers: [PrixMarcheController],
  providers: [PrixMarcheService],
  exports: [PrixMarcheService],
})
export class PrixMarcheModule {}
