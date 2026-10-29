import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/** Steps 3–4 of 21/10: E1 options editor, E6 quote requests, E7 sous-traitant availabilities, C9 margin per job site. */
describe('Étapes 3–4 — E1, E6, E7, C9 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let assistante: string;
  let st: string;
  let prestationId: number;
  let clientId: number;
  const tag = `e2e-s34-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, assistante, st] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.assistante),
      t.tokenFor(SEED.sousTraitant),
    ]);
    prestationId = (await t.prisma.prestation.findFirstOrThrow({ select: { id: true } })).id;
    clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} Client` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await t.prisma.optionPrestation.deleteMany({ where: { nom: { startsWith: tag } } });
    await t.prisma.demandeDevis.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.disponibiliteSousTraitant.deleteMany({ where: { notes: { startsWith: tag } } });
    await t.close();
  });

  it('E1: the admin creates an option, its choices and a choice composition; others cannot', async () => {
    await request(http)
      .post(api(`/catalogue/prestations/${prestationId}/options`))
      .set(auth(technico))
      .send({ nom: `${tag} Finition` })
      .expect(403);

    const option = await request(http)
      .post(api(`/catalogue/prestations/${prestationId}/options`))
      .set(auth(admin))
      .send({ nom: `${tag} Finition`, obligatoire: true })
      .expect(201);
    const mat = await request(http)
      .post(api(`/catalogue/options/${option.body.id}/choix`))
      .set(auth(admin))
      .send({ nom: 'Mat', impactPrix: 0 })
      .expect(201);
    const brillant = await request(http)
      .post(api(`/catalogue/options/${option.body.id}/choix`))
      .set(auth(admin))
      .send({ nom: 'Brillant', impactPrix: 4.5 })
      .expect(201);

    await request(http)
      .patch(api(`/catalogue/choix/${mat.body.id}`))
      .set(auth(admin))
      .send({ actif: false })
      .expect(200);
    const materiau = await t.prisma.materiau.findFirstOrThrow({
      where: { actif: true },
      select: { id: true },
    });
    await request(http)
      .put(api(`/catalogue/choix/${brillant.body.id}/compositions`))
      .set(auth(admin))
      .send({ items: [{ materiauId: materiau.id, quantiteParUnite: 1.2 }] })
      .expect(200);

    const detail = await request(http)
      .get(api(`/catalogue/prestations/${prestationId}`))
      .set(auth(admin))
      .expect(200);
    const o = detail.body.options.find((x: { id: number }) => x.id === option.body.id);
    expect(o.obligatoire).toBe(true);
    expect(o.choix.find((c: { id: number }) => c.id === mat.body.id).actif).toBe(false);
    expect(
      o.choix.find((c: { id: number }) => c.id === brillant.body.id).compositions,
    ).toHaveLength(1);

    await request(http)
      .delete(api(`/catalogue/choix/${mat.body.id}`))
      .set(auth(admin))
      .expect(204);
    await request(http)
      .delete(api(`/catalogue/options/${option.body.id}`))
      .set(auth(admin))
      .expect(204);
  });

  it('E6: a request is corrected and deleted; once converted it cannot be', async () => {
    const d = await request(http)
      .post(api('/demandes-devis'))
      .set(auth(assistante))
      .send({ clientId, description: 'Salle de bain', source: 'APPEL' })
      .expect(201);
    const updated = await request(http)
      .patch(api(`/demandes-devis/${d.body.id}`))
      .set(auth(assistante))
      .send({ description: 'Salle de bain 6 m²', source: 'SITE_WEB' })
      .expect(200);
    expect(updated.body).toMatchObject({ description: 'Salle de bain 6 m²', source: 'SITE_WEB' });
    await request(http)
      .delete(api(`/demandes-devis/${d.body.id}`))
      .set(auth(assistante))
      .expect(403);
    await request(http)
      .delete(api(`/demandes-devis/${d.body.id}`))
      .set(auth(technico))
      .expect(204);

    const d2 = await request(http)
      .post(api('/demandes-devis'))
      .set(auth(assistante))
      .send({ clientId, description: 'Cuisine', source: 'APPEL' })
      .expect(201);
    await request(http)
      .post(api(`/demandes-devis/${d2.body.id}/convertir-en-devis`))
      .set(auth(technico))
      .expect(200);
    const refused = await request(http)
      .delete(api(`/demandes-devis/${d2.body.id}`))
      .set(auth(technico))
      .expect(422);
    expect(refused.body.code).toBe('DEMANDE_AVEC_DEVIS');
    await t.prisma.devis.deleteMany({ where: { clientId } });
  });

  it('E7: the sous-traitant manages his own availabilities, seen on his record by the office', async () => {
    const debut = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const fin = new Date(Date.now() + 9 * 86_400_000).toISOString();
    const bad = await request(http)
      .post(api('/portail/sous-traitant/disponibilites'))
      .set(auth(st))
      .send({ dateDebut: fin, dateFin: debut })
      .expect(422);
    expect(bad.body.code).toBe('DATES_INVALIDES');

    const created = await request(http)
      .post(api('/portail/sous-traitant/disponibilites'))
      .set(auth(st))
      .send({ dateDebut: debut, dateFin: fin, disponible: false, notes: `${tag} congés` })
      .expect(201);
    const mine = await request(http)
      .get(api('/portail/sous-traitant/disponibilites'))
      .set(auth(st))
      .expect(200);
    expect(mine.body.map((x: { id: number }) => x.id)).toContain(created.body.id);

    const record = await t.prisma.sousTraitant.findFirstOrThrow({
      where: { utilisateur: { email: SEED.sousTraitant } },
      select: { id: true },
    });
    const office = await request(http)
      .get(api(`/sous-traitants/${record.id}`))
      .set(auth(admin))
      .expect(200);
    expect(office.body.disponibilites.map((x: { id: number }) => x.id)).toContain(created.body.id);

    // nobody else's period can be deleted through the portal; the office cannot use the portal route
    await request(http)
      .delete(api('/portail/sous-traitant/disponibilites/999999'))
      .set(auth(st))
      .expect(404);
    await request(http)
      .get(api('/portail/sous-traitant/disponibilites'))
      .set(auth(admin))
      .expect(403);
    await request(http)
      .delete(api(`/portail/sous-traitant/disponibilites/${created.body.id}`))
      .set(auth(st))
      .expect(204);
  });

  it('C9: the dashboard lists the planned margin per job site, worst first', async () => {
    const res = await request(http).get(api('/dashboard?jours=30')).set(auth(admin)).expect(200);
    const m = res.body.margesChantiers;
    expect(m).toMatchObject({
      seuil: expect.any(Number),
      nombre: expect.any(Number),
      sousSeuil: expect.any(Number),
    });
    const marges = m.liste.map(
      (c: { margePourcent: number | null }) => c.margePourcent ?? Infinity,
    );
    expect([...marges].sort((a: number, b: number) => a - b)).toEqual(marges);
  });
});
