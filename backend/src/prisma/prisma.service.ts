import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private pool: pg.Pool;
  private _client: InstanceType<typeof PrismaClient>;

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    this.pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);
    this._client = new PrismaClient({ adapter } as any);
  }

  async onModuleInit() {
    await this._client.$connect();
  }

  async onModuleDestroy() {
    await this._client.$disconnect();
    await this.pool.end();
  }

  // Proxy all Prisma model accessors
  get company() {
    return this._client.company;
  }
  get user() {
    return this._client.user;
  }
  get client() {
    return this._client.client;
  }
  get demandeDevis() {
    return this._client.demandeDevis;
  }
  get categoriePrestation() {
    return this._client.categoriePrestation;
  }
  get prestation() {
    return this._client.prestation;
  }
  get sousCategorie() {
    return this._client.sousCategorie;
  }
  get optionPrestation() {
    return this._client.optionPrestation;
  }
  get choixOption() {
    return this._client.choixOption;
  }
  get prestationComposition() {
    return this._client.prestationComposition;
  }
  get choixOptionComposition() {
    return this._client.choixOptionComposition;
  }
  get materiau() {
    return this._client.materiau;
  }
  get serviceMainOeuvre() {
    return this._client.serviceMainOeuvre;
  }
  get devis() {
    return this._client.devis;
  }
  get devisClientSignatureRequest() {
    return this._client.devisClientSignatureRequest;
  }
  get versionDevis() {
    return this._client.versionDevis;
  }
  get ligneDevis() {
    return this._client.ligneDevis;
  }
  get facture() {
    return this._client.facture;
  }
  get factureLigne() {
    return this._client.factureLigne;
  }
  get bonCommande() {
    return this._client.bonCommande;
  }
  get fournisseur() {
    return this._client.fournisseur;
  }
  get commandeFournisseur() {
    return this._client.commandeFournisseur;
  }
  get ligneCommandeFournisseur() {
    return this._client.ligneCommandeFournisseur;
  }
  get reception() {
    return this._client.reception;
  }
  get chantier() {
    return this._client.chantier;
  }
  get chantierSousTraitant() {
    return this._client.chantierSousTraitant;
  }
  get equipe() {
    return this._client.equipe;
  }
  get tache() {
    return this._client.tache;
  }
  get affectationTache() {
    return this._client.affectationTache;
  }
  get documentChantier() {
    return this._client.documentChantier;
  }
  get chatSession() {
    return this._client.chatSession;
  }
  get messageChat() {
    return this._client.messageChat;
  }
  get ragDocument() {
    return this._client.ragDocument;
  }
  get auditLog() {
    return this._client.auditLog;
  }
  get typeProjet() {
    return this._client.typeProjet;
  }
  get sousTraitant() {
    return this._client.sousTraitant;
  }
  get contratSousTraitant() {
    return this._client.contratSousTraitant;
  }
  get assuranceSousTraitant() {
    return this._client.assuranceSousTraitant;
  }
  get paiementSousTraitant() {
    return this._client.paiementSousTraitant;
  }
  get disponibiliteSousTraitant() {
    return this._client.disponibiliteSousTraitant;
  }
  get notationSousTraitant() {
    return this._client.notationSousTraitant;
  }
  get mouvementStock() {
    return this._client.mouvementStock;
  }
  get savTicket() {
    return this._client.savTicket;
  }
  get savTicketNote() {
    return this._client.savTicketNote;
  }
  get demoRequest() {
    return this._client.demoRequest;
  }
  get assistantFeedback() {
    return this._client.assistantFeedback;
  }

  // Transaction support
  $transaction(
    ...args: Parameters<InstanceType<typeof PrismaClient>['$transaction']>
  ) {
    return this._client.$transaction(...args);
  }

  $executeRawUnsafe(
    ...args: Parameters<InstanceType<typeof PrismaClient>['$executeRawUnsafe']>
  ) {
    return this._client.$executeRawUnsafe(...args);
  }

  $queryRawUnsafe<T = unknown>(
    ...args: Parameters<InstanceType<typeof PrismaClient>['$queryRawUnsafe']>
  ): Promise<T> {
    return this._client.$queryRawUnsafe(...args) as Promise<T>;
  }
}
