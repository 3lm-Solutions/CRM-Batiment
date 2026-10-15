import { Module } from '@nestjs/common';
import { TypesProjetController } from './types-projet.controller';
import { TypesProjetService } from './types-projet.service';

@Module({
  controllers: [TypesProjetController],
  providers: [TypesProjetService],
})
export class TypesProjetModule {}
