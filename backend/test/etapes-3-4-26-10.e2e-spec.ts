import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

/** 26/10 — Étape 3: before / after photos sent by the sous-traitant. Étape 4: validated or hidden by the chef. */
describe('Étapes 3–4 — photos avant / après, validation (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let st: string;
  let stUserId: number;
  let clientId: number;
  let chantierId: number;
  let autreChantierId: number;
  let tacheId: number;
  let itemId: number;
  const tag = `e2e-e34-${Date.now()}`;
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
    clientId = (
      await request(http)
        .post(api('/clients'))
        .set(auth(admin))
        .send({ nom: `${tag} Client` })
        .expect(201)
    ).body.id;
    chantierId = (
      await request(http)
        .post(api('/chantiers'))
        .set(auth(admin))
        .send({ clientId, adresse: '1 rue des Photos' })
        .expect(201)
    ).body.id;
    autreChantierId = (
      await request(http)
        .post(api('/chantiers'))
        .set(auth(admin))
        .send({ clientId, adresse: '2 rue Privée' })
        .expect(201)
    ).body.id;
    // assigning the task opens the job site to the sous-traitant's portal
    tacheId = (
      await request(http)
        .post(api(`/chantiers/${chantierId}/taches`))
        .set(auth(admin))
        .send({
          libelle: `${tag} Faïence`,
          dateDebut: new Date().toISOString(),
          assigneeIds: [stUserId],
        })
        .expect(201)
    ).body.id;
    const item = await request(http)
      .post(api(`/chantiers/${chantierId}/taches/${tacheId}/checklist`))
      .set(auth(admin))
      .send({ libelle: 'Mur douche' })
      .expect(201);
    itemId = item.body.checklist[0].id;
  });

  afterAll(async () => {
    await t.prisma.fichier.deleteMany({
      where: { chantierId: { in: [chantierId, autreChantierId] } },
    });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.close();
  });

  const envoyer = (
    fields: Record<string, string>,
    files: { buf: Buffer; name: string }[] = [{ buf: PNG, name: 'avant.png' }],
  ) => {
    let r = request(http).post(api('/portail/sous-traitant/photos')).set(auth(st));
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    for (const f of files) r = r.attach('photos', f.buf, f.name);
    return r;
  };

  it('Étape 3: the sous-traitant sends before / after photos of a task or a sub-task', async () => {
    // checks: moment, date, sub-task of the task, task of an open job site, images only
    await envoyer({ tacheId: String(tacheId), moment: 'PENDANT' }).expect(400);
    const futur = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(
      (await envoyer({ tacheId: String(tacheId), moment: 'AVANT', date: futur }).expect(422)).body
        .code,
    ).toBe('DATE_FUTURE');
    expect(
      (
        await envoyer({
          tacheId: String(tacheId),
          moment: 'AVANT',
          checklistItemId: '999999',
        }).expect(422)
      ).body.code,
    ).toBe('SOUS_TACHE_INVALIDE');
    expect(
      (await envoyer({ tacheId: String(tacheId), moment: 'AVANT' }, []).expect(422)).body.code,
    ).toBe('FICHIER_MANQUANT');
    await envoyer({ tacheId: String(tacheId), moment: 'AVANT' }, [
      { buf: PNG, name: 'a.png' },
      { buf: PDF, name: 'b.pdf' },
    ]).expect(422);
    expect(await t.prisma.photoAvancement.count({ where: { chantierId } })).toBe(0); // nothing left behind
    const autreTache = (
      await request(http)
        .post(api(`/chantiers/${autreChantierId}/taches`))
        .set(auth(admin))
        .send({ libelle: `${tag} privée` })
        .expect(201)
    ).body.id;
    await envoyer({ tacheId: String(autreTache), moment: 'AVANT' }).expect(404);

    const avant = await envoyer(
      {
        tacheId: String(tacheId),
        moment: 'AVANT',
        checklistItemId: String(itemId),
        date: today,
        commentaire: 'Mur brut',
      },
      [
        { buf: PNG, name: 'avant1.png' },
        { buf: PNG, name: 'avant2.png' },
      ],
    ).expect(201);
    expect(avant.body).toHaveLength(2);
    expect(avant.body[0]).toMatchObject({
      moment: 'AVANT',
      statut: 'EN_ATTENTE',
      commentaire: 'Mur brut',
      checklistItem: { id: itemId },
    });
    await envoyer({ tacheId: String(tacheId), moment: 'APRES' }, [
      { buf: PNG, name: 'apres.png' },
    ]).expect(201);

    // the chef or the office is told; the file is readable by the office
    await request(http)
      .get(api(`/fichiers/${avant.body[0].fichierId}/contenu`))
      .set(auth(admin))
      .expect(200);
    const mine = await request(http)
      .get(api(`/portail/sous-traitant/photos?chantierId=${chantierId}`))
      .set(auth(st))
      .expect(200);
    expect(mine.body.totaux).toEqual({ enAttente: 3, validees: 0, masquees: 0 });

    // pending: he may delete it
    await request(http)
      .delete(api(`/portail/sous-traitant/photos/${avant.body[1].id}`))
      .set(auth(st))
      .expect(204);
    expect(await t.prisma.fichier.count({ where: { id: avant.body[1].fichierId } })).toBe(0);
  });

  it('Étape 4: the office / chef validates or hides; the technico only looks; a validated photo stays', async () => {
    const liste = await request(http)
      .get(api(`/chantiers/${chantierId}/photos`))
      .set(auth(technico))
      .expect(200);
    expect(liste.body.totaux).toEqual({ enAttente: 2, validees: 0, masquees: 0 });
    expect(liste.body.auteurs.map((a: { id: number }) => a.id)).toEqual([stUserId]);
    const [p1, p2] = liste.body.data as { id: number; moment: string }[];

    await request(http)
      .post(api(`/chantiers/${chantierId}/photos/valider`))
      .set(auth(technico))
      .send({ ids: [p1.id] })
      .expect(403);
    expect(
      (
        await request(http)
          .post(api(`/chantiers/${chantierId}/photos/valider`))
          .set(auth(admin))
          .send({ ids: [p1.id] })
          .expect(200)
      ).body.modifiees,
    ).toBe(1);
    // a photo of another job site is never touched through this one
    expect(
      (
        await request(http)
          .post(api(`/chantiers/${autreChantierId}/photos/valider`))
          .set(auth(admin))
          .send({ ids: [p2.id] })
          .expect(200)
      ).body.modifiees,
    ).toBe(0);
    expect(
      (
        await request(http)
          .post(api(`/chantiers/${chantierId}/photos/masquer`))
          .set(auth(admin))
          .send({ ids: [p2.id], motif: 'Photo floue' })
          .expect(200)
      ).body.modifiees,
    ).toBe(1);

    const filtre = await request(http)
      .get(api(`/chantiers/${chantierId}/photos?statut=VALIDEE`))
      .set(auth(admin))
      .expect(200);
    expect(filtre.body.data.map((p: { id: number }) => p.id)).toEqual([p1.id]);
    const avant = await request(http)
      .get(api(`/chantiers/${chantierId}/photos?moment=AVANT&checklistItemId=${itemId}`))
      .set(auth(admin))
      .expect(200);
    expect(avant.body.data.every((p: { moment: string }) => p.moment === 'AVANT')).toBe(true);

    const mine = await request(http)
      .get(api(`/portail/sous-traitant/photos?chantierId=${chantierId}`))
      .set(auth(st))
      .expect(200);
    expect(mine.body.data.find((p: { id: number }) => p.id === p2.id)).toMatchObject({
      statut: 'MASQUEE',
      motifMasquage: 'Photo floue',
    });
    expect(
      (
        await request(http)
          .delete(api(`/portail/sous-traitant/photos/${p1.id}`))
          .set(auth(st))
          .expect(422)
      ).body.code,
    ).toBe('PHOTO_VALIDEE');

    // the office routes are not open to the portal, and the other way round
    await request(http)
      .get(api(`/chantiers/${chantierId}/photos`))
      .set(auth(st))
      .expect(403);
    await request(http).get(api('/portail/sous-traitant/photos')).set(auth(admin)).expect(403);
  });

  it('deleting a task removes its photos and their files (no orphan in storage)', async () => {
    const autre = (
      await request(http)
        .post(api(`/chantiers/${chantierId}/taches`))
        .set(auth(admin))
        .send({ libelle: `${tag} Plinthes`, assigneeIds: [stUserId] })
        .expect(201)
    ).body.id as number;
    const envoi = await envoyer({ tacheId: String(autre), moment: 'AVANT' }).expect(201);
    const fichierId = envoi.body[0].fichierId as number;
    await request(http)
      .delete(api(`/chantiers/${chantierId}/taches/${autre}`))
      .set(auth(admin))
      .expect(204);
    expect(await t.prisma.photoAvancement.count({ where: { tacheId: autre } })).toBe(0);
    expect(await t.prisma.fichier.count({ where: { id: fichierId } })).toBe(0);
  });
});
