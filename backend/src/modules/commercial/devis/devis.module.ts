import { Module } from '@nestjs/common';
import { CompanyModule } from '../../core/company/company.module';
import { CatalogueModule } from '../../referentiel/catalogue/catalogue.module';
import { DevisHooks } from './devis-hooks';
import { DevisLignesController } from './devis-lignes.controller';
import { DevisLignesService } from './devis-lignes.service';
import { DevisLifecycleService } from './devis-lifecycle.service';
import { DevisController } from './devis.controller';
import { DevisService } from './devis.service';
import { DevisLiensService } from './public/devis-liens.service';
import { EmailOtpSender, OTP_SENDERS } from './public/otp-sender';
import { PublicDevisController } from './public/public-devis.controller';
import { PublicDevisService } from './public/public-devis.service';

@Module({
  imports: [CompanyModule, CatalogueModule],
  controllers: [DevisController, DevisLignesController, PublicDevisController],
  providers: [
    DevisHooks,
    DevisService,
    DevisLignesService,
    DevisLifecycleService,
    DevisLiensService,
    PublicDevisService,
    EmailOtpSender,
    // Add an SMS sender to this list later; links choose the sender by their `canal`
    {
      provide: OTP_SENDERS,
      inject: [EmailOtpSender],
      useFactory: (email: EmailOtpSender) => [email],
    },
  ],
  exports: [DevisService, DevisLifecycleService, DevisHooks, DevisLignesService],
})
export class DevisModule {}
