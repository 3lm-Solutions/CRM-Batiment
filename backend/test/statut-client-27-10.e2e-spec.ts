import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 27/10: prospect → qualified prospect → client (first signed quote); SIRET = 14 digits. */
describe('Prospect / prospect qualifié / client (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  const tag = `e2e-st27-${Date.now()}`;
  const auth = (tk: string) => ({ Authorization: `Bearer ${tk}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico] = await Promise.all([t.tokenFor(SEED.admin), t.tokenFor(SEED.technico)]);
  });

  afterAll(async () => {
    const ids = (
      await t.prisma.client.findMany({ where: { nom: { startsWith: tag } }, select: { id: true } })
    ).map((c) => c.id);
    await t.prisma.facture.deleteMany({ where: { devis: { clientId: { in: ids } } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { devis: { clientId: { in: ids } } } });
    await t.prisma.devis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.demandeDevis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.chantier.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.client.deleteMany({ where: { id: { in: ids } } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null },
    });
    await t.close();
  });

  it('moves up on its own: request qualified → QUALIFIE, quote signed → CLIENT; lists split', async () => {
    const c = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ nom: `${tag} Martin`, email: `${tag}@x.test` })
      .expect(201);
    expect(c.body).toMatchObject({ statut: 'QUALIFIE', devenuClientLe: null }); // 29/10: entered by hand = qualified

    const prospects = await request(http)
      .get(api(`/clients?statuts=PROSPECT,QUALIFIE&search=${encodeURIComponent(tag)}`))
      .set(auth(admin))
      .expect(200);
    expect(prospects.body.data.map((x: { id: number }) => x.id)).toContain(c.body.id);
    const clients = await request(http)
      .get(api(`/clients?statuts=CLIENT&search=${encodeURIComponent(tag)}`))
      .set(auth(admin))
      .expect(200);
    expect(clients.body.data.map((x: { id: number }) => x.id)).not.toContain(c.body.id);

    const demande = await request(http)
      .post(api('/demandes-devis'))
      .set(auth(admin))
      .send({ clientId: c.body.id, description: 'Salle de bain' })
      .expect(201);
    await request(http)
      .post(api(`/demandes-devis/${demande.body.id}/qualifier`))
      .set(auth(admin))
      .expect(200);
    expect((await t.prisma.client.findUniqueOrThrow({ where: { id: c.body.id } })).statut).toBe(
      'QUALIFIE',
    );

    // a signed quote makes him a client (never moved down afterwards)
    await request(http)
      .put(api('/auth/me/signature'))
      .set(auth(technico))
      .send({ signatureBase64: PNG });
    const chape = (
      await request(http)
        .get(api(`/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`))
        .set(auth(admin))
    ).body.data[0].id;
    const devis = await request(http)
      .post(api('/devis'))
      .set(auth(technico))
      .send({ clientId: c.body.id })
      .expect(201);
    const p = await request(http)
      .get(api(`/catalogue/prestations/${chape}`))
      .set(auth(technico));
    const choixIds = p.body.options.flatMap(
      (o: { obligatoire: boolean; choix: { id: number }[] }) =>
        o.obligatoire ? [o.choix[0].id] : [],
    );
    await request(http)
      .post(api(`/devis/${devis.body.id}/lignes`))
      .set(auth(technico))
      .send({ prestationId: chape, choixIds, quantite: 5 })
      .expect(201);
    await request(http)
      .post(api(`/devis/${devis.body.id}/envoyer`))
      .set(auth(technico))
      .expect(200);
    await request(http)
      .post(api(`/devis/${devis.body.id}/signer-conseiller`))
      .set(auth(technico))
      .send({ verbal: true })
      .expect(200);
    const signe = await t.prisma.client.findUniqueOrThrow({ where: { id: c.body.id } });
    expect(signe.statut).toBe('CLIENT');
    expect(signe.devenuClientLe).not.toBeNull();
  });

  it('a quote sent is enough to qualify; manual change of the stage; SIRET any 14 digits', async () => {
    const c = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ nom: `${tag} Durand` })
      .expect(201);
    const q = await request(http)
      .patch(api(`/clients/${c.body.id}`))
      .set(auth(admin))
      .send({ statut: 'QUALIFIE' })
      .expect(200);
    expect(q.body.statut).toBe('QUALIFIE');
    const back = await request(http)
      .patch(api(`/clients/${c.body.id}`))
      .set(auth(admin))
      .send({ statut: 'CLIENT' })
      .expect(200);
    expect(back.body.devenuClientLe).not.toBeNull();
    await request(http).get(api('/clients?statuts=AUTRE')).set(auth(admin)).expect(400);

    const pro = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ typeClient: 'PROFESSIONNEL', nom: `${tag} SAS`, siret: '12345678910123' })
      .expect(201);
    expect(pro.body.siret).toBe('12345678910123');
  });
});
