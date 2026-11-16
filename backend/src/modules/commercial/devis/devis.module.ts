import { Module } from '@nestjs/common';
import { CompanyModule } from '../../core/company/company.module';
import { UploadMulterModule } from '../../core/storage/upload.config';
import { CatalogueModule } from '../../referentiel/catalogue/catalogue.module';
import { DevisHooks } from './devis-hooks';
import { DevisLignesController } from './devis-lignes.controller';
import { DevisLignesService } from './devis-lignes.service';
import { DevisLifecycleService } from './devis-lifecycle.service';
import { DevisPdfService } from './devis-pdf.service';
import { DevisController } from './devis.controller';
import { DevisService } from './devis.service';
import { DevisLiensService } from './public/devis-liens.service';
import { EmailOtpSender, OTP_SENDERS } from './public/otp-sender';
import { PublicDevisController } from './public/public-devis.controller';
import { PublicDevisService } from './public/public-devis.service';

@Module({
  imports: [CompanyModule, CatalogueModule, UploadMulterModule],
  controllers: [DevisController, DevisLignesController, PublicDevisController],
  providers: [
    DevisHooks,
    DevisService,
    DevisLignesService,
    DevisLifecycleService,
    DevisPdfService,
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
  exports: [DevisService, DevisLifecycleService, DevisHooks, DevisLignesService, DevisPdfService],
})
export class DevisModule {}
