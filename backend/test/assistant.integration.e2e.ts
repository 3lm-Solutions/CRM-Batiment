import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

type AuthLoginBody = {
  accessToken: string;
  user: {
    companyId: number;
  };
};

describe('Assistant Integration (DB-backed e2e)', { concurrency: 1 }, () => {
  let app: INestApplication<App>;
  let token = '';
  let companyId = 0;

  const runId = Date.now().toString();

  before(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    const seedRes = await request(app.getHttpServer())
      .post('/api/seed/init')
      .send({});

    assert.equal(seedRes.status, 200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@batiment-pro.fr',
        password: 'Admin@2026!',
      });

    assert.equal(loginRes.status, 200);

    const loginBody = loginRes.body as AuthLoginBody;
    assert.equal(typeof loginBody.accessToken, 'string');
    assert.ok(loginBody.accessToken.length > 20);
    assert.equal(typeof loginBody.user.companyId, 'number');

    token = loginBody.accessToken;
    companyId = loginBody.user.companyId;
  });

  after(async () => {
    await app.close();
  });

  it('should use grouped collection with one final confirmation', async () => {
    const guidedEmail = `assistant-guided-${runId}@example.com`;
    const guidedPhone = `06${runId.slice(-8)}`;

    const startSessionRes = await request(app.getHttpServer())
      .post('/api/assistant/session/start')
      .send({
        companyId,
      });

    assert.equal(startSessionRes.status, 201);
    assert.equal(typeof startSessionRes.body.session_id, 'number');
    assert.match(
      String(startSessionRes.body.response_message),
      /nom et prenom/i,
    );

    const sessionId = startSessionRes.body.session_id as number;

    const needRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message:
          `Je veux un devis pour isolation energetique. Je m'appelle Amal Saidani, tel ${guidedPhone}, email ${guidedEmail}, surface 80 m2, delai 2 semaines.`,
      });

    assert.equal(needRes.status, 201);
    assert.equal(needRes.body.intent, 'demande_devis');
    assert.ok(Array.isArray(needRes.body.detected_intents));
    assert.ok(needRes.body.detected_intents.includes('demande_devis'));
    assert.deepEqual(needRes.body.missing_fields, []);
    assert.equal(typeof needRes.body.client_need_summary, 'string');
    assert.equal(typeof needRes.body.existing_project_match, 'boolean');
    assert.equal(typeof needRes.body.quote_action?.status, 'string');
    assert.equal(typeof needRes.body.checklist_action?.status, 'string');
    assert.equal(
      typeof needRes.body.technical_validation_action?.status,
      'string',
    );
    assert.equal(typeof needRes.body.email_action?.status, 'string');
    assert.equal(typeof needRes.body.needs_clarification, 'boolean');
    assert.equal(typeof needRes.body.clarification_question, 'string');
    assert.match(String(needRes.body.response_message), /recapitulatif/i);
    assert.match(String(needRes.body.response_message), /confirmez-vous/i);

    const confirmRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: 'Oui',
      });

    assert.equal(confirmRes.status, 201);
    assert.match(
      String(confirmRes.body.response_message),
      /dossier transmis|vous recevrez votre devis/i,
    );

    const afterClosureRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: 'Merci',
      });

    assert.equal(afterClosureRes.status, 201);
    assert.match(
      String(afterClosureRes.body.response_message),
      /dossier transmis|bonne journee/i,
    );
  });

  it('should complete known project flow and persist prospect', async () => {
    const knownEmail = `assistant-known-${runId}@example.com`;
    const knownPhone = `06${runId.slice(-8)}`;

    const startSessionRes = await request(app.getHttpServer())
      .post('/api/assistant/session/start')
      .send({
        companyId,
      });

    assert.equal(startSessionRes.status, 201);
    assert.equal(typeof startSessionRes.body.session_id, 'number');
    const sessionId = startSessionRes.body.session_id as number;

    const firstMessageRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message:
          'Bonjour, je veux un devis pour une isolation energetique de ma maison.',
      });

    assert.equal(firstMessageRes.status, 201);
    assert.equal(firstMessageRes.body.intent, 'demande_devis');
    assert.equal(firstMessageRes.body.is_known_project, true);
    assert.ok(Array.isArray(firstMessageRes.body.missing_fields));
    assert.ok(firstMessageRes.body.missing_fields.includes('nom'));

    const secondMessageRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: `Je m'appelle Karim Integration, mon telephone est ${knownPhone}, mon email est ${knownEmail}, toujours pour mon projet d isolation energetique, surface 120 m2, delai 3 semaines.`,
      });

    assert.equal(secondMessageRes.status, 201);
    assert.equal(secondMessageRes.body.intent, 'demande_devis');
    assert.equal(secondMessageRes.body.is_known_project, true);
    assert.equal(typeof secondMessageRes.body.project_type, 'string');
    assert.ok(secondMessageRes.body.project_type.length > 0);
    assert.ok(
      secondMessageRes.body.project_type.toLowerCase().includes('isolation'),
    );
    assert.deepEqual(secondMessageRes.body.missing_fields, []);
    assert.equal(secondMessageRes.body.collected_data.email, knownEmail);
    assert.equal(secondMessageRes.body.collected_data.telephone, knownPhone);
    assert.match(String(secondMessageRes.body.response_message), /confirmez-vous/i);

    const confirmKnownRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: 'Oui',
      });

    assert.equal(confirmKnownRes.status, 201);
    assert.match(
      String(confirmKnownRes.body.response_message),
      /dossier transmis|vous recevrez votre devis/i,
    );

    const sessionRes = await request(app.getHttpServer()).get(
      `/api/assistant/session/${sessionId}?companyId=${companyId}`,
    );

    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.body.id, sessionId);
    assert.ok(Array.isArray(sessionRes.body.messages));
    assert.ok(sessionRes.body.messages.length >= 4);

    const prospectsRes = await request(app.getHttpServer())
      .get('/api/assistant/admin/prospects')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(prospectsRes.status, 200);
    assert.ok(Array.isArray(prospectsRes.body.items));

    const knownProspect = prospectsRes.body.items.find(
      (item: { id?: number; email?: string }) => item.email === knownEmail,
    );

    assert.ok(knownProspect);
    assert.equal(typeof knownProspect.typeProjet?.nom, 'string');
    assert.ok(knownProspect.typeProjet.nom.toLowerCase().includes('isolation'));

    const qualifyRes = await request(app.getHttpServer())
      .post(`/api/assistant/admin/prospects/${knownProspect.id}/qualify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        createDevisDraft: true,
      });

    assert.equal(qualifyRes.status, 201);
    assert.equal(typeof qualifyRes.body.demandeDevis?.id, 'number');
    assert.equal(typeof qualifyRes.body.devisBrouillon?.id, 'number');
    assert.equal(typeof qualifyRes.body.devisBrouillon?.reference, 'string');
    assert.equal(typeof qualifyRes.body.autoGeneration?.attempted, 'boolean');
    assert.equal(
      typeof qualifyRes.body.autoGeneration?.lignesAjoutees,
      'number',
    );
    assert.equal(
      typeof qualifyRes.body.autoGeneration?.skippedBecauseExistingLines,
      'boolean',
    );

    const requalifyRes = await request(app.getHttpServer())
      .post(`/api/assistant/admin/prospects/${knownProspect.id}/qualify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        createDevisDraft: true,
      });

    assert.equal(requalifyRes.status, 201);
    assert.equal(
      requalifyRes.body.demandeDevis?.id,
      qualifyRes.body.demandeDevis?.id,
    );
    assert.equal(
      requalifyRes.body.devisBrouillon?.id,
      qualifyRes.body.devisBrouillon?.id,
    );
    assert.equal(
      requalifyRes.body.devisBrouillon?.reference,
      qualifyRes.body.devisBrouillon?.reference,
    );

    const devisAfterRequalifyRes = await request(app.getHttpServer())
      .get(`/api/devis/${qualifyRes.body.devisBrouillon.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(devisAfterRequalifyRes.status, 200);
    const lignesAfterRequalify = Array.isArray(
      devisAfterRequalifyRes.body.lignes,
    )
      ? devisAfterRequalifyRes.body.lignes.length
      : 0;

    assert.ok(lignesAfterRequalify >= 0);
    assert.ok(
      requalifyRes.body.autoGeneration == null ||
        requalifyRes.body.autoGeneration?.skippedBecauseExistingLines ===
          (lignesAfterRequalify > 0),
    );
    assert.ok(
      requalifyRes.body.autoGeneration == null ||
        requalifyRes.body.autoGeneration?.lignesAjoutees === 0,
    );

    const demandeDetailsRes = await request(app.getHttpServer())
      .get(`/api/demandes-devis/${qualifyRes.body.demandeDevis.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(demandeDetailsRes.status, 200);
    assert.equal(demandeDetailsRes.body.clientId, knownProspect.id);

    const devisDetailsRes = await request(app.getHttpServer())
      .get(`/api/devis/${qualifyRes.body.devisBrouillon.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(devisDetailsRes.status, 200);
    assert.equal(
      devisDetailsRes.body.demandeDevisId,
      qualifyRes.body.demandeDevis.id,
    );

    const deleteProspectRes = await request(app.getHttpServer())
      .delete(`/api/assistant/admin/prospects/${knownProspect.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(deleteProspectRes.status, 200);
    assert.equal(deleteProspectRes.body.prospectId, knownProspect.id);
    assert.equal(deleteProspectRes.body.deleted, true);

    const prospectsAfterDeleteRes = await request(app.getHttpServer())
      .get('/api/assistant/admin/prospects')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(prospectsAfterDeleteRes.status, 200);
    const deletedProspect = prospectsAfterDeleteRes.body.items.find(
      (item: { id?: number }) => item.id === knownProspect.id,
    );
    assert.equal(deletedProspect, undefined);
  });

  it('should register unknown project and expose it in admin future projects', async () => {
    const unknownEmail = `assistant-future-${runId}@example.com`;
    const unknownPhone = `07${runId.slice(-8)}`;
    const unknownLabel = `domotique quantique ${runId}`;

    const startSessionRes = await request(app.getHttpServer())
      .post('/api/assistant/session/start')
      .send({
        companyId,
      });

    assert.equal(startSessionRes.status, 201);
    const sessionId = startSessionRes.body.session_id as number;

    const unknownMessageRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: `Je m'appelle Sara Futur, mon telephone ${unknownPhone}, mon email ${unknownEmail}. Je veux un devis pour ${unknownLabel} avec capteurs intelligents, surface 60 m2, delai 1 mois.`,
      });

    assert.equal(unknownMessageRes.status, 201);
    assert.equal(unknownMessageRes.body.intent, 'demande_devis');
    assert.equal(unknownMessageRes.body.is_known_project, false);
    assert.equal(typeof unknownMessageRes.body.project_type, 'string');
    assert.ok(unknownMessageRes.body.project_type.length > 0);
    assert.equal(unknownMessageRes.body.existing_project_match, false);
    assert.equal(
      unknownMessageRes.body.project_to_create_if_not_found?.status,
      'create_pending_project_type',
    );
    assert.equal(
      unknownMessageRes.body.quote_action?.status,
      'wait_project_type_validation',
    );
    assert.equal(
      unknownMessageRes.body.checklist_action?.status,
      'wait_project_type_validation',
    );
    assert.deepEqual(unknownMessageRes.body.missing_fields, []);
    assert.match(
      String(unknownMessageRes.body.response_message),
      /service n est pas disponible pour le moment/i,
    );
    assert.match(
      String(unknownMessageRes.body.response_message),
      /peinture|isolation|renovation|plomberie/i,
    );

    const futureProjectsRes = await request(app.getHttpServer())
      .get('/api/assistant/admin/projets-futurs')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(futureProjectsRes.status, 200);
    assert.ok(Array.isArray(futureProjectsRes.body.items));
    assert.ok(futureProjectsRes.body.items.length >= 1);

    const unknownProject = futureProjectsRes.body.items.find(
      (item: { label?: string; latestProspect?: { email?: string } }) =>
        item.latestProspect?.email === unknownEmail ||
        item.label?.toLowerCase().includes(unknownLabel.toLowerCase()),
    );

    assert.ok(unknownProject);

    const unknownProspectsRes = await request(app.getHttpServer())
      .get('/api/assistant/admin/prospects')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(unknownProspectsRes.status, 200);
    const unknownProspect = unknownProspectsRes.body.items.find(
      (item: { email?: string }) => item.email === unknownEmail,
    );
    assert.ok(unknownProspect);

    const qualifyUnknownRes = await request(app.getHttpServer())
      .post(`/api/assistant/admin/prospects/${unknownProspect.id}/qualify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ createDevisDraft: true });

    assert.equal(qualifyUnknownRes.status, 400);
    assert.match(
      String(qualifyUnknownRes.body.message),
      /type de projet non disponible/i,
    );
  });

  it('should keep both service and quote intents in technico description', async () => {
    const dualIntentEmail = `assistant-dual-intent-${runId}@example.com`;
    const dualIntentPhone = `05${runId.slice(-8)}`;

    const startSessionRes = await request(app.getHttpServer())
      .post('/api/assistant/session/start')
      .send({ companyId });

    assert.equal(startSessionRes.status, 201);
    const sessionId = startSessionRes.body.session_id as number;

    const serviceMessageRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: `Je m'appelle Ahmed Intentions, mon telephone est ${dualIntentPhone}, mon email ${dualIntentEmail}. Quels sont les services disponibles ?`,
      });

    assert.equal(serviceMessageRes.status, 201);

    const quoteMessageRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: 'Je veux un devis pour des travaux de renovation maison.',
      });

    assert.equal(quoteMessageRes.status, 201);
    assert.equal(quoteMessageRes.body.intent, 'demande_devis');

    const completionRes = await request(app.getHttpServer())
      .post(`/api/assistant/session/${sessionId}/message`)
      .send({
        companyId,
        message: 'Surface 90 m2, delai 2 semaines.',
      });

    assert.equal(completionRes.status, 201);
    assert.deepEqual(completionRes.body.missing_fields, []);

    const prospectsRes = await request(app.getHttpServer())
      .get('/api/assistant/admin/prospects')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(prospectsRes.status, 200);

    const dualIntentProspect = prospectsRes.body.items.find(
      (item: { id?: number; email?: string; notes?: string }) =>
        item.email === dualIntentEmail,
    );

    assert.ok(dualIntentProspect);
    assert.match(
      String(dualIntentProspect.notes || ''),
      /quels sont les services disponibles/i,
    );
    assert.match(
      String(dualIntentProspect.notes || ''),
      /demande de devis pour des travaux/i,
    );

    const deleteProspectRes = await request(app.getHttpServer())
      .delete(`/api/assistant/admin/prospects/${dualIntentProspect.id}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(deleteProspectRes.status, 200);
  });
});
