import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/**
 * Clients, project types, suppliers and catalogue through real HTTP.
 * Requires a migrated database seeded with the catalogue (`pnpm db:seed`).
 * Test data is prefixed "e2e-ref-" and removed afterwards.
 */
describe('Référentiel (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let sousTraitant: string;
  const tag = `e2e-ref-${Date.now()}`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, chef, sousTraitant] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.chef),
      t.tokenFor(SEED.sousTraitant),
    ]);
  });

  afterAll(async () => {
    const companyId = (await t.prisma.company.findFirstOrThrow()).id;
    await t.prisma.client.deleteMany({ where: { companyId, nom: { startsWith: tag } } });
    await t.prisma.prestation.deleteMany({ where: { companyId, nom: { startsWith: tag } } });
    await t.prisma.materiau.deleteMany({ where: { companyId, nom: { startsWith: tag } } });
    await t.prisma.categoriePrestation.deleteMany({
      where: { companyId, nom: { startsWith: tag } },
    });
    await t.prisma.fournisseur.deleteMany({ where: { companyId, nom: { startsWith: tag } } });
    await t.close();
  });

  describe('clients', () => {
    it('creates a client with project types, then lists and filters it', async () => {
      const types = await request(http).get('/api/v1/types-projet').set(auth(technico)).expect(200);
      const typeIds = types.body.slice(0, 2).map((x: { id: number }) => x.id);

      const created = await request(http)
        .post('/api/v1/clients')
        .set(auth(technico))
        .send({
          nom: `${tag} Martin`,
          email: ' Claire@Mail.FR ',
          typeProjetIds: typeIds,
          source: 'APPEL',
        })
        .expect(201);
      expect(created.body.email).toBe('claire@mail.fr');
      // order of the links is not guaranteed by the database
      expect([...created.body.typeProjetIds].sort((a: number, b: number) => a - b)).toEqual(
        [...typeIds].sort((a: number, b: number) => a - b),
      );

      const list = await request(http)
        .get(`/api/v1/clients?search=${encodeURIComponent(tag)}&source=APPEL`)
        .set(auth(technico))
        .expect(200);
      expect(list.body.meta.total).toBe(1);
      // 29/10: the chef de chantier has no client list any more
      await request(http)
        .get(`/api/v1/clients?search=${encodeURIComponent(tag)}`)
        .set(auth(chef))
        .expect(403);
    });

    it('chef de chantier cannot write (nor read, 29/10), sous-traitant cannot read', async () => {
      await request(http)
        .post('/api/v1/clients')
        .set(auth(chef))
        .send({ nom: `${tag} X` })
        .expect(403);
      await request(http).get('/api/v1/clients').set(auth(sousTraitant)).expect(403);
    });

    it('archives instead of deleting; archived clients leave the default list', async () => {
      const c = await request(http)
        .post('/api/v1/clients')
        .set(auth(admin))
        .send({ nom: `${tag} Archive` })
        .expect(201);

      await request(http)
        .post(`/api/v1/clients/${c.body.id}/archive`)
        .set(auth(technico))
        .expect(200);

      const active = await request(http)
        .get(`/api/v1/clients?search=${encodeURIComponent(`${tag} Archive`)}`)
        .set(auth(admin));
      const archived = await request(http)
        .get(`/api/v1/clients?archived=true&search=${encodeURIComponent(`${tag} Archive`)}`)
        .set(auth(admin));
      expect(active.body.meta.total).toBe(0);
      expect(archived.body.meta.total).toBe(1);
    });

    it('hard-deletes only a client without history (ADMIN only)', async () => {
      const c = await request(http)
        .post('/api/v1/clients')
        .set(auth(admin))
        .send({ nom: `${tag} Typo` })
        .expect(201);
      await request(http).delete(`/api/v1/clients/${c.body.id}`).set(auth(technico)).expect(403);
      await request(http).delete(`/api/v1/clients/${c.body.id}`).set(auth(admin)).expect(204);
    });

    it('rejects an unknown project type', async () => {
      await request(http)
        .post('/api/v1/clients')
        .set(auth(admin))
        .send({ nom: `${tag} Bad`, typeProjetIds: [999999] })
        .expect(422);
    });
  });

  describe('fournisseurs', () => {
    it('?actif=false really returns inactive suppliers (old @Type(() => Boolean) bug)', async () => {
      const f = await request(http)
        .post('/api/v1/fournisseurs')
        .set(auth(admin))
        .send({ nom: `${tag} Fourn` })
        .expect(201);
      await request(http)
        .patch(`/api/v1/fournisseurs/${f.body.id}`)
        .set(auth(admin))
        .send({ actif: false })
        .expect(200);

      const inactive = await request(http)
        .get('/api/v1/fournisseurs?actif=false&limit=100')
        .set(auth(admin))
        .expect(200);
      expect(inactive.body.data.every((x: { actif: boolean }) => x.actif === false)).toBe(true);
      expect(inactive.body.data.some((x: { id: number }) => x.id === f.body.id)).toBe(true);
    });

    it('refuses to delete a supplier that still supplies materials', async () => {
      const list = await request(http)
        .get('/api/v1/fournisseurs?search=Cedeo')
        .set(auth(admin))
        .expect(200);
      await request(http)
        .delete(`/api/v1/fournisseurs/${list.body.data[0].id}`)
        .set(auth(admin))
        .expect(422);
    });
  });

  describe('catalogue', () => {
    it('returns the seeded catalogue as a tree', async () => {
      const res = await request(http).get('/api/v1/catalogue/tree').set(auth(technico)).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(20);
      expect(typeof res.body[0].sousCategories[0].prestations[0].prixVenteMin).toBe('number'); // Decimal → number
      // the chef de chantier sees the same tree without any price (decision D of 20/10)
      const chefTree = await request(http)
        .get('/api/v1/catalogue/tree')
        .set(auth(chef))
        .expect(200);
      expect(chefTree.body[0].sousCategories[0].prestations[0].nom).toBeDefined();
      expect(chefTree.body[0].sousCategories[0].prestations[0].prixVenteMin).toBeUndefined();
    });

    it('prices "Chape béton": the chosen chape type replaces the base composition', async () => {
      const list = await request(http)
        .get(`/api/v1/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`)
        .set(auth(technico))
        .expect(200);
      const id = list.body.data[0].id as number;
      const detail = await request(http)
        .get(`/api/v1/catalogue/prestations/${id}`)
        .set(auth(technico))
        .expect(200);
      const choix = detail.body.options
        .find((o: { nom: string }) => o.nom === 'Type de chape')
        .choix.find((c: { nom: string }) => c.nom === 'Chape fibrée');

      const base = await request(http)
        .post(`/api/v1/catalogue/prestations/${id}/chiffrage`)
        .set(auth(technico))
        .send({ quantite: 20 })
        .expect(200);
      const fibree = await request(http)
        .post(`/api/v1/catalogue/prestations/${id}/chiffrage`)
        .set(auth(technico))
        .send({ quantite: 20, choixIds: [choix.id] })
        .expect(200);

      expect(base.body.compositionSource).toBe('BASE');
      expect(fibree.body.compositionSource).toBe('CHOIX');
      expect(fibree.body.compositionChoix).toBe('Chape fibrée');
      expect(fibree.body.lignes.some((l: { nom: string }) => l.nom.includes('Fibres'))).toBe(true);
      expect(fibree.body.coutTotal).not.toBe(base.body.coutTotal);
    });

    it('chiffrage is refused to the chef de chantier (shows costs and margins)', async () => {
      const list = await request(http)
        .get('/api/v1/catalogue/prestations?limit=1')
        .set(auth(chef))
        .expect(200);
      await request(http)
        .post(`/api/v1/catalogue/prestations/${list.body.data[0].id}/chiffrage`)
        .set(auth(chef))
        .send({ quantite: 1 })
        .expect(403);
    });

    it('full admin flow: category, material, prestation, composition, then protected delete', async () => {
      const cat = await request(http)
        .post('/api/v1/catalogue/categories')
        .set(auth(admin))
        .send({ nom: `${tag} Cat` })
        .expect(201);
      const mat = await request(http)
        .post('/api/v1/catalogue/materiaux')
        .set(auth(admin))
        // exact payload of the web form, "actif" included (was refused on create: 400)
        .send({
          nom: `${tag} Mat`,
          unite: 'KG',
          prixAchatFixe: 12.5,
          fournisseurId: null,
          couleur: null,
          finition: null,
          stockMinimum: 0,
          actif: true,
        })
        .expect(201);
      const prest = await request(http)
        .post('/api/v1/catalogue/prestations')
        .set(auth(admin))
        .send({
          categorieId: cat.body.id,
          sousCategorieId: null,
          nom: `${tag} Prest`,
          description: null,
          unite: 'M2',
          prixVenteMin: 40,
          prixVenteMax: 60,
          actif: true,
        })
        .expect(201);

      const service = await request(http)
        .post('/api/v1/catalogue/services-mo')
        .set(auth(admin))
        .send({
          nom: `${tag} Pose`,
          unite: 'M2',
          prixUnitaire: 18,
          productiviteJour: null,
          coutJournalier: null,
          actif: false,
        })
        .expect(201);
      expect(service.body.actif).toBe(false);

      const composed = await request(http)
        .put(`/api/v1/catalogue/prestations/${prest.body.id}/compositions`)
        .set(auth(admin))
        .send({ items: [{ materiauId: mat.body.id, quantiteParUnite: 2 }] })
        .expect(200);
      expect(composed.body.compositions).toHaveLength(1);

      // material now used by a composition -> 409, deactivating is the way
      await request(http)
        .delete(`/api/v1/catalogue/materiaux/${mat.body.id}`)
        .set(auth(admin))
        .expect(409);
      await request(http)
        .patch(`/api/v1/catalogue/materiaux/${mat.body.id}`)
        .set(auth(admin))
        .send({ actif: false })
        .expect(200);

      // technico can read but not write
      await request(http)
        .post('/api/v1/catalogue/categories')
        .set(auth(technico))
        .send({ nom: `${tag} No` })
        .expect(403);

      // clean order for afterAll: prestation first (cascades its composition)
      await request(http)
        .delete(`/api/v1/catalogue/prestations/${prest.body.id}`)
        .set(auth(admin))
        .expect(204);
    });

    it('refuses a composition line with both a material and a labour service', async () => {
      const list = await request(http)
        .get('/api/v1/catalogue/prestations?limit=1')
        .set(auth(admin));
      await request(http)
        .put(`/api/v1/catalogue/prestations/${list.body.data[0].id}/compositions`)
        .set(auth(admin))
        .send({ items: [{ materiauId: 1, serviceMainOeuvreId: 1, quantiteParUnite: 1 }] })
        .expect(422);
    });

    it('refuses an inverted price range', async () => {
      const cats = await request(http).get('/api/v1/catalogue/categories').set(auth(admin));
      await request(http)
        .post('/api/v1/catalogue/prestations')
        .set(auth(admin))
        .send({
          categorieId: cats.body[0].id,
          nom: `${tag} Bad`,
          prixVenteMin: 90,
          prixVenteMax: 10,
        })
        .expect(422);
    });

    it('runs the catalogue validation', async () => {
      const res = await request(http)
        .get('/api/v1/catalogue/validation')
        .set(auth(admin))
        .expect(200);
      expect(res.body.stats.prestationsActives).toBeGreaterThan(90);
      expect(res.body).toHaveProperty('warnings');
    });
  });

  describe('company settings', () => {
    it('exposes the 35% default deposit and lets ADMIN change settings', async () => {
      const res = await request(http)
        .get('/api/v1/company/settings')
        .set(auth(technico))
        .expect(200);
      expect(res.body.acomptePercentDefault).toBe(35);

      await request(http)
        .patch('/api/v1/company/settings')
        .set(auth(technico))
        .send({ margeCiblePourcent: 40 })
        .expect(403);
      const updated = await request(http)
        .patch('/api/v1/company/settings')
        .set(auth(admin))
        .send({ margeCiblePourcent: res.body.margeCiblePourcent })
        .expect(200);
      expect(updated.body.margeCiblePourcent).toBe(res.body.margeCiblePourcent);
    });
  });
});
