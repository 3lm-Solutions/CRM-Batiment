import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogueService } from './services/catalogue.service';
import { MaterialService } from './services/material.service';
import { ServiceMoService } from './services/service-mo.service';
import { PrestationService } from './services/prestation.service';
import { CatalogueController } from './controllers/catalogue.controller';
import { MaterialController } from './controllers/material.controller';
import { ServiceMoController } from './controllers/service-mo.controller';
import { PrestationController } from './controllers/prestation.controller';

/**
 * MODULE CATALOGUE
 *
 * Gère toute la bibliothèque de prix et les prestations:
 * - Matériaux (achat + détails)
 * - Services Main d'Oeuvre
 * - Prestations (composition + options)
 * - Catégories et Sous-catégories
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    CatalogueController,
    MaterialController,
    ServiceMoController,
    PrestationController,
  ],
  providers: [
    CatalogueService,
    MaterialService,
    ServiceMoService,
    PrestationService,
  ],
  exports: [
    CatalogueService,
    MaterialService,
    ServiceMoService,
    PrestationService,
  ],
})
export class CatalogueModule {}
