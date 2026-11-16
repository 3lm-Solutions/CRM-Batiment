import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import 'reflect-metadata';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Vérification RBAC & Sécurité (E2E)', { concurrency: 1 }, () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken = '';
  let technicoToken = '';
  let assistanteToken = '';
  let chefChantierToken = '';
  let sousTraitantToken = '';

  let companyId = 1;
  let testChantierId = 0;
  let chefId = 0;
  let sousTraitantId = 0;

  before(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 1. Authentification des comptes par défaut du seed (Admin / Technico)
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@batiment-pro.fr', password: 'Admin@2026!' });
    adminToken = adminLogin.body.accessToken;
    companyId = adminLogin.body.user.companyId;

    const technicoLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'technico@batiment-pro.fr', password: 'Technico@2026!' });
    technicoToken = technicoLogin.body.accessToken;

    // 2. Création temporaire des autres rôles pour le test
    const passwordHash = await bcrypt.hash('Password@2026!', 12);

    const assistanteUser = await prisma.user.upsert({
      where: { email: 'assistante-test@batiment-pro.fr' },
      update: {},
      create: {
        companyId,
        nom: 'Assistante',
        prenom: 'Marie',
        email: 'assistante-test@batiment-pro.fr',
        password: passwordHash,
        role: 'ASSISTANTE',
        actif: true,
        mustChangePassword: false,
      },
    });

    const chefUser = await prisma.user.upsert({
      where: { email: 'chef-test@batiment-pro.fr' },
      update: {},
      create: {
        companyId,
        nom: 'Chef',
        prenom: 'Jean',
        email: 'chef-test@batiment-pro.fr',
        password: passwordHash,
        role: 'CHEF_CHANTIER',
        actif: true,
        mustChangePassword: false,
      },
    });
    chefId = chefUser.id;

    const sousTraitantUser = await prisma.user.upsert({
      where: { email: 'sous-test@batiment-pro.fr' },
      update: {},
      create: {
        companyId,
        nom: 'Sous-traitant',
        prenom: 'BTP-Sub',
        email: 'sous-test@batiment-pro.fr',
        password: passwordHash,
        role: 'SOUS_TRAITANT',
        actif: true,
        mustChangePassword: false,
      },
    });
    sousTraitantId = sousTraitantUser.id;

    // Récupération des tokens pour ces utilisateurs
    const assistanteLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'assistante-test@batiment-pro.fr',
        password: 'Password@2026!',
      });
    assistanteToken = assistanteLogin.body.accessToken;

    const chefLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef-test@batiment-pro.fr', password: 'Password@2026!' });
    chefChantierToken = chefLogin.body.accessToken;

    const sousLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'sous-test@batiment-pro.fr', password: 'Password@2026!' });
    sousTraitantToken = sousLogin.body.accessToken;

    // Création d'un client et d'un chantier de test affecté au Chef
    const client = await prisma.client.create({
      data: {
        companyId,
        nom: 'Client Test RBAC',
        adresseChantier: '10 Rue de la Paix, Paris',
      },
    });

    const devis = await prisma.devis.create({
      data: {
        companyId,
        clientId: client.id,
        reference: `DEV-RBAC-${Date.now()}`,
        statut: 'ACCEPTE',
        totalTTC: 5000,
      },
    });

    const chantier = await prisma.chantier.create({
      data: {
        companyId,
        clientId: client.id,
        chefChantierId: chefId,
        reference: `CH-RBAC-${Date.now()}`,
        adresse: '10 Rue de la Paix, Paris',
        description: 'Chantier de test de sécurité',
      },
    });
    testChantierId = chantier.id;

    // Rattachement du chantier au devis
    await prisma.devis.update({
      where: { id: devis.id },
      data: { chantierId: testChantierId },
    });
  });

    after(async () => {
    // Nettoyage ciblé uniquement des données du test
    await prisma.devis.deleteMany({
      where: { reference: { startsWith: 'DEV-RBAC-' } },
    });
    await prisma.chantier.deleteMany({
      where: { reference: { startsWith: 'CH-RBAC-' } },
    });
    await prisma.client.deleteMany({
      where: { nom: 'Client Test RBAC' },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'assistante-test@batiment-pro.fr',
            'chef-test@batiment-pro.fr',
            'sous-test@batiment-pro.fr',
          ],
        },
      },
    });
    await app.close();
  });

  // --- TESTS SUR LES FACTURES ---
  describe('Restrictions Factures', () => {
    it("L'Assistante doit pouvoir lister les factures", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/factures')
        .set('Authorization', `Bearer ${assistanteToken}`);
      assert.equal(res.status, 200);
    });

    it("L'Assistante NE doit PAS pouvoir créer de facture", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/factures/from-devis/1')
        .set('Authorization', `Bearer ${assistanteToken}`)
        .send({ typeFacture: 'ACOMPTE', acomptePercent: 30 });
      assert.equal(res.status, 403); // Forbidden
    });

    it('Un Technico-commercial ne doit pas pouvoir lister les factures', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/factures')
        .set('Authorization', `Bearer ${technicoToken}`);
      assert.equal(res.status, 403);
    });
  });

  // --- TESTS SUR LES CLIENTS & DEVIS ---
  describe('Restrictions Clients & Devis', () => {
    it('Un Chef de Chantier ne doit pas pouvoir accéder aux clients', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${chefChantierToken}`);
      assert.equal(res.status, 403);
    });

    it('Un Sous-traitant ne doit pas pouvoir accéder aux devis', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/devis')
        .set('Authorization', `Bearer ${sousTraitantToken}`);
      assert.equal(res.status, 403);
    });
  });

  // --- TESTS SUR LES CHANTIERS ---
  describe('Restrictions Chantiers', () => {
    it("Un Chef de chantier doit voir son chantier affecté, mais sans l'accès au devis financier", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/chantiers/${testChantierId}`)
        .set('Authorization', `Bearer ${chefChantierToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, testChantierId);
      // Donnée commerciale sensible : le devis doit avoir été retiré de la réponse
      assert.equal(res.body.devis, undefined);
    });

    it('Un Chef de chantier ne doit pas voir un chantier qui ne lui est pas affecté', async () => {
      // Création d'un autre chantier affecté à personne
      const unassignedChantier = await prisma.chantier.create({
        data: {
          companyId,
          clientId: (await prisma.client.findFirst({ where: { companyId } }))!
            .id,
          reference: `CH-UNASSIGNED-${Date.now()}`,
          adresse: '123 Autre Adresse',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/chantiers/${unassignedChantier.id}`)
        .set('Authorization', `Bearer ${chefChantierToken}`);

      assert.equal(res.status, 404); // Not Found (car filtré par ses affectations)
    });
  });
});
