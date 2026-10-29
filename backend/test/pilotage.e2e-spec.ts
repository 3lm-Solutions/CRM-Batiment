import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms)); // listeners run asynchronously

/** Audit, notifications (REST + websocket), SAV, dashboard, demo requests. */
describe('Pilotage (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let clientId: number;
  let baseUrl: string;
  const tag = `e2e-pil-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    t = await createTestApp();
    await t.app.listen(0); // a real port for the websocket client
    baseUrl = `http://127.0.0.1:${(t.app.getHttpServer().address() as AddressInfo).port}`;
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    technico = await t.tokenFor(SEED.technico);
    clientId = (
      await request(http)
        .post('/api/v1/clients')
        .set(auth(admin))
        .send({ nom: `${tag} Client`, email: `${tag}@client.test` })
    ).body.id;
  });

  afterAll(async () => {
    await t.prisma.savTicket.deleteMany({ where: { clientId } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.demoRequest.deleteMany({ where: { email: { startsWith: tag } } });
    await t.close();
  });

  it('audit: a catalogue price change is recorded with old and new values', async () => {
    const m = await t.prisma.materiau.findFirstOrThrow({ where: { actif: true } });
    const newPrice = m.prixAchatFixe.toNumber() + 1;
    await request(http)
      .patch(`/api/v1/catalogue/materiaux/${m.id}`)
      .set(auth(admin))
      .send({ prixAchatFixe: newPrice })
      .expect(200);
    await wait();

    const history = await request(http)
      .get(`/api/v1/audit/Materiau/${m.id}`)
      .set(auth(admin))
      .expect(200);
    expect(history.body.data[0]).toMatchObject({
      action: 'PRIX_MODIFIE',
      ancienneValeur: { prixAchatFixe: m.prixAchatFixe.toNumber() },
      nouvelleValeur: { prixAchatFixe: newPrice },
    });
    await request(http)
      .patch(`/api/v1/catalogue/materiaux/${m.id}`)
      .set(auth(admin))
      .send({ prixAchatFixe: m.prixAchatFixe.toNumber() });
    await request(http).get('/api/v1/audit').set(auth(technico)).expect(403);
  });

  it('notifications: a low-margin quote alerts the admins, in real time and in the inbox', async () => {
    const socket: Socket = io(`${baseUrl}/notifications`, {
      auth: { token: admin },
      transports: ['websocket'],
    });
    const received: { type: string }[] = [];
    socket.on('notification', (n: { type: string }) => received.push(n));
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const devis = await request(http)
      .post('/api/v1/devis')
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/lignes`)
      .set(auth(technico))
      .send({
        description: 'Prestation à 5 % de marge',
        quantite: 1,
        prixUnitaireVente: 100,
        prixAchat: 95,
      })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/envoyer`)
      .set(auth(technico))
      .expect(200);
    await wait(400);
    socket.close();

    expect(received.some((n) => n.type === 'MARGE_FAIBLE')).toBe(true);

    const inbox = await request(http)
      .get('/api/v1/notifications?nonLues=true')
      .set(auth(admin))
      .expect(200);
    const alert = inbox.body.data.find((n: { type: string }) => n.type === 'MARGE_FAIBLE');
    expect(alert.lien).toBe(`/devis/${devis.body.id}`);

    const before = (await request(http).get('/api/v1/notifications/compteur').set(auth(admin))).body
      .nonLues;
    const after = await request(http)
      .post(`/api/v1/notifications/${alert.id}/lue`)
      .set(auth(admin))
      .expect(200);
    expect(after.body.nonLues).toBe(before - 1);

    // nobody can read someone else's notification
    await request(http)
      .post(`/api/v1/notifications/${alert.id}/lue`)
      .set(auth(technico))
      .expect(404);
  });

  it('websocket: an invalid token is disconnected (old gateway only checked the signature)', async () => {
    const socket = io(`${baseUrl}/notifications`, {
      auth: { token: 'invalid' },
      transports: ['websocket'],
    });
    const disconnected = await new Promise<boolean>((resolve) => {
      socket.on('disconnect', () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });
    socket.close();
    expect(disconnected).toBe(true);
  });

  it('SAV: ticket lifecycle with notes; links must match the client', async () => {
    // Étape 2 (26/10): a SAV ticket is opened on a finished job site
    const chantier = await request(http)
      .post('/api/v1/chantiers')
      .set(auth(admin))
      .send({ clientId, adresse: '1 rue du SAV' })
      .expect(201);
    await t.prisma.chantier.update({
      where: { id: chantier.body.id },
      data: { statut: 'TERMINE', dateFin: new Date() },
    });
    const ticket = await request(http)
      .post('/api/v1/sav')
      .set(auth(technico))
      .send({
        clientId,
        chantierId: chantier.body.id,
        titre: 'Fissure chape',
        description: 'Fissure de 30 cm',
        priorite: 'HAUTE',
      })
      .expect(201);
    expect(ticket.body.reference).toMatch(/^SAV-/);

    const taken = await request(http)
      .post(`/api/v1/sav/${ticket.body.id}/prendre-en-charge`)
      .set(auth(technico))
      .expect(200);
    expect(taken.body.assignedTo).not.toBeNull(); // taken = assigned to me

    await request(http)
      .post(`/api/v1/sav/${ticket.body.id}/notes`)
      .set(auth(technico))
      .send({ contenu: 'RDV pris' })
      .expect(201);
    const solved = await request(http)
      .post(`/api/v1/sav/${ticket.body.id}/resoudre`)
      .set(auth(technico))
      .send({ note: 'Reprise faite' })
      .expect(200);
    expect(solved.body.statut).toBe('RESOLU');
    expect(solved.body.notes).toHaveLength(2);
    await request(http)
      .post(`/api/v1/sav/${ticket.body.id}/cloturer`)
      .set(auth(technico))
      .expect(200);
    await request(http)
      .post(`/api/v1/sav/${ticket.body.id}/notes`)
      .set(auth(technico))
      .send({ contenu: 'x' })
      .expect(422);

    const other = await t.prisma.devis.findFirst({ where: { clientId: { not: clientId } } });
    if (other) {
      await request(http)
        .post('/api/v1/sav')
        .set(auth(technico))
        .send({
          clientId,
          chantierId: chantier.body.id,
          devisId: other.id,
          titre: 'x',
          description: 'x',
        })
        .expect(422);
    }
  });

  it('dashboard: all KPIs in one call, ADMIN only', async () => {
    const res = await request(http).get('/api/v1/dashboard?jours=90').set(auth(admin)).expect(200);
    expect(res.body).toHaveProperty('devis.tauxConversion');
    expect(res.body).toHaveProperty('facturesImpayees.enRetard');
    expect(res.body.serieDevis).toHaveLength(12);
    await request(http).get('/api/v1/dashboard').set(auth(technico)).expect(403);
    await request(http).get('/api/v1/dashboard?jours=0').set(auth(admin)).expect(422);
  });

  it('demo requests: public form, honeypot, back-office follow-up', async () => {
    await request(http)
      .post('/api/v1/public/demo-requests')
      .send({ nom: 'Robot', email: `${tag}-bot@x.test`, website: 'spam.com' })
      .expect(201);
    expect(await t.prisma.demoRequest.count({ where: { email: `${tag}-bot@x.test` } })).toBe(0);

    await request(http)
      .post('/api/v1/public/demo-requests')
      .send({ nom: 'Lefèvre', email: `${tag}@prospect.test`, entreprise: 'Lefèvre Rénovation' })
      .expect(201);
    const list = await request(http)
      .get(`/api/v1/demo-requests?search=${tag}`)
      .set(auth(technico))
      .expect(200);
    const id = list.body.data[0].id;

    await request(http)
      .post(`/api/v1/demo-requests/${id}/contacter`)
      .set(auth(technico))
      .expect(200);
    await request(http)
      .post(`/api/v1/demo-requests/${id}/planifier`)
      .set(auth(technico))
      .send({})
      .expect(400);
    const planned = await request(http)
      .post(`/api/v1/demo-requests/${id}/planifier`)
      .set(auth(technico))
      .send({ dateDemo: new Date(Date.now() + 3 * 86_400_000).toISOString() })
      .expect(200);
    expect(planned.body.statut).toBe('SCHEDULED');
  });
});
