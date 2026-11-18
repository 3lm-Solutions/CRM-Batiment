import request from 'supertest';
import { App } from 'supertest/types';
import { InstallationsService } from '../src/modules/execution/installations/installations.service';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
/** Smallest JPEG header + padding: recognised by its magic number */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

/**
 * 18/11 — backend « lot B » for the mobile app: delegated installation (office follow-up, the
 * installer's missions, dates, step photos, reports, signed PV with a QR code).
 */
describe('Mobile lot B (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let assistante: string;
  let installateur: string;
  let chef: string;
  let installateurUserId: number;
  let installateurStId: number;
  let autreStId: number;
  let clientId: number;
  let chapeId: number;
  let chapeFibreeId: number;
  const tag = `e2e-lb-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  /** Notifications are written by an async listener after the answer */
  const attendre = () => new Promise((r) => setTimeout(r, 300));

  async function chantierLesDeux() {
    const res = await request(http)
      .post('/api/v1/chantiers')
      .set(auth(admin))
      .send({ clientId, adresse: '8 avenue des Pins, Lyon' })
      .expect(201);
    await request(http)
      .patch(`/api/v1/chantiers/${res.body.id}`)
      .set(auth(admin))
      .send({ modeInstallation: 'LES_DEUX' })
      .expect(200);
    return res.body.id as number;
  }

  /** An installation proposed to the seed installer, accepted, date confirmed → LIVRAISON. */
  async function missionEnLivraison() {
    const chantierId = await chantierLesDeux();
    const inst = await request(http)
      .post('/api/v1/installations')
      .set(auth(admin))
      .send({ chantierId })
      .expect(201);
    const id = inst.body.id as number;
    await request(http)
      .post(`/api/v1/installations/${id}/attribuer`)
      .set(auth(admin))
      .send({ sousTraitantId: installateurStId, dateSouhaitee: '2026-12-01' })
      .expect(200);
    await request(http)
      .post(`/api/v1/installateur/missions/${id}/accepter`)
      .set(auth(installateur))
      .expect(200);
    await request(http)
      .post(`/api/v1/installateur/missions/${id}/dates/confirmer`)
      .set(auth(installateur))
      .expect(200);
    return { id, chantierId };
  }

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    technico = await t.tokenFor(SEED.technico);
    assistante = await t.tokenFor(SEED.assistante);
    installateur = await t.tokenFor(SEED.sousTraitant);
    chef = await t.tokenFor(SEED.chef);
    installateurUserId = (
      await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })
    ).id;
    const st = await t.prisma.sousTraitant.findFirstOrThrow({
      where: { userId: installateurUserId },
    });
    installateurStId = st.id;
    await t.prisma.sousTraitant.update({ where: { id: st.id }, data: { installateur: true } });
    const autre = await t.prisma.sousTraitant.create({
      data: { companyId: st.companyId, nom: `${tag} Pose Express`, installateur: true },
    });
    autreStId = autre.id;

    const client = await request(http)
      .post('/api/v1/clients')
      .set(auth(technico))
      .send({
        nom: `${tag} Bernard`,
        prenom: 'Anne',
        telephone: '06 99 88 77 66',
        adresseClient: '8 avenue des Pins, Lyon',
      })
      .expect(201);
    clientId = client.body.id;

    const prestations = await request(http)
      .get(`/api/v1/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`)
      .set(auth(technico));
    chapeId = prestations.body.data[0].id;
    const detail = await request(http)
      .get(`/api/v1/catalogue/prestations/${chapeId}`)
      .set(auth(technico));
    chapeFibreeId = detail.body.options
      .find((o: { nom: string }) => o.nom === 'Type de chape')
      .choix.find((c: { nom: string }) => c.nom === 'Chape fibrée').id;
  });

  afterAll(async () => {
    const installations = await t.prisma.installation.findMany({
      where: { chantier: { clientId } },
      select: { id: true, pvFichierId: true },
    });
    const ids = installations.map((i) => i.id);
    const signalements = await t.prisma.signalement.findMany({
      where: { installationId: { in: ids } },
      select: { savTicketId: true },
    });
    await t.prisma.fichier.deleteMany({
      where: {
        OR: [
          { installationId: { in: ids } },
          { signalement: { installationId: { in: ids } } },
          {
            id: {
              in: installations.map((i) => i.pvFichierId).filter((x): x is number => x !== null),
            },
          },
        ],
      },
    });
    await t.prisma.installation.deleteMany({ where: { id: { in: ids } } });
    await t.prisma.savTicket.deleteMany({
      where: {
        id: { in: signalements.map((s) => s.savTicketId).filter((x): x is number => x !== null) },
      },
    });
    await t.prisma.reception.deleteMany({ where: { commandeFournisseur: { notes: tag } } });
    await t.prisma.commandeFournisseur.deleteMany({
      where: { OR: [{ notes: tag }, { devis: { clientId } }] },
    });
    await t.prisma.facture.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.sousTraitant.delete({ where: { id: autreStId } });
    await t.prisma.sousTraitant.update({
      where: { id: installateurStId },
      data: { installateur: false },
    });
    await t.prisma.company.updateMany({ data: { modeInstallation: 'POSE' } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null, signatureUpdatedAt: null },
    });
    await t.close();
  });

  // ── création ────────────────────────────────────────────────────────────

  it('a quote signed for a REGIE company creates the installation at « Devis signé » (once)', async () => {
    await t.prisma.company.updateMany({ data: { modeInstallation: 'REGIE' } });
    const devis = await request(http)
      .post('/api/v1/devis')
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/lignes`)
      .set(auth(technico))
      .send({ prestationId: chapeId, choixIds: [chapeFibreeId], quantite: 20 })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/remettre`)
      .set(auth(technico))
      .expect(200);
    await request(http)
      .put('/api/v1/auth/me/signature')
      .set(auth(technico))
      .send({ signatureBase64: PNG })
      .expect(200);
    const signe = await request(http)
      .post(`/api/v1/devis/${devis.body.id}/signer-sur-place`)
      .set(auth(technico))
      .send({ signatureClientBase64: PNG, nomSignataire: 'Anne Bernard' })
      .expect(200);
    await t.prisma.company.updateMany({ data: { modeInstallation: 'POSE' } });

    const chantierId = signe.body.chantier.id as number;
    const inst = await t.prisma.installation.findUniqueOrThrow({ where: { chantierId } });
    expect(inst).toMatchObject({
      etape: 'DEVIS_SIGNE',
      devisId: devis.body.id,
      sousTraitantId: null,
    });
    expect(inst.reference).toMatch(/^INS-\d{4}-\d{4}$/);

    // idempotent: running the hook again keeps one installation
    const service = t.app.get(InstallationsService);
    const again = await t.prisma.$transaction((tx) =>
      service.creerPourChantier(
        tx,
        { id: chantierId, companyId: inst.companyId },
        devis.body.id,
        null,
      ),
    );
    expect(again).toMatchObject({ id: inst.id, creee: false });
  });

  it('LES_DEUX: nothing until the office delegates; twice → 409; technico / chef → 403', async () => {
    const chantierId = await chantierLesDeux();
    await expect(t.prisma.installation.count({ where: { chantierId } })).resolves.toBe(0);
    const res = await request(http)
      .post('/api/v1/installations')
      .set(auth(assistante))
      .send({ chantierId })
      .expect(201);
    expect(res.body).toMatchObject({
      etape: 'DEVIS_SIGNE',
      chantier: { id: chantierId },
      enRetard: false,
    });
    expect(res.body.evenements).toHaveLength(1);

    const twice = await request(http)
      .post('/api/v1/installations')
      .set(auth(admin))
      .send({ chantierId })
      .expect(409);
    expect(twice.body.code).toBe('INSTALLATION_EXISTANTE');

    await request(http).get('/api/v1/installations').set(auth(technico)).expect(403);
    await request(http).get('/api/v1/installations').set(auth(chef)).expect(403);
    await request(http).get('/api/v1/installateur/missions').set(auth(chef)).expect(403);
  });

  // ── attribution, réponse de l'installateur ──────────────────────────────

  it('installers list; propose → installer notified; refuse (reason) → back to step 1, he no longer sees it', async () => {
    const liste = await request(http)
      .get('/api/v1/installations/installateurs')
      .set(auth(admin))
      .expect(200);
    const moi = liste.body.find((s: { id: number }) => s.id === installateurStId);
    expect(moi).toMatchObject({ aUnCompte: true, missionsEnCours: expect.any(Number) });

    const chantierId = await chantierLesDeux();
    const { body: inst } = await request(http)
      .post('/api/v1/installations')
      .set(auth(admin))
      .send({ chantierId })
      .expect(201);

    // an installer without account cannot be chosen
    const sansCompte = await request(http)
      .post(`/api/v1/installations/${inst.id}/attribuer`)
      .set(auth(admin))
      .send({ sousTraitantId: autreStId })
      .expect(422);
    expect(sansCompte.body.code).toBe('INSTALLATEUR_SANS_COMPTE');

    const propose = await request(http)
      .post(`/api/v1/installations/${inst.id}/attribuer`)
      .set(auth(admin))
      .send({
        sousTraitantId: installateurStId,
        note: 'Code portail 1234',
        dateSouhaitee: '2026-12-02',
      })
      .expect(200);
    expect(propose.body).toMatchObject({
      etape: 'INSTALLATEUR_PROPOSE',
      noteAttribution: 'Code portail 1234',
    });
    await attendre();
    await expect(
      t.prisma.notification.count({
        where: { userId: installateurUserId, type: 'INSTALLATION_PROPOSEE' },
      }),
    ).resolves.toBeGreaterThan(0);

    const missions = await request(http)
      .get('/api/v1/installateur/missions?filtre=PROPOSEES')
      .set(auth(installateur))
      .expect(200);
    const mission = missions.body.data.find((m: { id: number }) => m.id === inst.id);
    expect(mission).toBeDefined();
    expect(mission).not.toHaveProperty('codePv');
    expect(JSON.stringify(missions.body)).not.toMatch(/prixUnitaire|totalHT|"prix/);

    await request(http)
      .post(`/api/v1/installateur/missions/${inst.id}/refuser`)
      .set(auth(installateur))
      .send({})
      .expect(400);
    const refus = await request(http)
      .post(`/api/v1/installateur/missions/${inst.id}/refuser`)
      .set(auth(installateur))
      .send({ motif: 'Pas disponible en décembre' })
      .expect(200);
    expect(refus.body.etape).toBe('DEVIS_SIGNE');
    await request(http)
      .get(`/api/v1/installateur/missions/${inst.id}`)
      .set(auth(installateur))
      .expect(404);

    const detail = await request(http)
      .get(`/api/v1/installations/${inst.id}`)
      .set(auth(admin))
      .expect(200);
    expect(detail.body).toMatchObject({ etape: 'DEVIS_SIGNE', sousTraitant: null });
    expect(detail.body.evenements.map((e: { type: string }) => e.type)).toEqual([
      'CREEE',
      'PROPOSEE',
      'REFUSEE',
    ]);
  });

  // ── dates ───────────────────────────────────────────────────────────────

  it('the installer proposes another date, the office accepts → confirmed, delivery step', async () => {
    const chantierId = await chantierLesDeux();
    const { body: inst } = await request(http)
      .post('/api/v1/installations')
      .set(auth(admin))
      .send({ chantierId })
      .expect(201);
    await request(http)
      .post(`/api/v1/installations/${inst.id}/attribuer`)
      .set(auth(admin))
      .send({ sousTraitantId: installateurStId, dateSouhaitee: '2026-12-03' })
      .expect(200);
    await request(http)
      .post(`/api/v1/installateur/missions/${inst.id}/accepter`)
      .set(auth(installateur))
      .expect(200);

    const prop = await request(http)
      .post(`/api/v1/installateur/missions/${inst.id}/dates/proposer`)
      .set(auth(installateur))
      .send({ date: '2026-12-08' })
      .expect(200);
    expect(prop.body).toMatchObject({
      etape: 'MISSION_ACCEPTEE',
      dateProposee: expect.stringMatching(/^2026-12-08/),
    });

    const ok = await request(http)
      .post(`/api/v1/installations/${inst.id}/dates/accepter`)
      .set(auth(admin))
      .expect(200);
    expect(ok.body).toMatchObject({
      etape: 'LIVRAISON',
      dateProposee: null,
      dateConfirmee: expect.stringMatching(/^2026-12-08/),
    });

    const relance = await request(http)
      .post(`/api/v1/installations/${inst.id}/relancer`)
      .set(auth(admin))
      .expect(200);
    expect(relance.body.relanceLe).toBeTruthy();
    const tropTot = await request(http)
      .post(`/api/v1/installations/${inst.id}/relancer`)
      .set(auth(admin))
      .expect(422);
    expect(tropTot.body.code).toBe('RELANCE_TROP_TOT');
  });

  // ── livraison, avancement, problèmes ────────────────────────────────────

  it('delivery checked by the installer (gaps, no price); other installer 404 on the order', async () => {
    const { chantierId } = await missionEnLivraison();
    const materiau = await t.prisma.materiau.findFirstOrThrow({
      where: { actif: true, fournisseur: { actif: true } },
    });
    const cmd = await request(http)
      .post('/api/v1/commandes-fournisseur')
      .set(auth(admin))
      .send({
        fournisseurId: materiau.fournisseurId,
        chantierId,
        lignes: [{ materiauId: materiau.id, quantite: 4 }],
        notes: tag,
      })
      .expect(201);
    await t.prisma.commandeFournisseur.update({
      where: { id: cmd.body.id },
      data: { statutLivraison: 'ENVOYEE' },
    });

    const vue = await request(http)
      .get(`/api/v1/commandes-fournisseur/${cmd.body.id}`)
      .set(auth(installateur))
      .expect(200);
    expect(JSON.stringify(vue.body)).not.toMatch(/"prixUnitaire"|"totalHT"/);

    const recu = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.body.id}/receptions`)
      .set(auth(installateur))
      .send({
        lignes: [{ ligneId: cmd.body.lignes[0].id, quantite: 3 }],
        ecarts: [
          {
            type: 'ABIME',
            ligneId: cmd.body.lignes[0].id,
            libelle: '1 carton écrasé',
            quantite: 1,
          },
        ],
      })
      .expect(201);
    await request(http)
      .post(`/api/v1/receptions/${recu.body.receptionId}/fichiers`)
      .set(auth(installateur))
      .attach('fichier', JPEG, 'bl.jpg')
      .expect(201);

    // an order of a job site that is not one of his missions
    const autre = await request(http)
      .post('/api/v1/commandes-fournisseur')
      .set(auth(admin))
      .send({
        fournisseurId: materiau.fournisseurId,
        lignes: [{ materiauId: materiau.id, quantite: 1 }],
        notes: tag,
      })
      .expect(201);
    await request(http)
      .get(`/api/v1/commandes-fournisseur/${autre.body.id}`)
      .set(auth(installateur))
      .expect(404);
  });

  it('step photos, then POSE → FINITIONS; without a photo → 422; report → office notified → SAV', async () => {
    const { id } = await missionEnLivraison();

    const sansPhoto = await request(http)
      .post(`/api/v1/installateur/missions/${id}/avancer`)
      .set(auth(installateur))
      .send({ etape: 'POSE' })
      .expect(422);
    expect(sansPhoto.body.code).toBe('PHOTO_ETAPE_MANQUANTE');

    await request(http)
      .post(`/api/v1/installateur/missions/${id}/etapes/POSE/photos`)
      .set(auth(installateur))
      .attach('photos', JPEG, 'mauvaise-etape.jpg')
      .expect(422);
    const photos = await request(http)
      .post(`/api/v1/installateur/missions/${id}/etapes/LIVRAISON/photos`)
      .set(auth(installateur))
      .attach('photos', JPEG, 'livraison.jpg')
      .expect(201);
    expect(photos.body).toHaveLength(1);

    const pose = await request(http)
      .post(`/api/v1/installateur/missions/${id}/avancer`)
      .set(auth(installateur))
      .send({ etape: 'POSE' })
      .expect(200);
    expect(pose.body.etape).toBe('POSE');

    const sig = await request(http)
      .post(`/api/v1/installateur/missions/${id}/signalements`)
      .set(auth(installateur))
      .field('type', 'RESERVE')
      .field('description', 'Deux carreaux fissurés')
      .field('savDemande', 'true')
      .attach('photos', JPEG, 'fissure.jpg')
      .expect(201);
    expect(sig.body).toMatchObject({ type: 'RESERVE', savDemande: true, statut: 'OUVERT' });
    expect(sig.body.photos).toHaveLength(1);
    await attendre();
    const assistanteId = (
      await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.assistante } })
    ).id;
    await expect(
      t.prisma.notification.count({
        where: { userId: assistanteId, type: 'INSTALLATION_SIGNALEMENT' },
      }),
    ).resolves.toBeGreaterThan(0);

    const sav = await request(http)
      .post(`/api/v1/installations/${id}/signalements/${sig.body.id}/sav`)
      .set(auth(assistante))
      .expect(201);
    expect(sav.body.reference).toMatch(/^SAV-/);
    await request(http)
      .post(`/api/v1/installations/${id}/signalements/${sig.body.id}/sav`)
      .set(auth(admin))
      .expect(409);
    await request(http)
      .post(`/api/v1/installations/${id}/signalements/${sig.body.id}/traiter`)
      .set(auth(admin))
      .expect(200);

    await request(http)
      .post(`/api/v1/installateur/missions/${id}/etapes/POSE/photos`)
      .set(auth(installateur))
      .attach('photos', JPEG, 'pose.jpg')
      .expect(201);
    const fin = await request(http)
      .post(`/api/v1/installateur/missions/${id}/avancer`)
      .set(auth(installateur))
      .send({ etape: 'FINITIONS' })
      .expect(200);
    expect(fin.body.etape).toBe('FINITIONS');
  });

  // ── PV de fin de travaux ────────────────────────────────────────────────

  async function missionEnFinitions() {
    const { id } = await missionEnLivraison();
    for (const etape of ['LIVRAISON', 'POSE'] as const) {
      await request(http)
        .post(`/api/v1/installateur/missions/${id}/etapes/${etape}/photos`)
        .set(auth(installateur))
        .attach('photos', JPEG, `${etape}.jpg`)
        .expect(201);
      await request(http)
        .post(`/api/v1/installateur/missions/${id}/avancer`)
        .set(auth(installateur))
        .send({ etape: etape === 'LIVRAISON' ? 'POSE' : 'FINITIONS' })
        .expect(200);
    }
    return id;
  }

  it('PV: PDF with QR; wrong QR → 422; right QR → TERMINEE, office notified; then the office closes', async () => {
    const id = await missionEnFinitions();
    const pdf = await request(http)
      .get(`/api/v1/installateur/missions/${id}/pv`)
      .set(auth(installateur))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const inst = await t.prisma.installation.findUniqueOrThrow({ where: { id } });
    const qr = `BATIFLOW:PV:${id}:${inst.codePv}`;
    const verif = await request(http)
      .get(`/api/v1/installateur/pv/verifier?contenu=${encodeURIComponent(qr)}`)
      .set(auth(installateur))
      .expect(200);
    expect(verif.body).toMatchObject({ valide: true, installation: { id } });

    const faux = await request(http)
      .post(`/api/v1/installateur/missions/${id}/pv`)
      .set(auth(installateur))
      .attach('fichier', JPEG, 'pv.jpg')
      .field('qrContenu', `BATIFLOW:PV:${id}:ZZZZZZ`)
      .expect(422);
    expect(faux.body.code).toBe('PV_QR_INVALIDE');

    const ok = await request(http)
      .post(`/api/v1/installateur/missions/${id}/pv`)
      .set(auth(installateur))
      .attach('fichier', JPEG, 'pv.jpg')
      .field('qrContenu', qr)
      .field('latitude', '45.75')
      .field('longitude', '4.85')
      .expect(201);
    expect(ok.body).toMatchObject({ etape: 'TERMINEE', pvSigneLe: expect.any(String) });
    await attendre();
    const adminId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.admin } })).id;
    await expect(
      t.prisma.notification.count({ where: { userId: adminId, type: 'INSTALLATION_PV_SIGNE' } }),
    ).resolves.toBeGreaterThan(0);

    const close = await request(http)
      .post(`/api/v1/installations/${id}/cloturer`)
      .set(auth(admin))
      .expect(200);
    expect(close.body.etape).toBe('CLOTUREE');
  });

  it('PV without a readable QR: « à vérifier », the office validates → TERMINEE; counters follow', async () => {
    const id = await missionEnFinitions();
    const sent = await request(http)
      .post(`/api/v1/installateur/missions/${id}/pv`)
      .set(auth(installateur))
      .attach('fichier', JPEG, 'pv-flou.jpg')
      .expect(201);
    expect(sent.body).toMatchObject({ etape: 'FINITIONS', pvAVerifier: true });

    const compteurs = await request(http)
      .get('/api/v1/installations/compteurs')
      .set(auth(admin))
      .expect(200);
    expect(compteurs.body.pvAVerifier).toBeGreaterThan(0);
    expect(compteurs.body.parEtape).toHaveProperty('FINITIONS');

    const twice = await request(http)
      .post(`/api/v1/installateur/missions/${id}/pv`)
      .set(auth(installateur))
      .attach('fichier', JPEG, 'pv-2.jpg')
      .expect(422);
    expect(twice.body.code).toBe('PV_EN_ATTENTE');

    const valide = await request(http)
      .post(`/api/v1/installations/${id}/pv/valider`)
      .set(auth(admin))
      .expect(200);
    expect(valide.body).toMatchObject({ etape: 'TERMINEE', pvAVerifier: false });
  });
});
