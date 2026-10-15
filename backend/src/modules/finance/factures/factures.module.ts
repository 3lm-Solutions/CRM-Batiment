import { Module } from '@nestjs/common';
import { FacturesController } from './factures.controller';
import { FacturesService } from './factures.service';

@Module({
  controllers: [FacturesController],
  providers: [FacturesService],
  exports: [FacturesService],
})
export class FacturesModule {}
