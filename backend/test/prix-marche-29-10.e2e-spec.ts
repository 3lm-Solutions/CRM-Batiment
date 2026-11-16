import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 29/10 — prix de marché: signed quotes, imported price list (CSV, Admin), quote editor. */
describe('Prix de marché — 29/10 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let companyId: number;
  let chape: { id: number; nom: string; unite: string };
  let choixIds: number[];
  let clientId: number;
  let baremeAvant: Awaited<ReturnType<TestApp['prisma']['prixReference']['findMany']>>;
  let moisAvant: number;
  const tag = `e2e-pm29-${Date.now()}`;
  const auth = (tk: string) => ({ Authorization: `Bearer ${tk}` });
  const api = (p: string) => `/api/v1${p}`;

  /** A quote with one « Chape béton » line at this unit price (null = suggested price). */
  async function devisChape(prix: number | null, signer: boolean) {
    const devis = await request(http)
      .post(api('/devis'))
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    await request(http)
      .post(api(`/devis/${devis.body.id}/lignes`))
      .set(auth(technico))
      .send({
        prestationId: chape.id,
        choixIds,
        quantite: 5,
        ...(prix !== null && { prixUnitaireVente: prix }),
      })
      .expect(201);
    if (signer) {
      await request(http)
        .post(api(`/devis/${devis.body.id}/envoyer`))
        .set(auth(technico))
        .expect(200);
      await request(http)
        .post(api(`/devis/${devis.body.id}/signer-conseiller`))
        .set(auth(technico))
        .send({ verbal: true })
        .expect(200);
    }
    return devis.body.id as number;
  }

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, chef] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.chef),
    ]);
    companyId = (await t.prisma.company.findFirstOrThrow()).id;
    baremeAvant = await t.prisma.prixReference.findMany({ where: { companyId } });
    moisAvant = (await t.prisma.company.findUniqueOrThrow({ where: { id: companyId } }))
      .prixMarcheMois;
    await request(http)
      .put(api('/auth/me/signature'))
      .set(auth(technico))
      .send({ signatureBase64: PNG });
    const p = (
      await request(http)
        .get(api(`/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`))
        .set(auth(admin))
    ).body.data[0];
    chape = { id: p.id, nom: p.nom, unite: p.unite };
    const detail = await request(http)
      .get(api(`/catalogue/prestations/${chape.id}`))
      .set(auth(technico));
    choixIds = detail.body.options.flatMap(
      (o: { obligatoire: boolean; choix: { id: number }[] }) =>
        o.obligatoire ? [o.choix[0].id] : [],
    );
    clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} Client`, email: `${tag}@x.test` })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await t.prisma.prixReference.deleteMany({ where: { companyId } });
    if (baremeAvant.length)
      await t.prisma.prixReference.createMany({ data: baremeAvant.map(({ id: _id, ...r }) => r) });
    await t.prisma.company.update({
      where: { id: companyId },
      data: { prixMarcheMois: moisAvant },
    });
    await t.prisma.facture.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.client.deleteMany({ where: { id: clientId } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null },
    });
    await t.close();
  });

  it('signed quotes make the market price; a price above the range is flagged in the editor', async () => {
    for (const prix of [40, 50, 60]) await devisChape(prix, true);
    const brouillon = await devisChape(200, false);

    const liste = await request(http)
      .get(api(`/prix-marche?search=${encodeURIComponent('Chape béton')}`))
      .set(auth(technico))
      .expect(200);
    const ligne = liste.body.data.find((x: { id: number }) => x.id === chape.id);
    expect(ligne.vente.source).toBe('DEVIS');
    expect(ligne.vente.nombre).toBeGreaterThanOrEqual(3);
    expect(liste.body.periodeMois).toBe(moisAvant);

    const editeur = await request(http)
      .get(api(`/prix-marche/devis/${brouillon}`))
      .set(auth(technico))
      .expect(200);
    expect(editeur.body.lignes).toHaveLength(1);
    expect(editeur.body.lignes[0].position).toBe('HAUT');
    expect(editeur.body.lignes[0].vente.haute).toBeLessThan(200);
  });

  it('the chef never sees market prices; only the Admin imports the price list', async () => {
    await request(http).get(api('/prix-marche')).set(auth(chef)).expect(403);
    await request(http).get(api('/prix-marche/bareme/modele')).set(auth(technico)).expect(403);
    await request(http)
      .post(api('/prix-marche/bareme/import'))
      .set(auth(technico))
      .attach('fichier', Buffer.from('type;nom'), 'a.csv')
      .expect(403);
  });

  it('CSV: template, import (bad lines reported), the list takes over when there are few quotes', async () => {
    const modele = await request(http)
      .get(api('/prix-marche/bareme/modele'))
      .set(auth(admin))
      .expect(200);
    expect(modele.headers['content-type']).toMatch(/text\/csv/);
    expect(modele.text).toContain('type;nom;unite;prix_min;prix_max;achat_vente;source');
    expect(modele.text).toContain(chape.nom);

    // a prestation with no signed quote in the period
    const autre = await t.prisma.prestation.findFirstOrThrow({
      where: { companyId, actif: true, id: { not: chape.id }, lignesDevis: { none: {} } },
      select: { id: true, nom: true, unite: true },
    });
    const csv = [
      'type;nom;unite;prix_min;prix_max;achat_vente;source',
      `PRESTATION;${autre.nom.toUpperCase()};${autre.unite};10;20,5;VENTE;${tag}`,
      `PRESTATION;Prestation qui n'existe pas ${tag};m2;1;2;VENTE;`,
      `PRESTATION;${autre.nom};${autre.unite};30;20;VENTE;`,
    ].join('\n');
    const imp = await request(http)
      .post(api('/prix-marche/bareme/import'))
      .set(auth(admin))
      .attach('fichier', Buffer.from(csv), 'bareme.csv')
      .expect(201);
    expect(imp.body).toMatchObject({ importees: 1, ignorees: 2, conserve: false });
    expect(imp.body.erreurs.map((e: { ligne: number }) => e.ligne)).toEqual([3, 4]);

    const liste = await request(http)
      .get(api(`/prix-marche?search=${encodeURIComponent(autre.nom)}`))
      .set(auth(technico))
      .expect(200);
    const l = liste.body.data.find((x: { id: number }) => x.id === autre.id);
    expect(l.vente).toMatchObject({
      source: 'BAREME',
      basse: 10,
      haute: 20.5,
      bareme: { source: tag },
    });

    // nothing valid: the current list is kept
    const rien = await request(http)
      .post(api('/prix-marche/bareme/import'))
      .set(auth(admin))
      .attach('fichier', Buffer.from('type;nom;unite;prix_min;prix_max\nX;Y;m2;1;2'), 'b.csv')
      .expect(201);
    expect(rien.body).toMatchObject({ importees: 0, conserve: true });
    expect(
      (await request(http).get(api('/prix-marche/bareme')).set(auth(admin)).expect(200)).body
        .nombre,
    ).toBe(1);

    await request(http)
      .post(api('/prix-marche/bareme/import'))
      .set(auth(admin))
      .attach('fichier', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]), 'x.csv')
      .expect(422);
    expect(
      (await request(http).delete(api('/prix-marche/bareme')).set(auth(admin)).expect(200)).body
        .supprimees,
    ).toBe(1);
  });

  it('the period is a setting: 6, 12 or 24 months', async () => {
    await request(http)
      .patch(api('/company/settings'))
      .set(auth(admin))
      .send({ prixMarcheMois: 7 })
      .expect(400);
    const ok = await request(http)
      .patch(api('/company/settings'))
      .set(auth(admin))
      .send({ prixMarcheMois: 24 })
      .expect(200);
    expect(ok.body.prixMarcheMois).toBe(24);
  });
});
