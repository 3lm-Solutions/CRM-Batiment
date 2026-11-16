import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService], // pricing, quotes and invoices read the settings
})
export class CompanyModule {}
