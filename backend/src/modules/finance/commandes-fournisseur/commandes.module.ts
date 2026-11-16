import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';

@Module({
  imports: [StockModule],
  controllers: [CommandesController],
  providers: [CommandesService],
  exports: [CommandesService],
})
export class CommandesModule {}
