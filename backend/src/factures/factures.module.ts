import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { FacturesController } from './factures.controller.js';
import { FacturesService } from './factures.service.js';

@Module({
  imports: [MailModule],
  controllers: [FacturesController],
  providers: [FacturesService],
  exports: [FacturesService],
})
export class FacturesModule {}
