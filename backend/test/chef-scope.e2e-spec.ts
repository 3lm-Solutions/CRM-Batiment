import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/**
 * Chef de chantier scope on LISTS, and the account pickers.
 *
 * Regressions fixed on 2026-10-15:
 *  - GET /chantiers showed every job site to a chef (the query's empty chefChantierId replaced his scope)
 *  - GET /sav?search=… showed every matching ticket to a chef (the search OR replaced his scope OR)
 *  - GET /users/options dropped SOUS_TRAITANT / FOURNISSEUR accounts: no sous-traitant to assign a task to
 */
describe('Chef de chantier scope and account pickers (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let chef: string;
  let sousTraitant: string;
  let chefId: number;
  let stUserId: number;
  let mine: number;
  let other: number;
  let clientId: number;
  const tag = `e2e-chef-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, chef, sousTraitant] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.chef),
      t.tokenFor(SEED.sousTraitant),
    ]);
    chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;
    stUserId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })).id;

    clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} Client` })
        .expect(201)
    ).body.id;
    const create = (chefChantierId: number | null) =>
      request(http)
        .post(api('/chantiers'))
        .set(auth(admin))
        .send({ clientId, adresse: `${tag} rue du Test`, chefChantierId })
        .expect(201);
    mine = (await create(chefId)).body.id;
    other = (await create(null)).body.id;

    for (const [chantierId, titre] of [
      [mine, `${tag} mon ticket`],
      [other, `${tag} autre ticket`],
    ] as const) {
      await request(http)
        .post(api('/sav'))
        .set(auth(admin))
        .send({ clientId, chantierId, titre, description: 'Test' })
        .expect(201);
    }
  });

  afterAll(() => t.close());

  it('the job site list only shows the chef his own job sites, with or without search', async () => {
    const all = await request(http).get(api('/chantiers?limit=100')).set(auth(chef)).expect(200);
    expect(
      all.body.data.every(
        (c: { chefChantier: { id: number } | null }) => c.chefChantier?.id === chefId,
      ),
    ).toBe(true);

    const search = await request(http)
      .get(api(`/chantiers?search=${encodeURIComponent(tag)}`))
      .set(auth(chef))
      .expect(200);
    expect(search.body.data.map((c: { id: number }) => c.id)).toEqual([mine]);

    // Asking for another chef's job sites does not widen the scope
    const forced = await request(http)
      .get(api(`/chantiers?chefChantierId=999999`))
      .set(auth(chef))
      .expect(200);
    expect(forced.body.data).toHaveLength(0);

    // The office still sees both
    const office = await request(http)
      .get(api(`/chantiers?search=${encodeURIComponent(tag)}`))
      .set(auth(admin))
      .expect(200);
    expect(office.body.data.map((c: { id: number }) => c.id).sort()).toEqual([mine, other].sort());
  });

  it('29/10 — no client list or client page for the chef: he sees the client inside HIS job site', async () => {
    await request(http).get(api('/clients?limit=100')).set(auth(chef)).expect(403);
    await request(http)
      .get(api(`/clients/${clientId}`))
      .set(auth(chef))
      .expect(403);
    await request(http).get(api('/clients?statut=PROSPECT')).set(auth(chef)).expect(403);

    const chantier = await request(http)
      .get(api(`/chantiers/${mine}`))
      .set(auth(chef))
      .expect(200);
    expect(chantier.body.client.id).toBe(clientId);

    const vueAdmin = await request(http)
      .get(api(`/clients/${clientId}`))
      .set(auth(admin))
      .expect(200);
    expect(vueAdmin.body._count.chantiers).toBe(2);
  });

  it('opening a job site that is not his gives the clear 403 message', async () => {
    const res = await request(http)
      .get(api(`/chantiers/${other}`))
      .set(auth(chef))
      .expect(403);
    expect(JSON.stringify(res.body)).toContain('ne vous est pas affecté');
  });

  it('a SAV search never shows the chef tickets outside his scope', async () => {
    const res = await request(http)
      .get(api(`/sav?search=${encodeURIComponent(tag)}`))
      .set(auth(chef))
      .expect(200);
    expect(res.body.data.map((s: { titre: string }) => s.titre)).toEqual([`${tag} mon ticket`]);
  });

  it('29/10 — SAV: the chef picks one of HIS job sites (no client list), the client comes from the job site', async () => {
    const liste = await request(http).get(api('/sav/chantiers')).set(auth(chef)).expect(200);
    const ids = liste.body.chantiers.map((c: { id: number }) => c.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(other);
    expect(liste.body.chantiers.find((c: { id: number }) => c.id === mine).client.id).toBe(
      clientId,
    );
    // The office must give the client
    await request(http).get(api('/sav/chantiers')).set(auth(admin)).expect(422);

    await t.prisma.chantier.updateMany({
      where: { id: { in: [mine, other] } },
      data: { statut: 'TERMINE', dateFin: new Date() },
    });
    const refused = await request(http)
      .post(api('/sav'))
      .set(auth(chef))
      .send({ clientId, chantierId: other, titre: 'SAV chef refusé', description: 'x' })
      .expect(422);
    expect(refused.body.code).toBe('LIEN_INVALIDE');
    // A wrong clientId is replaced by the job site's client
    const ok = await request(http)
      .post(api('/sav'))
      .set(auth(chef))
      .send({ clientId: 999999, chantierId: mine, titre: 'SAV chef', description: 'x' })
      .expect(201);
    expect(ok.body.client.id).toBe(clientId);
    expect(ok.body.facture).toBeNull();
  });

  it('account pickers list sous-traitant accounts; supplier accounts for the admin only', async () => {
    const forChef = await request(http)
      .get(api('/users/options?roles=CHEF_CHANTIER,SOUS_TRAITANT'))
      .set(auth(chef))
      .expect(200);
    const roles = new Set(forChef.body.map((u: { role: string }) => u.role));
    expect(roles.has('SOUS_TRAITANT')).toBe(true);
    expect(roles.has('CHEF_CHANTIER')).toBe(true);

    const fournisseurAsChef = await request(http)
      .get(api('/users/options?roles=FOURNISSEUR'))
      .set(auth(chef))
      .expect(200);
    expect(fournisseurAsChef.body).toHaveLength(0);
    const fournisseurAsAdmin = await request(http)
      .get(api('/users/options?roles=FOURNISSEUR'))
      .set(auth(admin))
      .expect(200);
    expect(fournisseurAsAdmin.body.length).toBeGreaterThan(0);

    // Without roles: internal staff only, as before
    const staff = await request(http).get(api('/users/options')).set(auth(admin)).expect(200);
    expect(
      staff.body.some(
        (u: { role: string }) => u.role === 'SOUS_TRAITANT' || u.role === 'FOURNISSEUR',
      ),
    ).toBe(false);
  });

  it('the chef assigns a task to a sous-traitant, who then sees the job site in his portal', async () => {
    await request(http)
      .post(api(`/chantiers/${mine}/taches`))
      .set(auth(chef))
      .send({ libelle: `${tag} Pose carrelage`, assigneeIds: [stUserId] })
      .expect(201);
    const portal = await request(http)
      .get(api('/portail/sous-traitant/chantiers'))
      .set(auth(sousTraitant))
      .expect(200);
    const ids = (Array.isArray(portal.body) ? portal.body : portal.body.data).map(
      (c: { id: number }) => c.id,
    );
    expect(ids).toContain(mine);
  });
});
