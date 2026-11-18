import { Module } from '@nestjs/common';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { StockModule } from '../stock/stock.module';
import { CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';

@Module({
  imports: [StockModule, UploadMulterModule],
  controllers: [CommandesController, ReceptionsController],
  providers: [CommandesService, ReceptionsService],
  exports: [CommandesService],
})
export class CommandesModule {}
