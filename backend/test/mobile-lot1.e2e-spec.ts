import request from 'supertest';
import { App } from 'supertest/types';
import { VisitesService } from '../src/modules/commercial/visites/visites.service';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/** Smallest JPEG header + padding: recognised by its magic number */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

/**
 * 16/11 — backend « lot 1 » for the mobile app. Every route is new or an optional extension of
 * an existing one: without the new parameters / headers, the web gets exactly the same answers.
 */
describe('Mobile lot 1 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let sousTraitant: string;
  let chefId: number;
  let stId: number;
  let technicoId: number;
  let clientId: number;
  let chantierId: number;
  let tacheId: number;
  const tag = `e2e-l1-${Date.now()}`;
  const tel = `06${String(Date.now()).slice(-8)}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    technico = await t.tokenFor(SEED.technico);
    chef = await t.tokenFor(SEED.chef);
    sousTraitant = await t.tokenFor(SEED.sousTraitant);
    chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;
    stId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })).id;
    technicoId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.technico } })).id;

    const client = await request(http)
      .post('/api/v1/clients')
      .set(auth(technico))
      .send({
        nom: `${tag} Durand`,
        prenom: 'Léa',
        telephone: tel,
        email: `${tag}@client.test`,
        adresseClient: '3 rue du Test, 75011 Paris',
      })
      .expect(201);
    clientId = client.body.id;
    const chantier = await request(http)
      .post('/api/v1/chantiers')
      .set(auth(admin))
      .send({
        clientId,
        adresse: '3 rue du Test',
        chefChantierId: chefId,
        dateDebut: '2026-11-10',
        dateFin: '2026-11-20',
      })
      .expect(201);
    chantierId = chantier.body.id;
    const tache = await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches`)
      .set(auth(chef))
      .send({ libelle: 'Carrelage', assigneeIds: [stId] })
      .expect(201);
    tacheId = tache.body.id;
  });

  afterAll(async () => {
    const clients = await t.prisma.client.findMany({
      where: { OR: [{ id: clientId }, { nom: { startsWith: tag } }] },
      select: { id: true },
    });
    const ids = clients.map((c) => c.id);
    await t.prisma.visite.deleteMany({ where: { clientId: { in: ids } } });
    const fichiers = await t.prisma.fichier.findMany({
      where: {
        OR: [
          { chantier: { clientId: { in: ids } } },
          { demandeDevisFichier: { demandeDevis: { clientId: { in: ids } } } },
        ],
      },
      select: { id: true },
    });
    await t.prisma.chantier.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.fichier.deleteMany({ where: { id: { in: fichiers.map((f) => f.id) } } });
    await t.prisma.devis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.demandeDevis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.client.deleteMany({ where: { id: { in: ids } } });
    await t.prisma.cleIdempotence.deleteMany({ where: { cle: { startsWith: 'e2e-l1-' } } });
    await t.prisma.company.updateMany({ data: { modeInstallation: 'POSE' } });
    await t.close();
  });

  // ── 1. hors ligne sans doublons ─────────────────────────────────────────

  it('Idempotency-Key: the same action sent twice is done once, same answer', async () => {
    const cle = `e2e-l1-${Date.now()}-tache`;
    const envoyer = () =>
      request(http)
        .post(`/api/v1/chantiers/${chantierId}/taches`)
        .set(auth(chef))
        .set('Idempotency-Key', cle)
        .send({ libelle: 'Envoyée hors ligne' });
    const premier = await envoyer();
    expect(premier.status).toBe(201);
    const second = await envoyer();
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.id).toBe(premier.body.id);
    expect(
      await t.prisma.tache.count({ where: { chantierId, libelle: 'Envoyée hors ligne' } }),
    ).toBe(1);

    // same key, another address → refused
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches/${tacheId}/commentaires`)
      .set(auth(chef))
      .set('Idempotency-Key', cle)
      .send({ texte: 'Autre action' })
      .expect(422)
      .expect((r) => expect(r.body.code).toBe('CLE_IDEMPOTENCE_REUTILISEE'));
    // invalid key
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches`)
      .set(auth(chef))
      .set('Idempotency-Key', 'x')
      .send({ libelle: 'Autre' })
      .expect(400);
  });

  it('Idempotency-Key: a failed request is forgotten and can be sent again', async () => {
    const cle = `e2e-l1-${Date.now()}-echec`;
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches`)
      .set(auth(chef))
      .set('Idempotency-Key', cle)
      .send({})
      .expect(400);
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches`)
      .set(auth(chef))
      .set('Idempotency-Key', cle)
      .send({ libelle: 'Renvoyée après correction' })
      .expect(201);
  });

  // ── 2. mode Pose / Régie / Les deux ─────────────────────────────────────

  it('installation mode: company setting, per job site, visible in /auth/me', async () => {
    await request(http)
      .patch('/api/v1/company/settings')
      .set(auth(admin))
      .send({ modeInstallation: 'LES_DEUX' })
      .expect(200)
      .expect((r) => expect(r.body.modeInstallation).toBe('LES_DEUX'));
    const me = await request(http).get('/api/v1/auth/me').set(auth(chef)).expect(200);
    expect(me.body.company.modeInstallation).toBe('LES_DEUX');

    let detail = await request(http)
      .get(`/api/v1/chantiers/${chantierId}`)
      .set(auth(chef))
      .expect(200);
    expect(detail.body.modeInstallation).toBeNull();
    expect(detail.body.modeInstallationEffectif).toBe('LES_DEUX');

    await request(http)
      .patch(`/api/v1/chantiers/${chantierId}`)
      .set(auth(chef))
      .send({ modeInstallation: 'REGIE' })
      .expect(422);
    await request(http)
      .patch(`/api/v1/chantiers/${chantierId}`)
      .set(auth(admin))
      .send({ modeInstallation: 'REGIE' })
      .expect(200);
    detail = await request(http).get(`/api/v1/chantiers/${chantierId}`).set(auth(chef)).expect(200);
    expect(detail.body.modeInstallationEffectif).toBe('REGIE');
  });

  // ── 3. doublons ─────────────────────────────────────────────────────────

  it('duplicates: found by phone (any format) or email; creation warns only when asked', async () => {
    const intl = `+33 ${tel.slice(1, 2)} ${tel.slice(2)}`;
    const res = await request(http)
      .get(`/api/v1/clients/doublons?telephone=${encodeURIComponent(intl)}`)
      .set(auth(technico))
      .expect(200);
    expect(res.body.map((c: { id: number }) => c.id)).toContain(clientId);
    expect(res.body[0].correspondances).toContain('TELEPHONE');

    // the chef only gets names
    const parChef = await request(http)
      .get(`/api/v1/clients/doublons?email=${tag.toUpperCase()}@CLIENT.TEST`)
      .set(auth(chef))
      .expect(200);
    expect(parChef.body[0]).toMatchObject({ id: clientId, correspondances: ['EMAIL'] });
    expect(parChef.body[0].telephone).toBeUndefined();

    const dto = { nom: `${tag} Doublon`, telephone: tel };
    const conflit = await request(http)
      .post('/api/v1/clients?verifierDoublons=true')
      .set(auth(technico))
      .send(dto)
      .expect(409);
    expect(conflit.body.code).toBe('CLIENT_EXISTANT');
    expect(conflit.body.details.doublons[0].id).toBe(clientId);
    // web behaviour unchanged: without the parameter the client is created
    await request(http).post('/api/v1/clients').set(auth(technico)).send(dto).expect(201);
  });

  // ── 4. visites ──────────────────────────────────────────────────────────

  it('visits: plan, list, done; reminder the day before; on the commercial dashboard', async () => {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    demain.setHours(10, 0, 0, 0);
    const v = await request(http)
      .post('/api/v1/visites')
      .set(auth(technico))
      .send({ clientId, dateHeure: demain.toISOString(), objet: 'Métré' })
      .expect(201);
    // no address sent: the client's address is used
    expect(v.body).toMatchObject({ statut: 'PREVUE', adresse: '3 rue du Test, 75011 Paris' });

    const liste = await request(http).get('/api/v1/visites').set(auth(technico)).expect(200);
    expect(liste.body.data.map((x: { id: number }) => x.id)).toContain(v.body.id);

    const dash = await request(http)
      .get('/api/v1/dashboard/commercial')
      .set(auth(technico))
      .expect(200);
    expect(dash.body.visites.aVenir).toBeGreaterThan(0);

    // the evening reminder (called directly: no cron in tests)
    await t.app.get(VisitesService).rappels(new Date());
    expect(
      await t.prisma.notification.count({ where: { userId: technicoId, type: 'VISITE_RAPPEL' } }),
    ).toBeGreaterThan(0);

    await request(http)
      .post(`/api/v1/visites/${v.body.id}/faite`)
      .set(auth(technico))
      .send({ compteRendu: 'Devis à faire' })
      .expect(200)
      .expect((r) => expect(r.body.statut).toBe('FAITE'));
    await request(http)
      .post(`/api/v1/visites/${v.body.id}/annuler`)
      .set(auth(technico))
      .send({})
      .expect(422);
    await request(http).get('/api/v1/visites').set(auth(chef)).expect(403);
  });

  // ── 5 + 6. prospect terrain and Devis IA draft by the chef ──────────────

  it('terrain prospect by the chef: duplicates checked, sales team notified, followed without amounts', async () => {
    const doublon = await request(http)
      .post('/api/v1/prospects-terrain')
      .set(auth(chef))
      .send({ client: { nom: 'Voisin', telephone: tel }, description: 'Veut une terrasse' })
      .expect(409);
    expect(doublon.body.details.doublons[0].telephone).toBeUndefined();

    const p = await request(http)
      .post('/api/v1/prospects-terrain')
      .set(auth(chef))
      .send({
        client: { nom: `${tag} Voisin`, prenom: 'Marc', telephone: '0699887766' },
        description: 'Veut une terrasse en bois de 20 m²',
      })
      .expect(201);
    expect(p.body).toMatchObject({ statut: 'NOUVEAU', client: { nom: `${tag} Voisin` } });

    await new Promise((r) => setTimeout(r, 300));
    expect(
      await t.prisma.notification.count({
        where: { userId: technicoId, type: 'PROSPECT_TERRAIN' },
      }),
    ).toBeGreaterThan(0);

    await request(http)
      .post(`/api/v1/prospects-terrain/${p.body.id}/fichiers`)
      .set(auth(chef))
      .attach('fichier', JPEG, 'terrasse.jpg')
      .expect(201);
    const mes = await request(http).get('/api/v1/prospects-terrain').set(auth(chef)).expect(200);
    expect(mes.body.data[0]).toMatchObject({ id: p.body.id, _count: { fichiers: 1 } });

    // the chef starts a Devis IA draft for his prospect, without any price
    const brouillon = await request(http)
      .post('/api/v1/devis/brouillon-chef')
      .set(auth(chef))
      .send({ clientId: p.body.client.id, demandeDevisId: p.body.id })
      .expect(201);
    expect(brouillon.body.statut).toBe('BROUILLON');
    expect(brouillon.body.totalHT).toBeUndefined();
    const proposition = await request(http)
      .post(`/api/v1/devis/${brouillon.body.id}/ia/proposer`)
      .set(auth(chef))
      .send({ description: 'Pose de carrelage sol 20 m² dans la salle de bain' })
      .expect(200);
    expect(JSON.stringify(proposition.body)).not.toMatch(/prixUnitaireHT|totalHT|marche/);

    // a client that is not his → refused
    const autre = await request(http)
      .post('/api/v1/clients')
      .set(auth(technico))
      .send({ nom: `${tag} Inconnu` })
      .expect(201);
    await request(http)
      .post('/api/v1/devis/brouillon-chef')
      .set(auth(chef))
      .send({ clientId: autre.body.id })
      .expect(403);
    // the sous-traitant has no access
    await request(http).get('/api/v1/prospects-terrain').set(auth(sousTraitant)).expect(403);
  });

  // ── 7. photos and reports by the chef ───────────────────────────────────

  it('chef photos (validated at once) and report; delete only just after sending', async () => {
    const photos = await request(http)
      .post(`/api/v1/chantiers/${chantierId}/photos`)
      .set(auth(chef))
      .field('tacheId', String(tacheId))
      .field('moment', 'AVANT')
      .attach('photos', JPEG, 'avant.jpg')
      .expect(201);
    expect(photos.body[0].statut).toBe('VALIDEE');
    const fichier = await t.prisma.fichier.findUniqueOrThrow({
      where: { id: photos.body[0].fichierId },
      select: { sha256: true },
    });
    expect(fichier.sha256).toMatch(/^[0-9a-f]{64}$/);

    const rapport = await request(http)
      .post(`/api/v1/chantiers/${chantierId}/rapports`)
      .set(auth(chef))
      .field('contenu', 'Chape coulée, séchage 48 h')
      .field('tacheId', String(tacheId))
      .attach('photos', JPEG, 'chape.jpg')
      .expect(201);
    expect(rapport.body.statut).toBe('VALIDE');

    await request(http)
      .delete(`/api/v1/chantiers/${chantierId}/rapports/${rapport.body.id}`)
      .set(auth(chef))
      .expect(204);
    await t.prisma.photoAvancement.update({
      where: { id: photos.body[0].id },
      data: { createdAt: new Date(Date.now() - 3600_000) },
    });
    await request(http)
      .delete(`/api/v1/chantiers/${chantierId}/photos/${photos.body[0].id}`)
      .set(auth(chef))
      .expect(422)
      .expect((r) => expect(r.body.code).toBe('DELAI_DEPASSE'));
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/photos`)
      .set(auth(technico))
      .field('tacheId', String(tacheId))
      .field('moment', 'AVANT')
      .attach('photos', JPEG, 'a.jpg')
      .expect(403);
  });

  // ── 8. filters ──────────────────────────────────────────────────────────

  it('job sites: period and team filters', async () => {
    const dans = await request(http)
      .get(`/api/v1/chantiers?du=2026-11-15&au=2026-11-16&intervenantId=${stId}&limit=100`)
      .set(auth(admin))
      .expect(200);
    expect(dans.body.data.map((c: { id: number }) => c.id)).toContain(chantierId);
    const hors = await request(http)
      .get('/api/v1/chantiers?du=2027-01-01&limit=100')
      .set(auth(admin))
      .expect(200);
    expect(hors.body.data.map((c: { id: number }) => c.id)).not.toContain(chantierId);
  });

  // ── 9. proof of the paper signature scan ────────────────────────────────

  it('paper signature scan keeps a proof: fingerprint, author, date, place', async () => {
    const devis = await request(http)
      .post('/api/v1/devis')
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/lignes`)
      .set(auth(technico))
      .send({ description: 'Travaux', quantite: 1, prixUnitaireVente: 500 })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/remettre`)
      .set(auth(technico))
      .expect(200);
    const res = await request(http)
      .post(`/api/v1/devis/${devis.body.id}/signature-papier`)
      .set(auth(technico))
      .field('latitude', '45.764')
      .field('longitude', '4.8357')
      .attach('fichier', JPEG, 'scan.jpg')
      .expect(200);
    expect(res.body.signaturePapierFichier.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(res.body.signaturePapierFichier.latitude)).toBeCloseTo(45.764);
    expect(res.body.signaturePapierPar.id).toBe(technicoId);
    expect(res.body.signaturePapierLe).toBeTruthy();
  });
});