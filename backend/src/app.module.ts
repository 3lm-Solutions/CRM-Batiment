import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/core/auth/auth.module';
import { CompanyModule } from './modules/core/company/company.module';
import { HealthModule } from './modules/core/health/health.module';
import { MailModule } from './modules/core/mail/mail.module';
import { StorageModule } from './modules/core/storage/storage.module';
import { UsersModule } from './modules/core/users/users.module';
import { DemandesDevisModule } from './modules/commercial/demandes-devis/demandes-devis.module';
import { DevisModule } from './modules/commercial/devis/devis.module';
import { ChantiersModule } from './modules/execution/chantiers/chantiers.module';
import { SousTraitantsModule } from './modules/execution/sous-traitants/sous-traitants.module';
import { PointagesModule } from './modules/execution/pointages/pointages.module';
import { PhotosAvancementModule } from './modules/execution/photos-avancement/photos-avancement.module';
import { CommandesModule } from './modules/finance/commandes-fournisseur/commandes.module';
import { FacturesModule } from './modules/finance/factures/factures.module';
import { StockModule } from './modules/finance/stock/stock.module';
import { CatalogueModule } from './modules/referentiel/catalogue/catalogue.module';
import { ClientsModule } from './modules/referentiel/clients/clients.module';
import { FournisseursModule } from './modules/referentiel/fournisseurs/fournisseurs.module';
import { TypesProjetModule } from './modules/referentiel/types-projet/types-projet.module';
import { AuditModule } from './modules/pilotage/audit/audit.module';
import { DashboardModule } from './modules/pilotage/dashboard/dashboard.module';
import { DemoRequestsModule } from './modules/pilotage/demo-requests/demo-requests.module';
import { SandboxModule } from './modules/pilotage/sandbox/sandbox.module';
import { NotificationsModule } from './modules/pilotage/notifications/notifications.module';
import { RelancesModule } from './modules/pilotage/relances/relances.module';
import { SavModule } from './modules/pilotage/sav/sav.module';
import { AssistantModule } from './modules/ia/assistant/assistant.module';
import { DevisIaModule } from './modules/ia/devis-ia/devis-ia.module';
import { PrixMarcheModule } from './modules/commercial/prix-marche/prix-marche.module';
import { PortailsModule } from './modules/portails/portails.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),

    // Side effects (notifications, audit, WhatsApp…) listen to domain events emitted
    // AFTER a transaction commits — see Step 7. No module needs to import them.
    EventEmitterModule.forRoot(),
    // Scheduled jobs (insurance expiry check). Disabled in tests.
    ...(process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),

    // ── infrastructure ──
    PrismaModule,
    CommonModule, // global guards, error filter, Decimal serializer, JWT, references

    // ── core ──
    HealthModule,
    MailModule,
    StorageModule, // uploaded files (Step 11), global
    AuthModule,
    UsersModule,
    CompanyModule,

    // ── référentiel ──
    ClientsModule,
    TypesProjetModule,
    FournisseursModule,
    CatalogueModule,

    // ── commercial ──
    DevisModule,
    DemandesDevisModule,

    // ── execution & finance ──
    ChantiersModule,
    SousTraitantsModule,
    PointagesModule,
    PhotosAvancementModule,
    StockModule,
    CommandesModule,
    FacturesModule,

    // ── workflow: devis accepté / signé → commandes, chantier, acompte ──
    WorkflowModule,

    // ── pilotage (mostly listen to the events above; SavModule is also used by the client space) ──
    AuditModule,
    NotificationsModule,
    RelancesModule,
    SavModule,
    DashboardModule,
    DemoRequestsModule,
    // Démo en ligne (Step 15): instance séparée, réinitialisée chaque nuit (DEMO_MODE)
    SandboxModule,

    // ── portails (Step 11): sous-traitant, fournisseur, espace client ──
    PortailsModule,

    // ── IA (Step 14): chatbot public, qualification des prospects, base de connaissances ──
    AssistantModule,
    // ── IA (Step 15): proposition de lignes de devis à partir d'une description ──
    DevisIaModule,
    PrixMarcheModule, // 29/10
  ],
})
export class AppModule {}
