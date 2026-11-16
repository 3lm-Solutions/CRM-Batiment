import { Module } from '@nestjs/common';
import { TypesProjetService } from './types-projet.service.js';
import { TypesProjetController } from './types-projet.controller.js';

@Module({
  controllers: [TypesProjetController],
  providers: [TypesProjetService],
  exports: [TypesProjetService],
})
export class TypesProjetModule {}
