import { Module } from '@nestjs/common';
import { DemoRequestsController, PublicDemoRequestsController } from './demo-requests.controller';
import { DemoRequestsService } from './demo-requests.service';

@Module({
  controllers: [PublicDemoRequestsController, DemoRequestsController],
  providers: [DemoRequestsService],
})
export class DemoRequestsModule {}
