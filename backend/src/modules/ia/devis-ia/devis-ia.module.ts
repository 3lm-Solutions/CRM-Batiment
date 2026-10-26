import { Module } from '@nestjs/common';
import { DevisModule } from '../../commercial/devis/devis.module';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { CatalogueModule } from '../../referentiel/catalogue/catalogue.module';
import { AssistantModule } from '../assistant/assistant.module';
import { DevisIaController } from './devis-ia.controller';
import { DevisIaService } from './devis-ia.service';

/**
 * Step 15 — quote assistant: proposes catalogue lines and quantities from a job description.
 * Uses the same language model as the chatbot (AssistantModule); keyword matching without a key.
 * C37 of 21/10: also from 1 to 3 photos (UploadMulterModule: size limits; photos kept in memory only).
 */
@Module({
  imports: [AssistantModule, DevisModule, CatalogueModule, UploadMulterModule],
  controllers: [DevisIaController],
  providers: [DevisIaService],
})
export class DevisIaModule {}
