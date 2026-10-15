import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService], // receptions move stock inside their own transaction
})
export class StockModule {}
