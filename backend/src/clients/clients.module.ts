import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { ClientsController } from './clients.controller.js';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
