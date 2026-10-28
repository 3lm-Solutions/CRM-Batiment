import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/**
 * 26/10 — Étape 5: the client sees tasks, sub-tasks and VALIDATED photos in his space, comments
 * and sends alerts. Étape 6: the chef / office answers (shown + emailed) and marks handled.
 */
describe('Étapes 5–6 — espace client : photos, commentaires, alertes ; réponses (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let st: string;
  let chefId: number;
  let stUserId: number;
  let clientId: number;
  let chantierId: number;
  let tacheId: number;
  let token: string;
  let photoValidee: number;
  let photoEnAttente: number;
  const tag = `e2e-e56-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const auth = (tk: string) => ({ Authorization: `Bearer ${tk}` });
  const api = (p: string) => `/api/v1${p}`;
  const espace = (p = '') => api(`/public/espace-client/${token}${p}`);

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, chef, st] = await Promise.all([t.tokenFor(SEED.admin), t.tokenFor(SEED.technico), t.tokenFor(SEED.chef), t.tokenFor(SEED.sousTraitant)]);
    chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;
    stUserId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })).id;
    clientId = (await request(http).post(api('/clients')).set(auth(admin)).send({ nom: `${tag} Client`, email: clientEmail }).expect(201)).body.id;
    chantierId = (await request(http).post(api('/chantiers')).set(auth(admin)).send({ clientId, adresse: '1 rue du Retour', chefChantierId: chefId }).expect(201)).body.id;
    tacheId = (
      await request(http).post(api(`/chantiers/${chantierId}/taches`)).set(auth(admin)).send({ libelle: `${tag} Faïence`, dateDebut: new Date().toISOString(), assigneeIds: [stUserId] }).expect(201)
    ).body.id;
    await request(http).post(api(`/chantiers/${chantierId}/taches/${tacheId}/checklist`)).set(auth(admin)).send({ libelle: 'Mur douche' }).expect(201);

    // two photos from the sous-traitant: one validated by the chef, one left pending
    const envoi = await request(http).post(api('/portail/sous-traitant/photos')).set(auth(st)).field('tacheId', String(tacheId)).field('moment', 'APRES').attach('photos', PNG, 'a.png').attach('photos', PNG, 'b.png').expect(201);
    [photoValidee, photoEnAttente] = envoi.body.map((p: { id: number }) => p.id);
    await request(http).post(api(`/chantiers/${chantierId}/photos/valider`)).set(auth(chef)).send({ ids: [photoValidee] }).expect(200);

    const lien = await request(http).post(api(`/clients/${clientId}/espace/lien`)).set(auth(admin)).expect(201);
    token = String(lien.body.url).split('/').pop()!;
  });

  afterAll(async () => {
    await t.prisma.fichier.deleteMany({ where: { chantierId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.clientEspaceLien.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.close();
  });

  it('Étape 5: the client sees sub-tasks and only the validated photos, streamed through his token', async () => {
    const view = await request(http).get(espace()).expect(200);
    const c = view.body.chantiers.find((x: { id: number }) => x.id === chantierId);
    expect(c.retoursPossibles).toBe(true);
    expect(c.taches[0].checklist.map((i: { libelle: string }) => i.libelle)).toEqual(['Mur douche']);
    expect(c.photos.map((p: { id: number }) => p.id)).toEqual([photoValidee]);
    expect(c.photos[0]).not.toHaveProperty('auteurId');

    const img = await request(http).get(espace(`/avancement/${photoValidee}`)).expect(200);
    expect(img.headers['content-type']).toMatch(/image\/png/);
    await request(http).get(espace(`/avancement/${photoEnAttente}`)).expect(404);
    await request(http).get(api(`/public/espace-client/nope/avancement/${photoValidee}`)).expect(410);
    // the office preview shows the same photo
    await request(http).get(api(`/clients/${clientId}/espace/apercu/avancement/${photoValidee}`)).set(auth(admin)).expect(200);
  });

  it('Étape 5: comment on a photo, alert on the job site — chef + ADMIN told, alert emailed to the chef', async () => {
    // only a validated photo of his job site
    expect((await request(http).post(espace('/retours')).send({ chantierId, photoId: photoEnAttente, type: 'COMMENTAIRE', message: 'x' }).expect(422)).body.code).toBe('PHOTO_INVALIDE');
    await request(http).post(espace('/retours')).send({ chantierId, type: 'AUTRE', message: 'x' }).expect(400);
    expect((await request(http).post(espace('/retours')).send({ chantierId: 999_999, type: 'COMMENTAIRE', message: 'x' }).expect(422)).body.code).toBe('LIEN_INVALIDE');

    const com = await request(http).post(espace('/retours')).send({ chantierId, photoId: photoValidee, type: 'COMMENTAIRE', message: 'Très joli joint gris' }).expect(201);
    expect(com.body.message).toMatch(/commentaire/i);
    const notifsChef = await t.prisma.notification.findMany({ where: { userId: chefId, type: 'RETOUR_CLIENT_COMMENTAIRE' }, orderBy: { id: 'desc' }, take: 1 });
    expect(notifsChef[0].lien).toBe(`/chantiers/${chantierId}?onglet=retours`);

    await request(http).post(espace('/retours')).send({ chantierId, type: 'ALERTE', message: 'Fissure visible au salon' }).expect(201);
    const chefEmail = (await t.prisma.user.findUniqueOrThrow({ where: { id: chefId } })).email;
    expect(t.mail.lastTo(chefEmail)?.subject).toMatch(/Alerte client/);
    const adminId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.admin } })).id;
    expect(await t.prisma.notification.count({ where: { userId: adminId, type: 'RETOUR_CLIENT_ALERTE' } })).toBeGreaterThanOrEqual(1);

    // the photo's task is kept with the comment
    const stored = await t.prisma.retourClient.findUniqueOrThrow({ where: { id: com.body.id } });
    expect(stored.tacheId).toBe(tacheId);
  });

  it('Étape 6: alerts first; the technico reads; the chef answers (shown + emailed) and it is handled; reopen', async () => {
    const liste = await request(http).get(api(`/chantiers/${chantierId}/retours`)).set(auth(technico)).expect(200);
    expect(liste.body.totaux).toEqual({ alertesOuvertes: 1, commentairesOuverts: 1 });
    expect(liste.body.data[0].type).toBe('ALERTE');
    const alerteId = liste.body.data[0].id as number;

    await request(http).post(api(`/chantiers/${chantierId}/retours/${alerteId}/repondre`)).set(auth(technico)).send({ reponse: 'x' }).expect(403);
    await request(http).post(api(`/chantiers/${chantierId}/retours/${alerteId}/repondre`)).set(auth(chef)).send({ reponse: '' }).expect(400);
    const rep = await request(http).post(api(`/chantiers/${chantierId}/retours/${alerteId}/repondre`)).set(auth(chef)).send({ reponse: 'Nous passons demain à 9 h.' }).expect(200);
    expect(rep.body).toMatchObject({ statut: 'TRAITE', reponse: 'Nous passons demain à 9 h.' });
    expect(t.mail.lastTo(clientEmail)?.text).toContain('Nous passons demain à 9 h.');

    const view = await request(http).get(espace()).expect(200);
    const r = view.body.chantiers.find((x: { id: number }) => x.id === chantierId).retours.find((x: { id: number }) => x.id === alerteId);
    expect(r).toMatchObject({ statut: 'TRAITE', reponse: 'Nous passons demain à 9 h.' });

    await request(http).post(api(`/chantiers/${chantierId}/retours/${alerteId}/rouvrir`)).set(auth(admin)).expect(200);
    expect((await request(http).post(api(`/chantiers/${chantierId}/retours/${alerteId}/traiter`)).set(auth(admin)).expect(200)).body.statut).toBe('TRAITE');

    // the dashboard counts the open ones
    const dash = await request(http).get(api('/dashboard')).set(auth(admin)).expect(200);
    expect(dash.body.retoursClient).toHaveProperty('alertesOuvertes');
    expect(dash.body.chantiersSansPhoto).toHaveProperty('nombre');
  });

  it('a closed job site: no more comments (SAV instead)', async () => {
    await t.prisma.chantier.update({ where: { id: chantierId }, data: { statut: 'CLOTURE', dateFin: new Date() } });
    const view = await request(http).get(espace()).expect(200);
    expect(view.body.chantiers.find((x: { id: number }) => x.id === chantierId).retoursPossibles).toBe(false);
    expect((await request(http).post(espace('/retours')).send({ chantierId, type: 'COMMENTAIRE', message: 'x' }).expect(422)).body.code).toBe('CHANTIER_FERME');
  });
});
