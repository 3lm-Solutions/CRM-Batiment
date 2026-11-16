import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SousTraitantController } from './sous-traitant.controller.js';
import { SousTraitantService } from './sous-traitant.service.js';

@Module({
  controllers: [SousTraitantController],
  providers: [SousTraitantService, PrismaService],
  exports: [SousTraitantService],
})
export class SousTraitantModule {}
