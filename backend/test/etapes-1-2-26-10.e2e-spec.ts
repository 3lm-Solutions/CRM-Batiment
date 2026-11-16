import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const DAY = 86_400_000;

/** 26/10 — Étape 1: private / company clients. Étape 2: SAV only after the works, for a set period. */
describe('Étapes 1–2 — catégories de clients, SAV après travaux (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let savDureeAvant: number;
  const tag = `e2e-e12-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico] = await Promise.all([t.tokenFor(SEED.admin), t.tokenFor(SEED.technico)]);
    savDureeAvant = (await request(http).get(api('/company/settings')).set(auth(admin)).expect(200))
      .body.savDureeMois;
  });

  afterAll(async () => {
    await request(http)
      .patch(api('/company/settings'))
      .set(auth(admin))
      .send({ savDureeMois: savDureeAvant });
    const clients = (
      await t.prisma.client.findMany({ where: { nom: { startsWith: tag } }, select: { id: true } })
    ).map((c) => c.id);
    await t.prisma.savTicket.deleteMany({ where: { clientId: { in: clients } } });
    await t.prisma.facture.deleteMany({ where: { devis: { clientId: { in: clients } } } });
    await t.prisma.commandeFournisseur.deleteMany({
      where: { devis: { clientId: { in: clients } } },
    });
    await t.prisma.devis.deleteMany({ where: { clientId: { in: clients } } });
    await t.prisma.chantier.deleteMany({ where: { clientId: { in: clients } } });
    await t.prisma.client.deleteMany({ where: { id: { in: clients } } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null },
    });
    await t.close();
  });

  // ── Étape 1 ─────────────────────────────────────────────────────────────

  it('a company client: company name required, SIRET / VAT checked when entered, no first name', async () => {
    await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ typeClient: 'PROFESSIONNEL', nom: '' })
      .expect(400);
    await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ typeClient: 'PROFESSIONNEL', nom: `${tag} SARL`, siret: '1234567891012' })
      .expect(400); // 13 digits
    await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ typeClient: 'PROFESSIONNEL', nom: `${tag} Clé SARL`, siret: '12345678910123' })
      .expect(201); // wrong key: accepted (27/10);
    await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ typeClient: 'PROFESSIONNEL', nom: `${tag} SARL`, tvaIntracom: 'FR45732829320' })
      .expect(400);

    // SIRET optional
    const sans = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ typeClient: 'PROFESSIONNEL', nom: `${tag} Sans SIRET` })
      .expect(201);
    expect(sans.body).toMatchObject({ typeClient: 'PROFESSIONNEL', siret: null });

    const pro = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({
        typeClient: 'PROFESSIONNEL',
        nom: `${tag} Bâti SARL`,
        prenom: 'Ignoré',
        siret: '732 829 320 00074',
        tvaIntracom: 'fr44 732829320',
        contactNom: 'Paul Durand',
        contactFonction: 'Gérant',
      })
      .expect(201);
    expect(pro.body).toMatchObject({
      prenom: null,
      siret: '73282932000074',
      tvaIntracom: 'FR44732829320',
      contactNom: 'Paul Durand',
    });

    // filter + search by SIRET
    const list = await request(http)
      .get(api(`/clients?typeClient=PROFESSIONNEL&search=${encodeURIComponent('73282932000074')}`))
      .set(auth(admin))
      .expect(200);
    expect(list.body.data.map((c: { id: number }) => c.id)).toContain(pro.body.id);
    const particuliers = await request(http)
      .get(api(`/clients?typeClient=PARTICULIER&search=${encodeURIComponent(tag)}`))
      .set(auth(admin))
      .expect(200);
    expect(particuliers.body.data.map((c: { id: number }) => c.id)).not.toContain(pro.body.id);

    // a private person keeps no company field
    const devenu = await request(http)
      .patch(api(`/clients/${pro.body.id}`))
      .set(auth(admin))
      .send({ typeClient: 'PARTICULIER', prenom: 'Paul' })
      .expect(200);
    expect(devenu.body).toMatchObject({
      typeClient: 'PARTICULIER',
      prenom: 'Paul',
      siret: null,
      tvaIntracom: null,
      contactNom: null,
      contactFonction: null,
    });
    const perso = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ nom: `${tag} Dupont`, siret: '73282932000074' })
      .expect(201);
    expect(perso.body).toMatchObject({ typeClient: 'PARTICULIER', siret: null });
  });

  it('the issued invoice keeps the company client’s SIRET and VAT number', async () => {
    const clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({
          typeClient: 'PROFESSIONNEL',
          nom: `${tag} Facturé SAS`,
          email: `${tag}-facture@x.test`,
          siret: '73282932000074',
          tvaIntracom: 'FR44732829320',
        })
        .expect(201)
    ).body.id;
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
      .send({ clientId })
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
      .send({ prestationId: chape, choixIds, quantite: 10 })
      .expect(201);
    const detail = await request(http)
      .get(api(`/devis/${devis.body.id}`))
      .set(auth(technico))
      .expect(200);
    expect(detail.body.client).toMatchObject({
      typeClient: 'PROFESSIONNEL',
      siret: '73282932000074',
    });
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
    const emise = await request(http)
      .post(api(`/factures/${acompte.id}/emettre`))
      .set(auth(admin))
      .send({ envoyerEmail: false })
      .expect(200);
    expect(emise.body.facture).toMatchObject({
      nomClient: `${tag} Facturé SAS`,
      prenomClient: null,
      clientSiret: '73282932000074',
      clientTvaIntracom: 'FR44732829320',
    });

    // later edits of the client never change the issued invoice
    await request(http)
      .patch(api(`/clients/${clientId}`))
      .set(auth(admin))
      .send({ siret: null })
      .expect(200);
    const pub = await request(http)
      .get(api(`/public/factures/${emise.body.facture.lienPublicToken}`))
      .expect(200);
    expect(pub.body.clientSiret).toBe('73282932000074');
  });

  // ── Étape 2 ─────────────────────────────────────────────────────────────

  it('SAV: period set by the ADMIN; only on a finished job site; the ADMIN may override (traced)', async () => {
    await request(http)
      .patch(api('/company/settings'))
      .set(auth(technico))
      .send({ savDureeMois: 24 })
      .expect(403);
    await request(http)
      .patch(api('/company/settings'))
      .set(auth(admin))
      .send({ savDureeMois: -1 })
      .expect(400);
    expect(
      (
        await request(http)
          .patch(api('/company/settings'))
          .set(auth(admin))
          .send({ savDureeMois: 12 })
          .expect(200)
      ).body.savDureeMois,
    ).toBe(12);

    const clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} SAV` })
        .expect(201)
    ).body.id;
    const chantier = async () =>
      (
        await request(http)
          .post(api('/chantiers'))
          .set(auth(admin))
          .send({ clientId, adresse: '1 rue du SAV' })
          .expect(201)
      ).body.id as number;
    const [enCours, fini, ancien] = [await chantier(), await chantier(), await chantier()];
    await t.prisma.chantier.update({
      where: { id: fini },
      data: { statut: 'TERMINE', dateFin: new Date(Date.now() - 30 * DAY) },
    });
    await t.prisma.chantier.update({
      where: { id: ancien },
      data: { statut: 'CLOTURE', dateFin: new Date(Date.now() - 400 * DAY) },
    });
    const ouvrir = (token: string, chantierId?: number) =>
      request(http)
        .post(api('/sav'))
        .set(auth(token))
        .send({ clientId, chantierId, titre: `${tag} fuite`, description: 'x' });

    const liste = await request(http)
      .get(api(`/sav/chantiers?clientId=${clientId}`))
      .set(auth(technico))
      .expect(200);
    const etat = (id: number) => liste.body.chantiers.find((c: { id: number }) => c.id === id);
    expect(etat(enCours)).toMatchObject({ savPossible: false });
    expect(etat(fini).savPossible).toBe(true);
    expect(etat(fini).savJusquau).toBeTruthy();
    expect(etat(ancien)).toMatchObject({ savPossible: false });

    expect((await ouvrir(technico, enCours).expect(422)).body.code).toBe('CHANTIER_NON_TERMINE');
    expect((await ouvrir(technico).expect(422)).body.code).toBe('CHANTIER_REQUIS');
    expect((await ouvrir(technico, ancien).expect(422)).body.code).toBe('SAV_EXPIRE');
    await ouvrir(technico, fini).expect(201);

    // ADMIN override, kept as an internal note the client never sees
    const force = await ouvrir(admin, enCours).expect(201);
    expect(force.body.notes).toHaveLength(1);
    expect(force.body.notes[0].contenu).toMatch(/hors règle SAV/);
    expect(force.body.notes[0].visibleClient).toBe(false);

    // 0 = no limit
    await request(http)
      .patch(api('/company/settings'))
      .set(auth(admin))
      .send({ savDureeMois: 0 })
      .expect(200);
    await ouvrir(technico, ancien).expect(201);
  });
});
