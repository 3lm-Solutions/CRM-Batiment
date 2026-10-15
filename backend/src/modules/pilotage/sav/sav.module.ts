import { Module } from '@nestjs/common';
import { SavController } from './sav.controller';
import { SavService } from './sav.service';

/** Exports SavService for the client online space (Step 11), which opens tickets for the client. */
@Module({ controllers: [SavController], providers: [SavService], exports: [SavService] })
export class SavModule {}
