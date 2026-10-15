import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { App } from 'supertest/types';
import { AssurancesAlertService } from '../src/modules/execution/sous-traitants/assurances-alert.service';
import { SousTraitantEvents } from '../src/modules/execution/sous-traitants/sous-traitants.events';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

describe('Sous-traitants (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let clientId: number;
  let chantierId: number;
  const tag = `e2e-st-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

  const createST = async (nom: string) =>
    (await request(http).post('/api/v1/sous-traitants').set(auth(admin)).send({ nom: `${tag} ${nom}` }).expect(201)).body.id as number;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    clientId = (await request(http).post('/api/v1/clients').set(auth(admin)).send({ nom: `${tag} Client` })).body.id;
    chantierId = (
      await request(http).post('/api/v1/chantiers').set(auth(admin)).send({ clientId, adresse: '1 rue du Test' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    const sts = await t.prisma.sousTraitant.findMany({ where: { nom: { startsWith: tag } }, select: { id: true } });
    const ids = sts.map((s) => s.id);
    await t.prisma.paiementSousTraitant.deleteMany({ where: { sousTraitantId: { in: ids } } });
    await t.prisma.contratSousTraitant.deleteMany({ where: { sousTraitantId: { in: ids } } });
    await t.prisma.sousTraitant.deleteMany({ where: { id: { in: ids } } }); // insurances, ratings cascade
    await t.prisma.chantier.delete({ where: { id: chantierId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.close();
  });

  it('insurance status is derived from the expiry date', async () => {
    const id = await createST('Assur');
    const soon = await request(http)
      .post(`/api/v1/sous-traitants/${id}/assurances`)
      .set(auth(admin))
      .send({ typeAssurance: 'DECENNALE', numeroAttestation: 'D-1', compagnieAssurance: 'SMABTP', dateExpiration: inDays(10) })
      .expect(201);
    expect(soon.body.statut).toBe('A_RENOUVELER');

    const renewed = await request(http)
      .patch(`/api/v1/sous-traitants/${id}/assurances/${soon.body.id}`)
      .set(auth(admin))
      .send({ dateExpiration: inDays(365) })
      .expect(200);
    expect(renewed.body.statut).toBe('VALIDE');
  });

  it('a contract cannot be activated without a valid décennale', async () => {
    const id = await createST('SansDecennale');
    const contrat = await request(http)
      .post('/api/v1/contrats-sous-traitance')
      .set(auth(admin))
      .send({ sousTraitantId: id, chantierId, montantHT: 3000 })
      .expect(201);
    expect(contrat.body.reference).toMatch(/^CST-/);

    const refused = await request(http).post(`/api/v1/contrats-sous-traitance/${contrat.body.id}/activer`).set(auth(admin)).expect(422);
    expect(refused.body.code).toBe('DECENNALE_MANQUANTE');

    await request(http)
      .post(`/api/v1/sous-traitants/${id}/assurances`)
      .set(auth(admin))
      .send({ typeAssurance: 'DECENNALE', numeroAttestation: 'D-2', compagnieAssurance: 'MAAF', dateExpiration: inDays(200) });
    await request(http).post(`/api/v1/contrats-sous-traitance/${contrat.body.id}/activer`).set(auth(admin)).expect(200);

    // payments cannot exceed the contract
    await request(http)
      .post(`/api/v1/sous-traitants/${id}/paiements`)
      .set(auth(admin))
      .send({ contratId: contrat.body.id, montantHT: 2000, montantTTC: 2400, datePaiement: inDays(0), modePaiement: 'VIREMENT' })
      .expect(201);
    const over = await request(http)
      .post(`/api/v1/sous-traitants/${id}/paiements`)
      .set(auth(admin))
      .send({ contratId: contrat.body.id, montantHT: 1500, montantTTC: 1800, datePaiement: inDays(0), modePaiement: 'VIREMENT' })
      .expect(422);
    expect(over.body.code).toBe('PAIEMENT_SUPERIEUR_AU_CONTRAT');
  });

  it('one rating per job site, global mark computed', async () => {
    const id = await createST('Note');
    const n = await request(http)
      .post(`/api/v1/sous-traitants/${id}/notations`)
      .set(auth(admin))
      .send({ chantierId, noteQualite: 5, noteDelai: 4, noteCommunication: 4 })
      .expect(201);
    expect(n.body.noteGlobale).toBe(4.33);
    await request(http)
      .post(`/api/v1/sous-traitants/${id}/notations`)
      .set(auth(admin))
      .send({ chantierId, noteQualite: 1, noteDelai: 1, noteCommunication: 1 })
      .expect(409);
  });

  it('daily job: "à renouveler" does become EXPIREE, and an event is emitted', async () => {
    const id = await createST('Cron');
    const a = await request(http)
      .post(`/api/v1/sous-traitants/${id}/assurances`)
      .set(auth(admin))
      .send({ typeAssurance: 'RC_PRO', numeroAttestation: 'R-1', compagnieAssurance: 'AXA', dateExpiration: inDays(5) });
    expect(a.body.statut).toBe('A_RENOUVELER');

    const events: unknown[] = [];
    t.app.get(EventEmitter2).on(SousTraitantEvents.ASSURANCE_STATUT, (e) => events.push(e));
    await t.app.get(AssurancesAlertService).run(new Date(Date.now() + 6 * 86_400_000));

    const after = await t.prisma.assuranceSousTraitant.findUniqueOrThrow({ where: { id: a.body.id } });
    expect(after.statut).toBe('EXPIREE');
    expect(events).toContainEqual(expect.objectContaining({ assuranceId: a.body.id, statut: 'EXPIREE' }));
  });

  it('roles: technico has no access, assistante can read but not write', async () => {
    const technico = await t.tokenFor(SEED.technico);
    const assistante = await t.tokenFor(SEED.assistante);
    await request(http).get('/api/v1/sous-traitants').set(auth(technico)).expect(403);
    await request(http).get('/api/v1/sous-traitants').set(auth(assistante)).expect(200);
    await request(http).post('/api/v1/sous-traitants').set(auth(assistante)).send({ nom: `${tag} X` }).expect(403);
  });
});
