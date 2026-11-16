import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller.js';
import { SeedService } from './seed.service.js';

@Module({
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
