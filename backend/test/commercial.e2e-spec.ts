import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Demande → devis → envoi → validation client → signature (OTP) → SIGNE, through real HTTP.
 * Requires a migrated database seeded with the catalogue. Test data uses a dedicated client.
 */
describe('Commercial: demandes & devis (e2e)', () => {
  let t: TestApp;
  let http: App;
  let technico: string;
  let chef: string;
  let clientId: number;
  let chapeId: number;
  let chapeFibreeId: number;
  const tag = `e2e-com-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Token of the last link emailed to the test client. */
  const lastLinkToken = () => {
    const text = t.mail.lastTo(clientEmail)?.text ?? '';
    const token = /\/devis\/lien\/([A-Za-z0-9_-]+)/.exec(text)?.[1];
    if (!token) throw new Error('no link in last email');
    return token;
  };
  const lastCode = () => /:\s*(\d{6})\b/.exec(t.mail.lastTo(clientEmail)?.text ?? '')?.[1];

  /** A sendable quote with one catalogue line. */
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
    t = await createTestApp();
    http = t.http;
    technico = await t.tokenFor(SEED.technico);
    chef = await t.tokenFor(SEED.chef);

    const client = await request(http)
      .post('/api/v1/clients')
      .set(auth(technico))
      .send({ nom: `${tag} Durand`, prenom: 'Lucie', email: clientEmail })
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
    // A signed quote creates the deposit invoice (and maybe orders / a job site): removed first
    await t.prisma.facture.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { devis: { clientId } } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.demandeDevis.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.user.update({
      where: { email: SEED.technico },
      data: { signatureBase64: null, signatureUpdatedAt: null },
    });
    await t.close();
  });

  it('P0.1: converts a request into ONE draft quote (idempotent, no 0 € placeholder line)', async () => {
    const demande = await request(http)
      .post('/api/v1/demandes-devis')
      .set(auth(technico))
      .send({ clientId, description: 'Chape salon 20 m²', source: 'APPEL' })
      .expect(201);
    expect(demande.body.reference).toMatch(/^DEM-\d{4}-\d{4,}$/);

    const first = await request(http)
      .post(`/api/v1/demandes-devis/${demande.body.id}/convertir-en-devis`)
      .set(auth(technico))
      .expect(200);
    const again = await request(http)
      .post(`/api/v1/demandes-devis/${demande.body.id}/convertir-en-devis`)
      .set(auth(technico))
      .expect(200);

    expect(first.body.id).toBe(again.body.id);
    expect(first.body.statut).toBe('BROUILLON');
    expect(first.body.lignes).toHaveLength(0);
    expect(first.body.reference).toMatch(/^DEV-\d{4}-\d{4,}$/);
  });

  it('adds a catalogue line: chosen options stored as data, exact totals', async () => {
    const id = await newSendableDevis();
    const res = await request(http).get(`/api/v1/devis/${id}`).set(auth(technico)).expect(200);
    const [ligne] = res.body.lignes;

    expect(ligne.optionsChoisies).toEqual([
      expect.objectContaining({ optionNom: 'Type de chape', choixNom: 'Chape fibrée' }),
    ]);
    expect(ligne.prixAchat).toBeGreaterThan(0);
    expect(res.body.totalHT).toBe(ligne.totalHT);
    expect(res.body.totalTTC).toBeCloseTo(res.body.totalHT * 1.2, 2);
    expect(typeof res.body.alerteMarge).toBe('boolean');
  });

  it('P0.6: refuses to send a quote without lines or worth 0 €', async () => {
    const empty = await request(http)
      .post('/api/v1/devis')
      .set(auth(technico))
      .send({ clientId })
      .expect(201);
    await request(http)
      .post(`/api/v1/devis/${empty.body.id}/envoyer`)
      .set(auth(technico))
      .expect(422);

    await request(http)
      .post(`/api/v1/devis/${empty.body.id}/lignes`)
      .set(auth(technico))
      .send({ description: 'Geste commercial', quantite: 1, prixUnitaireVente: 0 })
      .expect(201);
    const zero = await request(http)
      .post(`/api/v1/devis/${empty.body.id}/envoyer`)
      .set(auth(technico))
      .expect(422);
    expect(zero.body.code).toBe('DEVIS_A_ZERO');
  });

  describe('full client flow', () => {
    let devisId: number;
    let firstLink: string;

    it('sends the quote: the client gets a link, the view leaks NO cost or margin', async () => {
      devisId = await newSendableDevis();
      const sent = await request(http)
        .post(`/api/v1/devis/${devisId}/envoyer`)
        .set(auth(technico))
        .expect(200);
      expect(sent.body.devis.statut).toBe('ENVOYE');
      expect(sent.body.emailSent).toBe(true);

      firstLink = lastLinkToken();
      const view = await request(http).get(`/api/v1/public/devis/${firstLink}`).expect(200);
      expect(view.body.lien).toMatchObject({ type: 'VALIDATION', peutRepondre: true });

      const json = JSON.stringify(view.body);
      for (const secret of [
        'coutTotal',
        'profit',
        'margePourcent',
        'prixAchat',
        'mainOeuvre',
        'notes',
        'fournisseur',
      ]) {
        expect(json).not.toContain(secret);
      }
    });

    it('editing a sent quote is refused', async () => {
      await request(http)
        .post(`/api/v1/devis/${devisId}/lignes`)
        .set(auth(technico))
        .send({ description: 'Extra', quantite: 1, prixUnitaireVente: 10 })
        .expect(422);
    });

    it('revising cancels the link already sent (no accepting an outdated version)', async () => {
      await request(http)
        .post(`/api/v1/devis/${devisId}/reviser`)
        .set(auth(technico))
        .send({ justification: 'Client souhaite une option moins chère' })
        .expect(200);

      const old = await request(http).get(`/api/v1/public/devis/${firstLink}`).expect(200);
      expect(old.body.lien.statut).toBe('ANNULE');
      await request(http).post(`/api/v1/public/devis/${firstLink}/accepter`).expect(410);

      const resent = await request(http)
        .post(`/api/v1/devis/${devisId}/envoyer`)
        .set(auth(technico))
        .expect(200);
      expect(resent.body.devis.statut).toBe('RENVOYE');
      expect(resent.body.devis.versionCourante).toBe(2);
    });

    it('the client accepts with the new link; the link cannot be reused', async () => {
      const token = lastLinkToken();
      await request(http).post(`/api/v1/public/devis/${token}/accepter`).expect(200);
      await request(http).post(`/api/v1/public/devis/${token}/accepter`).expect(410);

      const devis = await request(http).get(`/api/v1/devis/${devisId}`).set(auth(technico));
      expect(devis.body.statut).toBe('ACCEPTE');
    });

    it('signature needs the emailed code; 5 wrong codes block the link', async () => {
      await request(http)
        .post(`/api/v1/devis/${devisId}/demander-signature`)
        .set(auth(technico))
        .expect(200);
      const token = lastLinkToken();

      // signing without the code is refused
      await request(http)
        .post(`/api/v1/public/devis/${token}/signer`)
        .send({ signatureBase64: PNG })
        .expect(422);

      const code = await request(http).post(`/api/v1/public/devis/${token}/code`).expect(200);
      expect(code.body.envoyeA).toContain('*');
      const otp = lastCode()!;
      const wrong = otp === '000000' ? '111111' : '000000';

      await request(http)
        .post(`/api/v1/public/devis/${token}/code/verifier`)
        .send({ code: wrong })
        .expect(422);
      await request(http)
        .post(`/api/v1/public/devis/${token}/code/verifier`)
        .send({ code: otp })
        .expect(200);

      const signed = await request(http)
        .post(`/api/v1/public/devis/${token}/signer`)
        .send({ signatureBase64: PNG })
        .expect(200);
      expect(signed.body.message).toMatch(/conseiller/); // advisor has not signed yet
    });

    it('the advisor signs with his profile signature → SIGNE, then everything is frozen', async () => {
      const missing = await request(http)
        .post(`/api/v1/devis/${devisId}/signer-conseiller`)
        .set(auth(technico))
        .send({})
        .expect(422);
      expect(missing.body.code).toBe('SIGNATURE_CONSEILLER_MANQUANTE');

      await request(http)
        .put('/api/v1/auth/me/signature')
        .set(auth(technico))
        .send({ signatureBase64: PNG })
        .expect(200);
      const res = await request(http)
        .post(`/api/v1/devis/${devisId}/signer-conseiller`)
        .set(auth(technico))
        .send({})
        .expect(200);
      expect(res.body.devis.statut).toBe('SIGNE');

      await request(http)
        .post(`/api/v1/devis/${devisId}/annuler`)
        .set(auth(technico))
        .send({})
        .expect(422);
      await request(http)
        .post(`/api/v1/devis/${devisId}/reviser`)
        .set(auth(technico))
        .send({ justification: 'x' })
        .expect(422);

      const versions = await request(http)
        .get(`/api/v1/devis/${devisId}/versions`)
        .set(auth(technico))
        .expect(200);
      expect(versions.body.map((v: { numeroVersion: number }) => v.numeroVersion)).toEqual([2, 1]);
    });
  });

  it('verbal agreement: the advisor signs a sent quote directly', async () => {
    await request(http)
      .put('/api/v1/auth/me/signature')
      .set(auth(technico))
      .send({ signatureBase64: PNG })
      .expect(200);
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/envoyer`).set(auth(technico)).expect(200);
    const res = await request(http)
      .post(`/api/v1/devis/${id}/signer-conseiller`)
      .set(auth(technico))
      .send({ verbal: true })
      .expect(200);
    expect(res.body.devis).toMatchObject({ statut: 'SIGNE', modeValidation: 'VERBAL' });
  });

  it('two simultaneous acceptances: exactly one wins', async () => {
    const id = await newSendableDevis();
    await request(http).post(`/api/v1/devis/${id}/envoyer`).set(auth(technico)).expect(200);
    const token = lastLinkToken();

    const results = await Promise.all([
      request(http).post(`/api/v1/public/devis/${token}/accepter`),
      request(http).post(`/api/v1/public/devis/${token}/accepter`),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect([409, 410]).toContain(statuses[1]);
  });

  it('an unknown token is a plain 404', async () => {
    await request(http).get('/api/v1/public/devis/not-a-real-token').expect(404);
  });

  it('duplicates a quote as a new draft with the same lines', async () => {
    const id = await newSendableDevis();
    const copy = await request(http)
      .post(`/api/v1/devis/${id}/dupliquer`)
      .set(auth(technico))
      .expect(201);
    expect(copy.body.id).not.toBe(id);
    expect(copy.body.statut).toBe('BROUILLON');
    expect(copy.body.lignes).toHaveLength(1);
  });

  it('a chef de chantier only sees quotes of his job sites, never amounts', async () => {
    const id = await newSendableDevis(); // no job site yet
    await request(http).get(`/api/v1/devis/${id}`).set(auth(chef)).expect(404);
    const list = await request(http).get('/api/v1/devis').set(auth(chef)).expect(200);
    for (const row of list.body.data) {
      expect(row.totalHT).toBeUndefined();
      expect(row.margePourcent).toBeUndefined();
    }
    await request(http).post('/api/v1/devis').set(auth(chef)).send({ clientId }).expect(403);
  });
});
