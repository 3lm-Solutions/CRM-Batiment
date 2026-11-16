import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const DAY = 86_400_000;

/** Steps 5–6 of 21/10: C3 automatic reminders, C42 after-sales photos. Requires a migrated, seeded database. */
describe('Étapes 5–6 — relances (C3), photos SAV (C42) (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let clientId: number;
  let chapeId: number;
  let reglagesBefore: {
    relancesActives: boolean;
    relanceDevisJours: number[];
    relanceFactureJours: number[];
  };
  const tag = `e2e-s56-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, chef] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.chef),
    ]);
    clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} Client`, email: clientEmail })
        .expect(201)
    ).body.id;
    chapeId = (
      await request(http)
        .get(api(`/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`))
        .set(auth(admin))
    ).body.data[0].id;
    reglagesBefore = (
      await request(http).get(api('/relances/reglages')).set(auth(admin)).expect(200)
    ).body;
  });

  afterAll(async () => {
    await request(http).patch(api('/relances/reglages')).set(auth(admin)).send(reglagesBefore);
    await t.prisma.fichier.deleteMany({ where: { savTicket: { clientId } } });
    await t.prisma.savTicket.deleteMany({ where: { clientId } });
    await t.prisma.relance.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.close();
  });

  const sentDevis = async () => {
    const devis = await request(http)
      .post(api('/devis'))
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    const p = await request(http)
      .get(api(`/catalogue/prestations/${chapeId}`))
      .set(auth(technico));
    const choixIds = p.body.options.flatMap(
      (o: { obligatoire: boolean; choix: { id: number }[] }) =>
        o.obligatoire ? [o.choix[0].id] : [],
    );
    await request(http)
      .post(api(`/devis/${devis.body.id}/lignes`))
      .set(auth(technico))
      .send({ prestationId: chapeId, choixIds, quantite: 10 })
      .expect(201);
    await request(http)
      .post(api(`/devis/${devis.body.id}/envoyer`))
      .set(auth(technico))
      .expect(200);
    return devis.body.id as number;
  };

  it('C3: settings are admin-only and validated', async () => {
    await request(http).get(api('/relances/reglages')).set(auth(technico)).expect(403);
    await request(http)
      .patch(api('/relances/reglages'))
      .set(auth(admin))
      .send({ relanceDevisJours: [] })
      .expect(400);
    const r = await request(http)
      .patch(api('/relances/reglages'))
      .set(auth(admin))
      .send({ relancesActives: true, relanceDevisJours: [14, 7, 7] })
      .expect(200);
    expect(r.body.relanceDevisJours).toEqual([7, 14]);
  });

  it('C3: a quote unanswered for 8 days is reminded once (level 1), then not again the same day', async () => {
    const id = await sentDevis();
    await t.prisma.devis.update({
      where: { id },
      data: { dateEnvoi: new Date(Date.now() - 8 * DAY) },
    });

    const run = await request(http).post(api('/relances/executer')).set(auth(admin)).expect(200);
    expect(run.body.devis).toBeGreaterThanOrEqual(1);
    const relances = await request(http)
      .get(api(`/relances?devisId=${id}`))
      .set(auth(admin))
      .expect(200);
    expect(relances.body).toHaveLength(1);
    expect(relances.body[0]).toMatchObject({
      niveau: 1,
      automatique: true,
      destinataire: clientEmail,
    });
    expect(t.mail.lastTo(clientEmail)?.subject).toMatch(/relance|rappel/i);

    await request(http).post(api('/relances/executer')).set(auth(admin)).expect(200);
    expect(
      (
        await request(http)
          .get(api(`/relances?devisId=${id}`))
          .set(auth(admin))
      ).body,
    ).toHaveLength(1);

    // « Relancer maintenant » (office only), recorded as level 0 and audited
    await request(http)
      .post(api(`/devis/${id}/relancer`))
      .set(auth(chef))
      .expect(403);
    const manual = await request(http)
      .post(api(`/devis/${id}/relancer`))
      .set(auth(technico))
      .expect(201);
    expect(manual.body).toMatchObject({ niveau: 0, automatique: false });
    const audit = await request(http)
      .get(api(`/audit?action=RELANCE_DEVIS`))
      .set(auth(admin))
      .expect(200);
    expect(audit.body.data.some((a: { entiteId: number }) => a.entiteId === id)).toBe(true);
  });

  it('C3: switched off, the run sends nothing', async () => {
    const id = await sentDevis();
    await t.prisma.devis.update({
      where: { id },
      data: { dateEnvoi: new Date(Date.now() - 20 * DAY) },
    });
    await request(http)
      .patch(api('/relances/reglages'))
      .set(auth(admin))
      .send({ relancesActives: false })
      .expect(200);
    const run = await request(http).post(api('/relances/executer')).set(auth(admin)).expect(200);
    expect(run.body).toEqual({ devis: 0, factures: 0, erreurs: 0 });
    await request(http)
      .patch(api('/relances/reglages'))
      .set(auth(admin))
      .send({ relancesActives: true })
      .expect(200);
  });

  it('C42: the client opens a ticket with photos from his space and sees them; the team adds and removes some', async () => {
    const lien = await request(http)
      .post(api(`/clients/${clientId}/espace/lien`))
      .set(auth(admin))
      .expect(201);
    const token = String(lien.body.url).split('/').pop()!;
    const espace = (p = '') => api(`/public/espace-client/${token}${p}`);
    // Étape 2 (26/10): the SAV is opened on a finished job site
    const chantierId = String(
      (
        await request(http)
          .post(api('/chantiers'))
          .set(auth(admin))
          .send({ clientId, adresse: '3 rue des Photos' })
          .expect(201)
      ).body.id,
    );
    await t.prisma.chantier.update({
      where: { id: Number(chantierId) },
      data: { statut: 'TERMINE', dateFin: new Date() },
    });

    // anything but an image is refused, and no ticket is left behind
    await request(http)
      .post(espace('/sav'))
      .field('titre', `${tag} pdf`)
      .field('description', 'x')
      .field('chantierId', chantierId)
      .attach('photos', PDF, 'doc.pdf')
      .expect(422);
    expect(await t.prisma.savTicket.count({ where: { clientId, titre: `${tag} pdf` } })).toBe(0);

    await request(http)
      .post(espace('/sav'))
      .field('titre', `${tag} fuite`)
      .field('description', 'Le joint fuit')
      .field('chantierId', chantierId)
      .attach('photos', PNG, 'fuite.png')
      .attach('photos', PNG, 'fuite2.png')
      .expect(201);
    const view = await request(http).get(espace()).expect(200);
    const ticket = view.body.sav.find((s: { titre: string }) => s.titre === `${tag} fuite`);
    expect(ticket.photos).toHaveLength(2);
    expect(ticket.photos[0].auteur).toBe('CLIENT');

    const img = await request(http)
      .get(espace(`/photos/${ticket.photos[0].id}`))
      .expect(200);
    expect(img.headers['content-type']).toMatch(/image\/png/);
    // another client's link cannot read it
    await request(http)
      .get(api(`/public/espace-client/nope/photos/${ticket.photos[0].id}`))
      .expect(410);

    // the team
    const added = await request(http)
      .post(api(`/sav/${ticket.id}/photos`))
      .set(auth(admin))
      .attach('photos', PNG, 'apres.png')
      .expect(201);
    expect(added.body).toHaveLength(1);
    const detail = await request(http)
      .get(api(`/sav/${ticket.id}`))
      .set(auth(admin))
      .expect(200);
    expect(detail.body.photos).toHaveLength(3);
    await request(http)
      .get(api(`/fichiers/${ticket.photos[0].id}/contenu`))
      .set(auth(admin))
      .expect(200);

    await request(http)
      .delete(api(`/sav/${ticket.id}/photos/${added.body[0].id}`))
      .set(auth(admin))
      .expect(204);
    expect(
      (
        await request(http)
          .get(api(`/sav/${ticket.id}`))
          .set(auth(admin))
      ).body.photos,
    ).toHaveLength(2);

    // the office preview of the client space streams them too
    await request(http)
      .get(api(`/clients/${clientId}/espace/apercu/photos/${ticket.photos[0].id}`))
      .set(auth(admin))
      .expect(200);
  });
});
