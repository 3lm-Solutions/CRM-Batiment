import { Module } from '@nestjs/common';
import { FournisseursService } from './fournisseurs.service.js';
import { FournisseursController } from './fournisseurs.controller.js';

@Module({
  controllers: [FournisseursController],
  providers: [FournisseursService],
  exports: [FournisseursService],
})
export class FournisseursModule {}
