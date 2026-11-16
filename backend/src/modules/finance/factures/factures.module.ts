import { Module } from '@nestjs/common';
import { FacturesController } from './factures.controller';
import { FacturesService } from './factures.service';
import { PublicFacturesController } from './public-factures.controller';

@Module({
  controllers: [FacturesController, PublicFacturesController],
  providers: [FacturesService],
  exports: [FacturesService],
})
export class FacturesModule {}
