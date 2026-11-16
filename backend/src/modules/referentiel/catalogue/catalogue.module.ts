import { Module } from '@nestjs/common';
import { CompanyModule } from '../../core/company/company.module';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { CompositionValidator } from './compositions/composition-validator.service';
import { MateriauxController } from './materiaux/materiaux.controller';
import { MateriauxService } from './materiaux/materiaux.service';
import { OptionsController } from './options/options.controller';
import { OptionsService } from './options/options.service';
import { CatalogueController } from './overview/catalogue.controller';
import { CatalogueOverviewService } from './overview/catalogue-overview.service';
import { PrestationsController } from './prestations/prestations.controller';
import { PrestationsService } from './prestations/prestations.service';
import { PricingService } from './pricing/pricing.service';
import { ServicesMoController } from './services-mo/services-mo.controller';
import { ServicesMoService } from './services-mo/services-mo.service';

/**
 * Catalogue: categories, materials, labour, prestations (+ options, choices, compositions)
 * and pricing. All routes live under /catalogue/*.
 */
@Module({
  imports: [CompanyModule], // pricing settings
  controllers: [
    CatalogueController,
    CategoriesController,
    MateriauxController,
    ServicesMoController,
    PrestationsController,
    OptionsController,
  ],
  providers: [
    CategoriesService,
    MateriauxService,
    ServicesMoService,
    PrestationsService,
    OptionsService,
    CompositionValidator,
    PricingService,
    CatalogueOverviewService,
  ],
  exports: [PrestationsService, PricingService], // used by quotes (Step 6)
})
export class CatalogueModule {}
