import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/**
 * Fixes of 21/10: a supplier's materials picked from the catalogue (no more free text), linked
 * from a new order; a cancelled contract without payments can be deleted.
 */
describe('Correctifs 21/10 — matériaux du fournisseur, suppression de contrat (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let clientId: number;
  let chantierId: number;
  const tag = `e2e-c2110-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico] = await Promise.all([t.tokenFor(SEED.admin), t.tokenFor(SEED.technico)]);
    clientId = (await request(http).post(api('/clients')).set(auth(admin)).send({ nom: `${tag} Client` }).expect(201)).body.id;
    chantierId = (await request(http).post(api('/chantiers')).set(auth(admin)).send({ clientId, adresse: '1 rue du Test' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await t.prisma.materiau.deleteMany({ where: { nom: { startsWith: tag } } });
    await t.prisma.fournisseur.deleteMany({ where: { nom: { startsWith: tag } } });
    const sts = (await t.prisma.sousTraitant.findMany({ where: { nom: { startsWith: tag } }, select: { id: true } })).map((s) => s.id);
    await t.prisma.paiementSousTraitant.deleteMany({ where: { sousTraitantId: { in: sts } } });
    await t.prisma.contratSousTraitant.deleteMany({ where: { sousTraitantId: { in: sts } } });
    await t.prisma.sousTraitant.deleteMany({ where: { id: { in: sts } } });
    await t.prisma.chantier.delete({ where: { id: chantierId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.close();
  });

  const materiau = async (nom: string) =>
    (await request(http).post(api('/catalogue/materiaux')).set(auth(admin)).send({ nom: `${tag} ${nom}`, prixAchatFixe: 10, unite: 'M2' }).expect(201)).body.id as number;

  it('a supplier is created with its materials; a material of another supplier moves to it', async () => {
    const [carrelage, colle] = [await materiau('Carrelage'), await materiau('Colle')];
    const a = await request(http).post(api('/fournisseurs')).set(auth(admin)).send({ nom: `${tag} A`, materiauIds: [carrelage] }).expect(201);
    expect(a.body._count.materiaux).toBe(1);
    expect(a.body.materiaux.map((m: { id: number }) => m.id)).toEqual([carrelage]);

    const b = await request(http).post(api('/fournisseurs')).set(auth(admin)).send({ nom: `${tag} B`, materiauIds: [carrelage, colle] }).expect(201);
    expect(b.body._count.materiaux).toBe(2);
    expect((await t.prisma.materiau.findUniqueOrThrow({ where: { id: carrelage } })).fournisseurId).toBe(b.body.id);

    // search by material name
    const found = await request(http).get(api(`/fournisseurs?search=${encodeURIComponent(`${tag} Colle`)}`)).set(auth(admin)).expect(200);
    expect(found.body.data.map((f: { id: number }) => f.id)).toEqual([b.body.id]);

    // update without materiauIds keeps them; with a list replaces them
    await request(http).patch(api(`/fournisseurs/${b.body.id}`)).set(auth(admin)).send({ delaiLivraison: 3 }).expect(200);
    expect(await t.prisma.materiau.count({ where: { fournisseurId: b.body.id } })).toBe(2);
    await request(http).patch(api(`/fournisseurs/${b.body.id}`)).set(auth(admin)).send({ materiauIds: [colle] }).expect(200);
    expect((await t.prisma.materiau.findUniqueOrThrow({ where: { id: carrelage } })).fournisseurId).toBeNull();

    // unknown material refused, nothing changed
    const bad = await request(http).patch(api(`/fournisseurs/${b.body.id}`)).set(auth(admin)).send({ materiauIds: [colle, 99_999_999] }).expect(422);
    expect(bad.body.code).toBe('MATERIAU_INTROUVABLE');
  });

  it('« Rattacher des matériaux » from a new order: admin only, then the order offers them', async () => {
    const vide = await request(http).post(api('/fournisseurs')).set(auth(admin)).send({ nom: `${tag} Vide` }).expect(201);
    const sable = await materiau('Sable');
    await request(http).put(api(`/fournisseurs/${vide.body.id}/materiaux`)).set(auth(technico)).send({ materiauIds: [sable] }).expect(403);
    await request(http).put(api(`/fournisseurs/${vide.body.id}/materiaux`)).set(auth(admin)).send({ materiauIds: [sable] }).expect(200);

    const offered = await request(http).get(api(`/catalogue/materiaux?fournisseurId=${vide.body.id}&actif=true`)).set(auth(technico)).expect(200);
    expect(offered.body.data.map((m: { id: number }) => m.id)).toEqual([sable]);
    const cmd = await request(http)
      .post(api('/commandes-fournisseur'))
      .set(auth(technico))
      .send({ fournisseurId: vide.body.id, lignes: [{ materiauId: sable, quantite: 2 }] })
      .expect(201);
    await t.prisma.commandeFournisseur.delete({ where: { id: cmd.body.id } });
  });

  it('a cancelled contract without payments is deleted, then the sous-traitant itself', async () => {
    const st = (await request(http).post(api('/sous-traitants')).set(auth(admin)).send({ nom: `${tag} ST` }).expect(201)).body.id as number;
    const contrat = (n: number) =>
      request(http).post(api('/contrats-sous-traitance')).set(auth(admin)).send({ sousTraitantId: st, chantierId, montantHT: n }).expect(201);

    const resilie = (await contrat(500)).body.id as number;
    const paye = (await contrat(800)).body.id as number;
    const actif = (await contrat(900)).body.id as number;
    await t.prisma.contratSousTraitant.updateMany({ where: { id: { in: [resilie, paye] } }, data: { statut: 'RESILIE' } });
    await t.prisma.contratSousTraitant.update({ where: { id: actif }, data: { statut: 'ACTIF' } });
    const company = await t.prisma.sousTraitant.findUniqueOrThrow({ where: { id: st }, select: { companyId: true } });
    await t.prisma.paiementSousTraitant.create({
      data: { companyId: company.companyId, sousTraitantId: st, contratId: paye, montantHT: 100, montantTTC: 120, datePaiement: new Date(), modePaiement: 'VIREMENT' },
    });

    expect((await request(http).delete(api(`/contrats-sous-traitance/${actif}`)).set(auth(admin)).expect(422)).body.code).toBe('CONTRAT_ACTIF');
    expect((await request(http).delete(api(`/contrats-sous-traitance/${paye}`)).set(auth(admin)).expect(422)).body.code).toBe('CONTRAT_AVEC_PAIEMENTS');
    await request(http).delete(api(`/contrats-sous-traitance/${resilie}`)).set(auth(admin)).expect(204);

    // still history (paid + active contracts): the sous-traitant stays
    await request(http).delete(api(`/sous-traitants/${st}`)).set(auth(admin)).expect(422);
    await t.prisma.paiementSousTraitant.deleteMany({ where: { sousTraitantId: st } });
    await request(http).delete(api(`/contrats-sous-traitance/${paye}`)).set(auth(admin)).expect(204);
    await t.prisma.contratSousTraitant.delete({ where: { id: actif } });
    await request(http).delete(api(`/sous-traitants/${st}`)).set(auth(admin)).expect(204);
  });
});
