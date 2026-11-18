import request from 'supertest';
import { App } from 'supertest/types';
import { PushService, type PushMessage } from '../src/modules/pilotage/notifications/push.service';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
/** Smallest valid JPEG header + padding: recognised by its magic number */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
/** « OggS » header: a voice note */
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64, 2)]);

/** Buffers a binary response (PDF). */
const binaire = (res: unknown, cb: (err: Error | null, body: unknown) => void) => {
  // at runtime the response is the Node stream (superagent's typing does not say so)
  const flux = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  flux.on('data', (c: Buffer) => chunks.push(c));
  flux.on('end', () => cb(null, Buffer.concat(chunks)));
};

/**
 * 16/11 — backend « lot B1 » for the mobile app (+ the 05/11 quote changes re-applied on gara).
 * Web routes are unchanged; every route below is new and protected by roles.
 */
describe('Mobile lot B1 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let assistante: string;
  let chef: string;
  let sousTraitant: string;
  let fournisseur: string;
  let chefId: number;
  let stId: number;
  let clientId: number;
  let chapeId: number;
  let chapeFibreeId: number;
  const pushes: { userIds: number[]; msg: PushMessage }[] = [];
  const fakePush = {
    envoyer: (userIds: number[], msg: PushMessage) => {
      pushes.push({ userIds, msg });
      return Promise.resolve();
    },
  };
  const tag = `e2e-mob-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function newSendableDevis() {
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
    return devis.body.id as number;
  }

  beforeAll(async () => {
    t = await createTestApp([], [{ provide: PushService, useValue: fakePush }]);
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    technico = await t.tokenFor(SEED.technico);
    assistante = await t.tokenFor(SEED.assistante);
    chef = await t.tokenFor(SEED.chef);
    sousTraitant = await t.tokenFor(SEED.sousTraitant);
    fournisseur = await t.tokenFor(SEED.fournisseur);
    chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;
    stId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })).id;

    const client = await request(http)
      .post('/api/v1/clients')
      .set(auth(technico))
      .send({
        nom: `${tag} Martin`,
        prenom: 'Paul',
        email: clientEmail,
        telephone: '06 12 34 56 78',
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
    await t.prisma.facture.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.savTicket.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    const fichiers = await t.prisma.devis.findMany({
      where: { clientId, signaturePapierFichierId: { not: null } },
      select: { signaturePapierFichierId: true },
    });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.fichier.deleteMany({
      where: {
        OR: [
          { id: { in: fichiers.map((f) => f.signaturePapierFichierId!) } },
          { demandeDevisFichier: { demandeDevis: { clientId } } },
        ],
      },
    });
    await t.prisma.demandeDevis.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.appareilPush.deleteMany({ where: { jeton: { contains: 'E2eMob' } } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null, signatureUpdatedAt: null },
    });
    await t.close();
  });

  // ── quotes: 05/11 re-applied ────────────────────────────────────────────

  it('remettre: BROUILLON → ENVOYE without email, remisLe + verification code set', async () => {
    const id = await newSendableDevis();
    const avant = t.mail.sent.length;
    const res = await request(http)
      .post(`/api/v1/devis/${id}/remettre`)
      .set(auth(technico))
      .expect(200);
    expect(res.body.statut).toBe('ENVOYE');
    expect(res.body.remisLe).toBeTruthy();
    expect(res.body.codeVerification).toMatch(/^[A-Z2-9]{6}$/);
    expect(t.mail.sent.length).toBe(avant);
  });

  it('remettre refuses an empty quote (same content checks as the email sending)', async () => {
    const devis = await request(http)
      .post('/api/v1/devis')
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    const res = await request(http)
      .post(`/api/v1/devis/${devis.body.id}/remettre`)
      .set(auth(technico))
      .expect(422);
    expect(res.body.code).toBe('DEVIS_SANS_LIGNES');
  });

  it('envoyer attaches the quote PDF to the email', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/envoyer`).set(auth(technico)).expect(200);
    const mail = t.mail.lastTo(clientEmail);
    expect(mail?.attachments?.[0]?.filename).toMatch(/^DEV-.*\.pdf$/);
    expect(mail?.attachments?.[0]?.content.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('lien-whatsapp: wa.me link with the international number; the email link stays valid', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/envoyer`).set(auth(technico)).expect(200);
    const res = await request(http)
      .post(`/api/v1/devis/${id}/lien-whatsapp`)
      .set(auth(technico))
      .expect(200);
    expect(res.body.numero).toBe('33612345678');
    expect(res.body.lienWhatsapp).toMatch(/^https:\/\/wa\.me\/33612345678\?text=/);
    const liens = await t.prisma.devisLienClient.findMany({
      where: { devisId: id, statut: { in: ['ACTIF', 'OTP_ENVOYE', 'OTP_VERIFIE'] } },
      select: { canal: true },
    });
    expect(liens.map((l) => l.canal).sort()).toEqual(['EMAIL', 'WHATSAPP']);
  });

  it('lien-whatsapp needs a sent quote', async () => {
    const id = await newSendableDevis();
    const res = await request(http)
      .post(`/api/v1/devis/${id}/lien-whatsapp`)
      .set(auth(technico))
      .expect(422);
    expect(res.body.code).toBe('DEVIS_NON_ENVOYE');
  });

  it('paper signature: deposit → SIGNE_PAPIER (ADMIN notified), reject → back to ENVOYE with the reason', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/remettre`).set(auth(technico)).expect(200);

    const depot = await request(http)
      .post(`/api/v1/devis/${id}/signature-papier`)
      .set(auth(technico))
      .attach('fichier', JPEG, 'scan.jpg')
      .expect(200);
    expect(depot.body.statut).toBe('SIGNE_PAPIER');
    expect(depot.body.signaturePapierFichier.mime).toBe('image/jpeg');

    // the chef cannot read the scan (office document)
    await request(http)
      .get(`/api/v1/fichiers/${depot.body.signaturePapierFichier.id}`)
      .set(auth(chef))
      .expect(404);

    // list filter used by the mobile « Signés papier à vérifier »
    const liste = await request(http)
      .get('/api/v1/devis?statuts=SIGNE_PAPIER')
      .set(auth(admin))
      .expect(200);
    expect(liste.body.data.map((d: { id: number }) => d.id)).toContain(id);

    // only the ADMIN validates / rejects
    await request(http)
      .post(`/api/v1/devis/${id}/signature-papier/rejeter`)
      .set(auth(technico))
      .send({ motif: 'Page 2 non signée' })
      .expect(403);
    const rejet = await request(http)
      .post(`/api/v1/devis/${id}/signature-papier/rejeter`)
      .set(auth(admin))
      .send({ motif: 'Page 2 non signée' })
      .expect(200);
    expect(rejet.body.statut).toBe('ENVOYE');
    expect(rejet.body.signaturePapierRejet).toBe('Page 2 non signée');

    // both steps are in the history (audit)
    await new Promise((r) => setTimeout(r, 300));
    const actions = await t.prisma.auditLog.findMany({
      where: { entite: 'Devis', entiteId: id },
      select: { action: true },
    });
    expect(actions.map((x) => x.action)).toEqual(
      expect.arrayContaining(['DEVIS_SIGNE_PAPIER', 'DEVIS_SIGNATURE_PAPIER_REJETEE']),
    );
  });

  it('paper signature validated by the ADMIN → SIGNE, job site and deposit invoice created', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/remettre`).set(auth(technico)).expect(200);
    await request(http)
      .post(`/api/v1/devis/${id}/signature-papier`)
      .set(auth(technico))
      .attach('fichier', JPEG, 'scan.jpg')
      .expect(200);
    const res = await request(http)
      .post(`/api/v1/devis/${id}/signature-papier/valider`)
      .set(auth(admin))
      .expect(200);
    expect(res.body.statut).toBe('SIGNE');
    expect(res.body.modeValidation).toBe('PAPIER');
    expect(res.body.chantier).toBeTruthy();
    expect(await t.prisma.facture.count({ where: { devisId: id, typeFacture: 'ACOMPTE' } })).toBe(
      1,
    );
  });

  it('refuser (team): motif required, ENVOYE → REFUSE', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/remettre`).set(auth(technico)).expect(200);
    await request(http)
      .post(`/api/v1/devis/${id}/refuser`)
      .set(auth(technico))
      .send({})
      .expect(400);
    const res = await request(http)
      .post(`/api/v1/devis/${id}/refuser`)
      .set(auth(technico))
      .send({ motif: 'Budget trop élevé' })
      .expect(200);
    expect(res.body.statut).toBe('REFUSE');
    expect(res.body.motifRefus).toBe('Budget trop élevé');
  });

  // ── quotes: mobile lot B1 ───────────────────────────────────────────────

  it('signer-sur-place: requires the advisor signature, then SIGNE in mode SUR_PLACE', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/remettre`).set(auth(technico)).expect(200);
    const body = {
      signatureClientBase64: PNG,
      nomSignataire: 'Paul Martin',
      latitude: 48.85,
      longitude: 2.35,
    };

    const sans = await request(http)
      .post(`/api/v1/devis/${id}/signer-sur-place`)
      .set(auth(technico))
      .send(body)
      .expect(422);
    expect(sans.body.code).toBe('SIGNATURE_CONSEILLER_MANQUANTE');

    await request(http)
      .put('/api/v1/auth/me/signature')
      .set(auth(technico))
      .send({ signatureBase64: PNG })
      .expect(200);
    const res = await request(http)
      .post(`/api/v1/devis/${id}/signer-sur-place`)
      .set(auth(technico))
      .send(body)
      .expect(200);
    expect(res.body.statut).toBe('SIGNE');
    expect(res.body.modeValidation).toBe('SUR_PLACE');
    expect(res.body.signataireNom).toBe('Paul Martin');
    expect(Number(res.body.signatureLatitude)).toBeCloseTo(48.85);
  });

  it('PDF of a quote and of an invoice (office only)', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/remettre`).set(auth(technico)).expect(200);
    const pdf = await request(http)
      .get(`/api/v1/devis/${id}/pdf`)
      .set(auth(technico))
      .buffer(true)
      .parse(binaire)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await request(http).get(`/api/v1/devis/${id}/pdf`).set(auth(chef)).expect(403);

    const facture = await t.prisma.facture.findFirst({ where: { devis: { clientId } } });
    if (facture) {
      const fpdf = await request(http)
        .get(`/api/v1/factures/${facture.id}/pdf`)
        .set(auth(assistante))
        .buffer(true)
        .parse(binaire)
        .expect(200);
      expect((fpdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      await request(http).get(`/api/v1/factures/${facture.id}/pdf`).set(auth(chef)).expect(403);
    }
  });

  it('verifier-qr: authentic and current / stale version / unknown', async () => {
    const id = await newSendableDevis();
    const devis = await request(http)
      .post(`/api/v1/devis/${id}/remettre`)
      .set(auth(technico))
      .expect(200);
    const contenu = `BATIFLOW:DEV:${id}:${devis.body.versionCourante}:${devis.body.codeVerification}`;

    const ok = await request(http)
      .get(`/api/v1/devis/verifier-qr?contenu=${encodeURIComponent(contenu)}`)
      .set(auth(technico))
      .expect(200);
    expect(ok.body).toMatchObject({ valide: true, devis: { id } });
    expect(ok.body.devis.codeVerification).toBeUndefined();

    const perime = await request(http)
      .get(
        `/api/v1/devis/verifier-qr?contenu=${encodeURIComponent(contenu.replace(/:(\d+):([A-Z0-9]+)$/, ':99:$2'))}`,
      )
      .set(auth(technico))
      .expect(200);
    expect(perime.body).toMatchObject({ valide: false, motif: 'VERSION_PERIMEE' });

    const inconnu = await request(http)
      .get('/api/v1/devis/verifier-qr?contenu=hello')
      .set(auth(technico))
      .expect(200);
    expect(inconnu.body).toMatchObject({ valide: false, motif: 'QR_INCONNU' });
    await request(http).get('/api/v1/devis/verifier-qr?contenu=x').set(auth(chef)).expect(403);
  });

  // ── prospects ───────────────────────────────────────────────────────────

  it('demande: photo + voice note attached, read by the office only; mesProspects filter', async () => {
    const demande = await request(http)
      .post('/api/v1/demandes-devis')
      .set(auth(technico))
      .send({ clientId, description: 'Salle de bain', source: 'APPEL' })
      .expect(201);
    const id = demande.body.id as number;

    const photo = await request(http)
      .post(`/api/v1/demandes-devis/${id}/fichiers`)
      .set(auth(technico))
      .attach('fichier', JPEG, 'piece.jpg')
      .expect(201);
    expect(photo.body.type).toBe('PHOTO');
    const audio = await request(http)
      .post(`/api/v1/demandes-devis/${id}/fichiers`)
      .set(auth(technico))
      .field('dureeSecondes', '42')
      .attach('fichier', OGG, 'note.ogg')
      .expect(201);
    expect(audio.body).toMatchObject({ type: 'AUDIO', dureeSecondes: 42 });
    expect(audio.body.fichier.mime).toBe('audio/ogg');

    // audio is refused where it is not allowed (generic file upload)
    await request(http)
      .post('/api/v1/fichiers')
      .set(auth(technico))
      .attach('file', OGG, 'note.ogg')
      .expect((r) => expect([400, 422]).toContain(r.status));

    const detail = await request(http)
      .get(`/api/v1/demandes-devis/${id}`)
      .set(auth(technico))
      .expect(200);
    expect(detail.body.fichiers).toHaveLength(2);
    await request(http)
      .get(`/api/v1/fichiers/${audio.body.fichier.id}`)
      .set(auth(chef))
      .expect(404);

    const mes = await request(http)
      .get('/api/v1/demandes-devis?mesProspects=true&limit=100')
      .set(auth(admin))
      .expect(200);
    expect(mes.body.data.map((d: { id: number }) => d.id)).not.toContain(id);
    const miens = await request(http)
      .get('/api/v1/demandes-devis?mesProspects=true&limit=100')
      .set(auth(technico))
      .expect(200);
    expect(miens.body.data.map((d: { id: number }) => d.id)).toContain(id);

    await request(http)
      .delete(`/api/v1/demandes-devis/${id}/fichiers/${photo.body.id}`)
      .set(auth(technico))
      .expect(204);
  });

  // ── job sites: comments, assignment notification, chef dashboard ────────

  it('task: assigning a sous-traitant notifies him (push), comments thread office / chef / portal', async () => {
    const chantier = await request(http)
      .post('/api/v1/chantiers')
      .set(auth(admin))
      .send({ clientId, adresse: '1 rue du Test', chefChantierId: chefId })
      .expect(201);
    const chantierId = chantier.body.id as number;
    pushes.length = 0;

    const tache = await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches`)
      .set(auth(chef))
      .send({ libelle: 'Pose carrelage', assigneeIds: [stId] })
      .expect(201);
    const tacheId = tache.body.id as number;

    await new Promise((r) => setTimeout(r, 300)); // listeners are async
    expect(
      await t.prisma.notification.count({ where: { userId: stId, type: 'TACHE_AFFECTEE' } }),
    ).toBeGreaterThan(0);
    expect(pushes.some((p) => p.userIds.includes(stId) && p.msg.type === 'TACHE_AFFECTEE')).toBe(
      true,
    );

    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches/${tacheId}/commentaires`)
      .set(auth(chef))
      .send({ texte: 'Carrelage livré jeudi' })
      .expect(201);
    await request(http)
      .post(`/api/v1/portail/sous-traitant/taches/${tacheId}/commentaires`)
      .set(auth(sousTraitant))
      .send({ texte: 'Bien noté' })
      .expect(201);
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches/${tacheId}/commentaires`)
      .set(auth(chef))
      .send({ texte: '   ' })
      .expect(400);

    const fil = await request(http)
      .get(`/api/v1/chantiers/${chantierId}/taches/${tacheId}/commentaires`)
      .set(auth(technico))
      .expect(200);
    expect(fil.body.map((c: { texte: string }) => c.texte)).toEqual([
      'Carrelage livré jeudi',
      'Bien noté',
    ]);

    // TECHNICO reads but does not write; a supplier sees nothing
    await request(http)
      .post(`/api/v1/chantiers/${chantierId}/taches/${tacheId}/commentaires`)
      .set(auth(technico))
      .send({ texte: 'x' })
      .expect(403);
    await request(http)
      .get(`/api/v1/chantiers/${chantierId}/taches/${tacheId}/commentaires`)
      .set(auth(fournisseur))
      .expect(403);

    const dash = await request(http).get('/api/v1/dashboard/chef').set(auth(chef)).expect(200);
    expect(dash.body.perimetre).toBe('MES_CHANTIERS');
    expect(dash.body).toHaveProperty('chantiersDuJour.total');
    expect(dash.body).toHaveProperty('tachesEnRetard.items');
    expect(dash.body).toHaveProperty('livraisonsAttendues.items');
    expect(dash.body).toHaveProperty('savOuverts.urgents');
    expect(JSON.stringify(dash.body)).not.toMatch(/totalHT|totalTTC|montant/);
  });

  it('commercial dashboard: TECHNICO sees his own figures, chef refused', async () => {
    const res = await request(http)
      .get('/api/v1/dashboard/commercial')
      .set(auth(technico))
      .expect(200);
    expect(res.body.perimetre).toBe('MOI');
    expect(res.body).toHaveProperty('devis.signesPapierAVerifier');
    expect(res.body).toHaveProperty('aRelancer.items');
    const adm = await request(http)
      .get('/api/v1/dashboard/commercial')
      .set(auth(admin))
      .expect(200);
    expect(adm.body.perimetre).toBe('ENTREPRISE');
    await request(http).get('/api/v1/dashboard/commercial').set(auth(chef)).expect(403);
    await request(http).get('/api/v1/dashboard/commercial?jours=0').set(auth(admin)).expect(422);
  });

  // ── push devices + long mobile session ──────────────────────────────────

  it('appareils: register (every role), move to another account, remove', async () => {
    const jeton = 'ExponentPushToken[E2eMob0123456789abcd]';
    await request(http)
      .post('/api/v1/mobile/appareils')
      .set(auth(chef))
      .send({ jeton, plateforme: 'android', nom: 'Téléphone test' })
      .expect(200);
    await request(http)
      .post('/api/v1/mobile/appareils')
      .set(auth(sousTraitant))
      .send({ jeton })
      .expect(200);
    const row = await t.prisma.appareilPush.findUniqueOrThrow({ where: { jeton } });
    expect(row.userId).toBe(stId);

    await request(http)
      .post('/api/v1/mobile/appareils')
      .set(auth(chef))
      .send({ jeton: 'pas-un-jeton' })
      .expect(400);
    await request(http).post('/api/v1/mobile/appareils').send({ jeton }).expect(401);

    await request(http)
      .delete(`/api/v1/mobile/appareils/${encodeURIComponent(jeton)}`)
      .set(auth(sousTraitant))
      .expect(204);
    expect(await t.prisma.appareilPush.count({ where: { jeton } })).toBe(0);
  });

  it('refresh token: only with X-Client: mobile, rotated, reuse revokes every session, logout', async () => {
    const login = (headers: Record<string, string> = {}) =>
      request(http)
        .post('/api/v1/auth/login')
        .set(headers)
        .send({ email: SEED.chef, password: 'Chef@2026!' })
        .expect(200);

    const web = await login();
    expect(web.body.accessToken).toBeTruthy();
    expect(web.body.refreshToken).toBeUndefined();

    const mobile = await login({ 'X-Client': 'mobile', 'X-Appareil': 'Pixel e2e' });
    const r1 = mobile.body.refreshToken as string;
    expect(r1).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const refresh = await request(http)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r1 })
      .expect(200);
    const r2 = refresh.body.refreshToken as string;
    expect(r2).not.toBe(r1);
    await request(http).get('/api/v1/auth/me').set(auth(refresh.body.accessToken)).expect(200);

    // r1 used again (stolen copy): refused AND r2 revoked too
    await request(http).post('/api/v1/auth/refresh').send({ refreshToken: r1 }).expect(401);
    await request(http).post('/api/v1/auth/refresh').send({ refreshToken: r2 }).expect(401);

    const again = await login({ 'X-Client': 'mobile' });
    await request(http)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: again.body.refreshToken })
      .expect(204);
    await request(http)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: again.body.refreshToken })
      .expect(401);
    await request(http).post('/api/v1/auth/refresh').send({ refreshToken: 'x' }).expect(400);
  });
});
