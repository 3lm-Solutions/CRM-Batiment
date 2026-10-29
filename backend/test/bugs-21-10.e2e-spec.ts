import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Bugs B1, B2, B3, B5 of the audit of 20/10 (steps 1–2). Requires a migrated, seeded database. */
describe('Audit 20/10 — bugs B1, B2, B3, B5 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let clientId: number;
  let chapeId: number;
  let logoBefore: string | null = null;
  const tag = `e2e-b-${Date.now()}`;
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
    await request(http)
      .put(api('/auth/me/signature'))
      .set(auth(technico))
      .send({ signatureBase64: PNG });
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
    logoBefore = (await t.prisma.company.findFirstOrThrow({ select: { logo: true } })).logo;
  });

  afterAll(async () => {
    await t.prisma.facture.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.savTicket.deleteMany({ where: { clientId } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.company.updateMany({ data: { logo: logoBefore } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null },
    });
    await t.close();
  });

  it('B1: an issued invoice records when and to whom it was emailed', async () => {
    const devis = await request(http)
      .post(api('/devis'))
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    const lignes = await request(http)
      .get(api(`/catalogue/prestations/${chapeId}`))
      .set(auth(technico));
    const choix = lignes.body.options.flatMap(
      (o: { obligatoire: boolean; choix: { id: number }[] }) =>
        o.obligatoire ? [o.choix[0].id] : [],
    );
    await request(http)
      .post(api(`/devis/${devis.body.id}/lignes`))
      .set(auth(technico))
      .send({ prestationId: chapeId, choixIds: choix, quantite: 10 })
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
    const [acompte] = (
      await request(http)
        .get(api(`/factures?devisId=${devis.body.id}`))
        .set(auth(admin))
    ).body.data;

    const emitted = await request(http)
      .post(api(`/factures/${acompte.id}/emettre`))
      .set(auth(admin))
      .send({ envoyerEmail: true })
      .expect(200);
    expect(emitted.body.emailSent).toBe(true);
    expect(emitted.body.facture.emailEnvoiClient).toBe(clientEmail);
    expect(emitted.body.facture.dateEnvoiClient).toBeTruthy();
  });

  it('B2: the chef sees no amount on supplier orders nor on sous-traitants', async () => {
    const commandes = await request(http)
      .get(api('/commandes-fournisseur?limit=20'))
      .set(auth(chef))
      .expect(200);
    expect(JSON.stringify(commandes.body)).not.toMatch(/"totalHT"|"prixUnitaire"/);

    const st = await t.prisma.sousTraitant.findFirstOrThrow({ select: { id: true } });
    const fiche = await request(http)
      .get(api(`/sous-traitants/${st.id}`))
      .set(auth(chef))
      .expect(200);
    expect(fiche.body).not.toHaveProperty('paiements');
    expect(JSON.stringify(fiche.body)).not.toMatch(/"montantHT"|"montantTTC"/);

    // the office still sees them
    const office = await request(http)
      .get(api(`/sous-traitants/${st.id}`))
      .set(auth(admin))
      .expect(200);
    expect(office.body).toHaveProperty('paiements');
  });

  it('B3: the admin sets and removes the company logo; anything but an image is refused', async () => {
    await request(http)
      .patch(api('/company'))
      .set(auth(admin))
      .send({ logo: 'data:text/html;base64,PHNjcmlwdD4=' })
      .expect(400);
    await request(http).patch(api('/company')).set(auth(technico)).send({ logo: PNG }).expect(403);
    await request(http).patch(api('/company')).set(auth(admin)).send({ logo: PNG }).expect(200);
    expect((await request(http).get(api('/company')).set(auth(admin))).body.logo).toBe(PNG);
    await request(http).patch(api('/company')).set(auth(admin)).send({ logo: null }).expect(200);
    expect((await request(http).get(api('/company')).set(auth(admin))).body.logo).toBeNull();
  });

  it('B5: the SAV email does not mention a client space the client does not have', async () => {
    await t.prisma.clientEspaceLien.updateMany({
      where: { clientId },
      data: { revokedAt: new Date() },
    });
    const ticket = await request(http)
      .post(api('/sav'))
      .set(auth(admin))
      .send({ clientId, titre: `${tag} fuite`, description: 'x' })
      .expect(201);
    await request(http)
      .post(api(`/sav/${ticket.body.id}/prendre-en-charge`))
      .set(auth(admin))
      .expect(200);
    const mail = t.mail.lastTo(clientEmail);
    expect(mail?.text).toContain('contactez');
    expect(mail?.text).not.toContain('espace client');
  });
});
