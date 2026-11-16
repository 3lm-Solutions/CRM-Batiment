import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DevController } from './dev.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { DemandesDevisModule } from './demandes-devis/demandes-devis.module.js';
import { DevisModule } from './devis/devis.module.js';
import { FournisseursModule } from './fournisseurs/fournisseurs.module.js';
import { MateriauxModule } from './materiaux/materiaux.module.js';
import { ServicesMoModule } from './services-mo/services-mo.module.js';
import { PrestationsModule } from './prestations/prestations.module.js';
import { TypesProjetModule } from './types-projet/types-projet.module.js';
import { SeedModule } from './seed/seed.module.js';
import { PortailFournisseurModule } from './portail-fournisseur/portail-fournisseur.module.js';
import { CommandesFournisseurModule } from './commandes-fournisseur/commandes-fournisseur.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ChantiersModule } from './chantiers/chantiers.module.js';
import { FacturesModule } from './factures/factures.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { WorkflowModule } from './workflow.module.js';
import { RagModule } from './rag/rag.module.js';
import { SousTraitantModule } from './sous-traitant/sous-traitant.module.js';
import { SousTraitantsModule } from './sous-traitants/sous-traitants.module.js';

@Module({
  imports: [
    // Configuration globale (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Schedule module
    ScheduleModule.forRoot(),

    // Modules fondation
    PrismaModule,
    WorkflowModule,

    // Modules métier
    AuthModule,
    UsersModule,
    ClientsModule,
    DemandesDevisModule,
    DevisModule,
    // TODO: Re-enable CatalogueModule once imports are fixed
    // CatalogueModule,
    FournisseursModule,
    MateriauxModule,
    ServicesMoModule,
    PrestationsModule,
    TypesProjetModule,
    SeedModule,
    PortailFournisseurModule,
    CommandesFournisseurModule,
    NotificationsModule,
    ChantiersModule,
    FacturesModule,
    RagModule,
    AssistantModule,
    SousTraitantModule,
    
    SousTraitantsModule,
  ],
  controllers: [AppController, DevController],
  providers: [AppService],
})
export class AppModule {}
