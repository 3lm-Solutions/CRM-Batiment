import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Role audit of 29/10:
 *  - chef de chantier: no Prospects / Clients (lists and pages), no invoices at all,
 *    quotes kept (signed ones of his job sites, without amounts);
 *  - technico: invoices read-only (no create, edit, issue, send, payment, cancel, reminder);
 *  - assistante and admin: full invoicing.
 */
describe('Accès par rôle — 29/10 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let assistante: string;
  let chef: string;
  let clientId: number;
  let devisId: number;
  let acompteId: number;
  const tag = `e2e-roles-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, assistante, chef] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.assistante),
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
        .send({ nom: `${tag} Client`, email: `${tag}@client.test` })
        .expect(201)
    ).body.id;

    const list = await request(http)
      .get(api(`/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`))
      .set(auth(technico));
    const chapeId = list.body.data[0].id as number;
    const detail = await request(http)
      .get(api(`/catalogue/prestations/${chapeId}`))
      .set(auth(technico));
    const choixIds = [
      detail.body.options
        .find((o: { nom: string }) => o.nom === 'Type de chape')
        .choix.find((c: { nom: string }) => c.nom === 'Chape fibrée').id,
    ];

    devisId = (
      await request(http).post(api('/devis')).set(auth(technico)).send({ clientId }).expect(201)
    ).body.id;
    await request(http)
      .post(api(`/devis/${devisId}/lignes`))
      .set(auth(technico))
      .send({ prestationId: chapeId, choixIds, quantite: 10 })
      .expect(201);
    await request(http)
      .post(api(`/devis/${devisId}/envoyer`))
      .set(auth(technico))
      .expect(200);
    await request(http)
      .post(api(`/devis/${devisId}/signer-conseiller`))
      .set(auth(technico))
      .send({ verbal: true })
      .expect(200);
    acompteId = (
      await request(http)
        .get(api(`/factures?devisId=${devisId}`))
        .set(auth(admin))
        .expect(200)
    ).body.data[0].id;
  });

  afterAll(async () => {
    await t.prisma.facture.deleteMany({ where: { devis: { clientId }, typeFacture: 'AVOIR' } });
    await t.prisma.facture.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null },
    });
    await t.close();
  });

  it('chef: no prospects, no clients, no invoices', async () => {
    await request(http).get(api('/clients?statut=PROSPECT')).set(auth(chef)).expect(403);
    await request(http).get(api('/clients')).set(auth(chef)).expect(403);
    await request(http)
      .get(api(`/clients/${clientId}`))
      .set(auth(chef))
      .expect(403);
    await request(http).get(api('/factures')).set(auth(chef)).expect(403);
    await request(http)
      .get(api(`/factures/${acompteId}`))
      .set(auth(chef))
      .expect(403);
    await request(http)
      .post(api(`/factures/${acompteId}/relancer`))
      .set(auth(chef))
      .expect(403);
    await request(http)
      .get(api(`/relances?devisId=${devisId}`))
      .set(auth(chef))
      .expect(403);
  });

  it('chef: quotes kept, without amounts (signed quote of his job site)', async () => {
    const devis = (
      await request(http)
        .get(api(`/devis/${devisId}`))
        .set(auth(admin))
    ).body;
    const chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;
    await request(http)
      .patch(api(`/chantiers/${devis.chantier.id}`))
      .set(auth(admin))
      .send({ chefChantierId: chefId })
      .expect(200);
    const vue = await request(http)
      .get(api(`/devis/${devisId}`))
      .set(auth(chef))
      .expect(200);
    expect(vue.body.totalTTC).toBeUndefined();
    expect(vue.body.totalHT).toBeUndefined();
  });

  it('technico: invoices read-only', async () => {
    const liste = await request(http)
      .get(api(`/factures?devisId=${devisId}`))
      .set(auth(technico))
      .expect(200);
    expect(liste.body.data.map((f: { id: number }) => f.id)).toContain(acompteId);
    await request(http)
      .get(api(`/factures/${acompteId}`))
      .set(auth(technico))
      .expect(200);

    await request(http)
      .patch(api(`/factures/${acompteId}`))
      .set(auth(technico))
      .send({ notes: 'x' })
      .expect(403);
    await request(http)
      .post(api(`/factures/${acompteId}/emettre`))
      .set(auth(technico))
      .send({ envoyerEmail: false })
      .expect(403);
    await request(http)
      .post(api(`/factures/${acompteId}/payer`))
      .set(auth(technico))
      .send({})
      .expect(403);
    await request(http)
      .post(api(`/factures/${acompteId}/annuler`))
      .set(auth(technico))
      .send({})
      .expect(403);
    await request(http)
      .delete(api(`/factures/${acompteId}`))
      .set(auth(technico))
      .expect(403);
    await request(http)
      .post(api(`/devis/${devisId}/factures/situation`))
      .set(auth(technico))
      .send({ avancementCumule: 30 })
      .expect(403);
    await request(http)
      .post(api(`/devis/${devisId}/factures/finale`))
      .set(auth(technico))
      .send({})
      .expect(403);
    await request(http)
      .post(api(`/factures/${acompteId}/relancer`))
      .set(auth(technico))
      .expect(403);
    // He still reads the reminders (of a quote or an invoice)
    await request(http)
      .get(api(`/relances?devisId=${devisId}`))
      .set(auth(technico))
      .expect(200);
    await request(http)
      .get(api(`/relances?factureId=${acompteId}`))
      .set(auth(technico))
      .expect(200);
  });

  it('assistante: issues and records the payment of the invoice', async () => {
    await request(http)
      .post(api(`/factures/${acompteId}/emettre`))
      .set(auth(assistante))
      .send({ envoyerEmail: false })
      .expect(200);
    const paid = await request(http)
      .post(api(`/factures/${acompteId}/payer`))
      .set(auth(assistante))
      .send({})
      .expect(200);
    expect(paid.body.statut).toBe('PAYEE');
  });
});
