import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const IBAN = 'FR76 3000 6000 0112 3456 7890 189';

/** 21/10: sous-traitant time tracking, task checklists, team planning, invoice QR codes. */
describe('Pointage, checklist, planning, QR code facture (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let st: string;
  let stUserId: number;
  let clientId: number;
  let chantierId: number;
  let tacheId: number;
  let bankBefore: { iban: string | null; bic: string | null };
  const tag = `e2e-ppq-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, st] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.sousTraitant),
    ]);
    stUserId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })).id;
    bankBefore = await t.prisma.company.findFirstOrThrow({ select: { iban: true, bic: true } });
    clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} Client`, email: `${tag}@client.test` })
        .expect(201)
    ).body.id;
    chantierId = (
      await request(http)
        .post(api('/chantiers'))
        .set(auth(admin))
        .send({ clientId, adresse: '1 rue du Test' })
        .expect(201)
    ).body.id;
    // assigning the task opens the job site to the sous-traitant's portal
    tacheId = (
      await request(http)
        .post(api(`/chantiers/${chantierId}/taches`))
        .set(auth(admin))
        .send({
          libelle: `${tag} Pose faïence`,
          dateDebut: new Date().toISOString(),
          assigneeIds: [stUserId],
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await t.prisma.company.updateMany({ data: bankBefore });
    await t.prisma.pointage.deleteMany({ where: { chantierId } });
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

  it('pointage: the sous-traitant enters hours, the office refuses or validates them', async () => {
    const future = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(
      (
        await request(http)
          .post(api('/portail/sous-traitant/pointages'))
          .set(auth(st))
          .send({ chantierId, date: future, heures: 4 })
          .expect(422)
      ).body.code,
    ).toBe('DATE_FUTURE');

    const p1 = await request(http)
      .post(api('/portail/sous-traitant/pointages'))
      .set(auth(st))
      .send({ chantierId, tacheId, date: today, heures: 7.5 })
      .expect(201);
    expect(p1.body.statut).toBe('SOUMIS');
    expect(
      (
        await request(http)
          .post(api('/portail/sous-traitant/pointages'))
          .set(auth(st))
          .send({ chantierId, date: today, heures: 17 })
          .expect(422)
      ).body.code,
    ).toBe('TROP_D_HEURES');

    // the office sees it, refuses it with a reason; the sous-traitant may then delete it
    const list = await request(http)
      .get(api(`/pointages?statut=SOUMIS&chantierId=${chantierId}`))
      .set(auth(admin))
      .expect(200);
    expect(list.body.data.map((p: { id: number }) => p.id)).toContain(p1.body.id);
    expect(list.body.totaux.soumis).toBeGreaterThanOrEqual(7.5);
    await request(http)
      .post(api(`/pointages/${p1.body.id}/refuser`))
      .set(auth(admin))
      .send({ motif: '' })
      .expect(400);
    await request(http)
      .post(api(`/pointages/${p1.body.id}/refuser`))
      .set(auth(admin))
      .send({ motif: 'Absent' })
      .expect(200);
    const mine = await request(http)
      .get(api('/portail/sous-traitant/pointages'))
      .set(auth(st))
      .expect(200);
    expect(mine.body.data.find((p: { id: number }) => p.id === p1.body.id).motifRefus).toBe(
      'Absent',
    );
    await request(http)
      .delete(api(`/portail/sous-traitant/pointages/${p1.body.id}`))
      .set(auth(st))
      .expect(204);

    // validated: can no longer be deleted by him; totals on his record
    const p2 = await request(http)
      .post(api('/portail/sous-traitant/pointages'))
      .set(auth(st))
      .send({ chantierId, date: today, heures: 8 })
      .expect(201);
    expect(
      (
        await request(http)
          .post(api('/pointages/valider'))
          .set(auth(technico))
          .send({ ids: [p2.body.id] })
          .expect(200)
      ).body.valides,
    ).toBe(1);
    expect(
      (
        await request(http)
          .delete(api(`/portail/sous-traitant/pointages/${p2.body.id}`))
          .set(auth(st))
          .expect(422)
      ).body.code,
    ).toBe('POINTAGE_VALIDE');
    const dossier = await t.prisma.sousTraitant.findFirstOrThrow({ where: { userId: stUserId } });
    const resume = await request(http)
      .get(api(`/pointages/resume/${dossier.id}`))
      .set(auth(admin))
      .expect(200);
    expect(
      resume.body.find((r: { chantier: { id: number } }) => r.chantier.id === chantierId).valide,
    ).toBe(8);

    // the office routes are not open to the portal, and the other way round
    await request(http).get(api('/pointages')).set(auth(st)).expect(403);
    await request(http).get(api('/portail/sous-traitant/pointages')).set(auth(admin)).expect(403);
  });

  it('checklist: the task progress follows the ticked items, also from the portal', async () => {
    await request(http)
      .post(api(`/chantiers/${chantierId}/taches/${tacheId}/checklist`))
      .set(auth(admin))
      .send({ libelle: 'Primaire' })
      .expect(201);
    const two = await request(http)
      .post(api(`/chantiers/${chantierId}/taches/${tacheId}/checklist`))
      .set(auth(admin))
      .send({ libelle: 'Faïence' })
      .expect(201);
    expect(two.body.checklist).toHaveLength(2);
    expect(two.body.avancement).toBe(0);

    const [first, second] = two.body.checklist;
    const ticked = await request(http)
      .patch(api(`/portail/sous-traitant/taches/${tacheId}/checklist/${first.id}`))
      .set(auth(st))
      .send({ fait: true })
      .expect(200);
    expect(ticked.body).toMatchObject({ avancement: 50, statut: 'EN_COURS' });
    const done = await request(http)
      .patch(api(`/chantiers/${chantierId}/taches/${tacheId}/checklist/${second.id}`))
      .set(auth(admin))
      .send({ fait: true })
      .expect(200);
    expect(done.body).toMatchObject({ avancement: 100, statut: 'TERMINEE' });
    expect(done.body.checklist[1].faitPar).toBeTruthy();

    // the technico does not edit tasks (same rule as the tasks themselves)
    await request(http)
      .post(api(`/chantiers/${chantierId}/taches/${tacheId}/checklist`))
      .set(auth(technico))
      .send({ libelle: 'x' })
      .expect(403);
  });

  it('planning: dated tasks over a period, 45 days max', async () => {
    const du = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const au = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
    const res = await request(http)
      .get(api(`/planning?du=${du}&au=${au}&chantierId=${chantierId}`))
      .set(auth(admin))
      .expect(200);
    const tache = res.body.taches.find((x: { id: number }) => x.id === tacheId);
    expect(tache.intervenants.map((i: { id: number }) => i.id)).toContain(stUserId);
    const loin = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
    expect(
      (
        await request(http)
          .get(api(`/planning?du=${du}&au=${loin}`))
          .set(auth(admin))
          .expect(422)
      ).body.code,
    ).toBe('PERIODE_TROP_LONGUE');
  });

  it('QR code: bank details are checked, copied on the issued invoice, and the public link shows it', async () => {
    await request(http)
      .patch(api('/company'))
      .set(auth(admin))
      .send({ iban: 'FR76 3000 6000 0112 3456 7890 188' })
      .expect(400);
    const co = await request(http)
      .patch(api('/company'))
      .set(auth(admin))
      .send({ iban: IBAN, bic: 'bnpafrppxxx' })
      .expect(200);
    expect(co.body).toMatchObject({ iban: 'FR7630006000011234567890189', bic: 'BNPAFRPPXXX' });

    // an issued deposit invoice
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
      companyIban: 'FR7630006000011234567890189',
      companyBic: 'BNPAFRPPXXX',
    });
    const token = emise.body.facture.lienPublicToken as string;
    expect(token.length).toBeGreaterThanOrEqual(30);

    const pub = await request(http)
      .get(api(`/public/factures/${token}`))
      .expect(200);
    expect(pub.body).toMatchObject({
      reference: emise.body.facture.reference,
      companyIban: 'FR7630006000011234567890189',
    });
    expect(pub.body).not.toHaveProperty('devisId');
    await request(http).get(api('/public/factures/nimporte-quoi')).expect(404);
  });
});
