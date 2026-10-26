import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { SavController } from './sav.controller';
import { SavService } from './sav.service';

/**
 * Exports SavService for the client online space (Step 11), which opens tickets for the client.
 * UploadMulterModule: size / count limits of the ticket photos (C42 of 21/10).
 */
@Module({ imports: [UploadMulterModule], controllers: [SavController], providers: [SavService], exports: [SavService] })
export class SavModule {}
