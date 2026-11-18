import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/** Smallest JPEG header + padding: recognised by its magic number */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

/**
 * 18/11 — backend « lot A » for the mobile app: delivery gaps checked against the delivery note,
 * supplier invoices (dépenses), counters of the admin validation screen, client search by city.
 * Without the new fields, the web gets exactly the same answers as before.
 */
describe('Mobile lot A (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let assistante: string;
  let chef: string;
  let chefId: number;
  let clientId: number;
  let chantierId: number;
  let fournisseurId: number;
  let materiauId: number;
  const tag = `e2e-la-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  /** Notifications are written by an async listener after the answer */
  const attendre = () => new Promise((r) => setTimeout(r, 300));

  /** A manual order of 10 units for the chef's job site, already sent to the supplier. */
  async function commandeEnvoyee(quantite = 10) {
    const res = await request(http)
      .post('/api/v1/commandes-fournisseur')
      .set(auth(admin))
      .send({ fournisseurId, chantierId, lignes: [{ materiauId, quantite }], notes: tag })
      .expect(201);
    await t.prisma.commandeFournisseur.update({
      where: { id: res.body.id },
      data: { statutLivraison: 'ENVOYEE', dateEnvoi: new Date() },
    });
    return { id: res.body.id as number, ligneId: res.body.lignes[0].id as number };
  }

  const stockDe = async () =>
    (
      await t.prisma.materiau.findUniqueOrThrow({ where: { id: materiauId } })
    ).stockActuel.toNumber();

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    technico = await t.tokenFor(SEED.technico);
    assistante = await t.tokenFor(SEED.assistante);
    chef = await t.tokenFor(SEED.chef);
    chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;

    const client = await request(http)
      .post('/api/v1/clients')
      .set(auth(technico))
      .send({ nom: `${tag} Martin`, prenom: 'Paul', adresseClient: '12 rue des Lilas, 69003 Lyon' })
      .expect(201);
    clientId = client.body.id;
    const chantier = await request(http)
      .post('/api/v1/chantiers')
      .set(auth(admin))
      .send({ clientId, adresse: '12 rue des Lilas, Lyon', chefChantierId: chefId })
      .expect(201);
    chantierId = chantier.body.id;

    const materiau = await t.prisma.materiau.findFirstOrThrow({
      where: { actif: true, fournisseur: { actif: true } },
    });
    materiauId = materiau.id;
    fournisseurId = materiau.fournisseurId!;
  });

  afterAll(async () => {
    const commandes = await t.prisma.commandeFournisseur.findMany({
      where: { notes: tag },
      select: { id: true },
    });
    const ids = commandes.map((c) => c.id);
    const receptions = await t.prisma.reception.findMany({
      where: { commandeFournisseurId: { in: ids } },
      select: { id: true },
    });
    const rids = receptions.map((r) => r.id);
    await t.prisma.fichier.deleteMany({
      where: { OR: [{ receptionId: { in: rids } }, { depense: { notes: tag } }] },
    });
    await t.prisma.depense.deleteMany({ where: { notes: tag } });
    // stock movements and quantities put back so other suites see the same stock
    const lignes = await t.prisma.receptionLigne.findMany({ where: { receptionId: { in: rids } } });
    const total = lignes.reduce((s, l) => s + l.quantite.toNumber(), 0);
    if (total) {
      await t.prisma.materiau.update({
        where: { id: materiauId },
        data: { stockActuel: { decrement: total } },
      });
    }
    await t.prisma.mouvementStock.deleteMany({
      where: {
        reference: {
          in: (
            await t.prisma.commandeFournisseur.findMany({
              where: { id: { in: ids } },
              select: { reference: true },
            })
          ).map((c) => c.reference),
        },
      },
    });
    await t.prisma.reception.deleteMany({ where: { id: { in: rids } } });
    await t.prisma.commandeFournisseur.deleteMany({ where: { id: { in: ids } } });
    await t.prisma.chantier.deleteMany({ where: { id: chantierId } });
    await t.prisma.client.deleteMany({ where: { id: clientId } });
    await t.close();
  });

  // ── recherche des clients par ville ─────────────────────────────────────

  it('clients: search finds the city written in the address', async () => {
    const lyon = await request(http)
      .get('/api/v1/clients?search=lyon&limit=100')
      .set(auth(technico))
      .expect(200);
    expect(lyon.body.data.map((c: { id: number }) => c.id)).toContain(clientId);

    const lille = await request(http)
      .get(`/api/v1/clients?search=lille&limit=100`)
      .set(auth(technico))
      .expect(200);
    expect(lille.body.data.map((c: { id: number }) => c.id)).not.toContain(clientId);
  });
  // ── livraisons vérifiées avec le bon de livraison ───────────────────────

  it('reception without gaps: unchanged for the web (SANS_ECART, stock +)', async () => {
    const cmd = await commandeEnvoyee();
    const avant = await stockDe();
    const res = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({ lignes: [{ ligneId: cmd.ligneId, quantite: 10 }] })
      .expect(201);
    expect(res.body.statutLivraison).toBe('RECUE');
    expect(res.body.receptions[0]).toMatchObject({ statutControle: 'SANS_ECART', ecarts: [] });
    expect(await stockDe()).toBeCloseTo(avant + 10, 3);
  });

  it('reception with gaps: A_VERIFIER, extra / unknown items not in stock, office notified', async () => {
    const cmd = await commandeEnvoyee();
    const avant = await stockDe();
    const res = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({
        lignes: [{ ligneId: cmd.ligneId, quantite: 8 }],
        ecarts: [
          { type: 'MANQUANT', ligneId: cmd.ligneId, libelle: 'Il manque 2 unités', quantite: 2 },
          { type: 'EN_TROP', libelle: 'Palette de colle en plus', quantite: 1 },
          { type: 'INCONNU', libelle: 'Carton sans étiquette' },
        ],
      })
      .expect(201);
    expect(res.body.receptionId).toEqual(expect.any(Number));
    expect(res.body.statutLivraison).toBe('PARTIELLE');
    // only what was really received of the ordered line enters the stock
    expect(await stockDe()).toBeCloseTo(avant + 8, 3);

    const detail = await request(http)
      .get(`/api/v1/receptions/${res.body.receptionId}`)
      .set(auth(chef))
      .expect(200);
    expect(detail.body.statutControle).toBe('A_VERIFIER');
    expect(detail.body.ecarts.map((e: { type: string }) => e.type)).toEqual([
      'MANQUANT',
      'EN_TROP',
      'INCONNU',
    ]);
    expect(JSON.stringify(detail.body)).not.toMatch(/prixUnitaire|totalHT/);

    const assistanteId = (
      await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.assistante } })
    ).id;
    await attendre();
    await expect(
      t.prisma.notification.count({
        where: { userId: assistanteId, type: 'LIVRAISON_ECARTS', lien: `/commandes/${cmd.id}` },
      }),
    ).resolves.toBeGreaterThan(0);
  });

  it('gaps only, nothing received: 201, stock and order status unchanged; empty → 422', async () => {
    const cmd = await commandeEnvoyee();
    const avant = await stockDe();
    const res = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({
        lignes: [],
        ecarts: [{ type: 'MANQUANT', ligneId: cmd.ligneId, libelle: 'Rien livré', quantite: 10 }],
      })
      .expect(201);
    expect(res.body.statutLivraison).toBe('ENVOYEE');
    expect(await stockDe()).toBeCloseTo(avant, 3);

    const vide = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({ lignes: [] })
      .expect(422);
    expect(vide.body.code).toBe('RECEPTION_VIDE');
  });

  it('chef adds the delivery note photo; admin accepts → chef notified; second decision → 409 / 422', async () => {
    const cmd = await commandeEnvoyee();
    const res = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({
        lignes: [{ ligneId: cmd.ligneId, quantite: 9 }],
        ecarts: [{ type: 'ABIME', ligneId: cmd.ligneId, libelle: '1 sac déchiré', quantite: 1 }],
      })
      .expect(201);
    const id = res.body.receptionId;

    const photo = await request(http)
      .post(`/api/v1/receptions/${id}/fichiers`)
      .set(auth(chef))
      .attach('fichier', JPEG, 'bl.jpg')
      .field('latitude', '45.75')
      .field('longitude', '4.85')
      .expect(201);
    expect(photo.body.id).toEqual(expect.any(Number));

    // the technico (sales) does not validate deliveries
    await request(http).post(`/api/v1/receptions/${id}/valider`).set(auth(technico)).expect(403);
    await request(http).get('/api/v1/receptions').set(auth(technico)).expect(403);

    const queue = await request(http)
      .get('/api/v1/receptions?statutControle=A_VERIFIER&limit=100')
      .set(auth(admin))
      .expect(200);
    expect(queue.body.data.map((r: { id: number }) => r.id)).toContain(id);

    const ok = await request(http)
      .post(`/api/v1/receptions/${id}/valider`)
      .set(auth(admin))
      .expect(200);
    expect(ok.body).toMatchObject({
      statutControle: 'ACCEPTEE',
      controlePar: { id: expect.any(Number) },
    });
    expect(ok.body.fichiers).toHaveLength(1);

    await attendre();
    await expect(
      t.prisma.notification.count({ where: { userId: chefId, type: 'LIVRAISON_CONTROLEE' } }),
    ).resolves.toBeGreaterThan(0);

    const again = await request(http)
      .post(`/api/v1/receptions/${id}/refuser`)
      .set(auth(assistante))
      .send({ motif: 'trop tard' })
      .expect(422);
    expect(again.body.code).toBe('RECEPTION_NON_A_VERIFIER');

    // no more photo once decided
    await request(http)
      .post(`/api/v1/receptions/${id}/fichiers`)
      .set(auth(chef))
      .attach('fichier', JPEG, 'bl2.jpg')
      .expect(422);
  });

  it('two office users decide the same delivery at once: one wins, the other gets 409', async () => {
    const cmd = await commandeEnvoyee();
    const res = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({ lignes: [], ecarts: [{ type: 'INCONNU', libelle: 'Article inconnu' }] })
      .expect(201);
    const id = res.body.receptionId;
    const [a, b] = await Promise.all([
      request(http).post(`/api/v1/receptions/${id}/valider`).set(auth(admin)),
      request(http)
        .post(`/api/v1/receptions/${id}/refuser`)
        .set(auth(assistante))
        .send({ motif: 'Non conforme' }),
    ]);
    const statuts = [a.status, b.status].sort();
    expect(statuts[0]).toBe(200);
    expect([409, 422]).toContain(statuts[1]);
  });

  it('refusing needs a reason (400 without)', async () => {
    const cmd = await commandeEnvoyee();
    const res = await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({ lignes: [], ecarts: [{ type: 'INCONNU', libelle: 'Article inconnu' }] })
      .expect(201);
    await request(http)
      .post(`/api/v1/receptions/${res.body.receptionId}/refuser`)
      .set(auth(admin))
      .send({ motif: '  ' })
      .expect(400);
    const ko = await request(http)
      .post(`/api/v1/receptions/${res.body.receptionId}/refuser`)
      .set(auth(admin))
      .send({ motif: 'Bon de livraison illisible' })
      .expect(200);
    expect(ko.body).toMatchObject({
      statutControle: 'REFUSEE',
      motifRefus: 'Bon de livraison illisible',
    });
  });
  // ── dépenses (factures fournisseur photographiées) ──────────────────────

  /** Multipart dépense from the phone; numbers arrive as text like in a real form. */
  const envoyerDepense = (token: string, numero: string, champs: Record<string, string> = {}) => {
    let req = request(http)
      .post('/api/v1/depenses')
      .set(auth(token))
      .attach('fichier', JPEG, 'facture.jpg')
      .field('fournisseurNom', `${tag} Point P`)
      .field('numeroFacture', numero)
      .field('dateFacture', '2026-11-17')
      .field('montantHT', '100')
      .field('montantTVA', '20')
      .field('montantTTC', '120')
      .field('notes', tag);
    for (const [k, v] of Object.entries(champs)) req = req.field(k, v);
    return req;
  };

  it('chef sends a dépense: 201 BROUILLON, office notified; he never reads the amounts', async () => {
    const res = await envoyerDepense(chef, 'FA-100', {
      chantierId: String(chantierId),
      champsDouteux: 'montantTVA,numeroFacture',
    }).expect(201);
    expect(res.body).toMatchObject({
      statut: 'BROUILLON',
      reference: expect.stringMatching(/^DEP-\d{4}-\d{4}$/),
      champsDouteux: ['montantTVA', 'numeroFacture'],
      chantier: { id: chantierId },
    });
    expect(res.body.fichiers).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toMatch(/"montant(HT|TVA|TTC)":/);

    const liste = await request(http).get('/api/v1/depenses').set(auth(chef)).expect(200);
    expect(liste.body.data.map((d: { id: number }) => d.id)).toContain(res.body.id);
    expect(JSON.stringify(liste.body)).not.toMatch(/"montant(HT|TVA|TTC)":/);

    const bureau = await request(http)
      .get(`/api/v1/depenses/${res.body.id}`)
      .set(auth(assistante))
      .expect(200);
    expect(bureau.body).toMatchObject({ montantHT: 100, montantTVA: 20, montantTTC: 120 });

    const assistanteId = (
      await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.assistante } })
    ).id;
    await attendre();
    await expect(
      t.prisma.notification.count({ where: { userId: assistanteId, type: 'DEPENSE_A_VALIDER' } }),
    ).resolves.toBeGreaterThan(0);
  });

  it('same supplier + number written differently → 409 DEPENSE_EXISTANTE', async () => {
    const first = await envoyerDepense(chef, 'fa 2026/77').expect(201);
    const twice = await envoyerDepense(technico, 'FA-2026-77').expect(409);
    expect(twice.body).toMatchObject({
      code: 'DEPENSE_EXISTANTE',
      details: { depenseId: first.body.id },
    });
  });

  it('HT + TVA ≠ TTC beyond 5 cents → 422 MONTANTS_INCOHERENTS; without photo → 422', async () => {
    const res = await request(http)
      .post('/api/v1/depenses')
      .set(auth(chef))
      .attach('fichier', JPEG, 'facture.jpg')
      .field('fournisseurNom', `${tag} Point P`)
      .field('numeroFacture', 'FA-BAD-2')
      .field('dateFacture', '2026-11-17')
      .field('montantHT', '100')
      .field('montantTVA', '20')
      .field('montantTTC', '130')
      .field('notes', tag)
      .expect(422);
    expect(res.body.code).toBe('MONTANTS_INCOHERENTS');

    const sansPhoto = await request(http)
      .post('/api/v1/depenses')
      .set(auth(chef))
      .field('fournisseurNom', `${tag} Point P`)
      .field('numeroFacture', 'FA-NOPHOTO')
      .field('dateFacture', '2026-11-17')
      .field('montantHT', '100')
      .field('montantTVA', '20')
      .field('montantTTC', '120')
      .expect(422);
    expect(sansPhoto.body.code).toBe('FICHIER_MANQUANT');
  });

  it('another chef cannot see the dépense nor its photo (404)', async () => {
    const res = await envoyerDepense(admin, 'FA-ADMIN-1').expect(201);
    await request(http).get(`/api/v1/depenses/${res.body.id}`).set(auth(chef)).expect(404);
    await request(http)
      .get(`/api/v1/fichiers/${res.body.fichiers[0].id}/contenu`)
      .set(auth(chef))
      .expect(404);
  });

  it('assistante validates → VALIDEE, author notified; then locked; refuse needs a reason; second decision 422', async () => {
    const res = await envoyerDepense(chef, 'FA-200').expect(201);
    const id = res.body.id;

    await request(http).post(`/api/v1/depenses/${id}/valider`).set(auth(technico)).expect(403);
    await request(http)
      .post(`/api/v1/depenses/${id}/refuser`)
      .set(auth(admin))
      .send({})
      .expect(400);

    const ok = await request(http)
      .post(`/api/v1/depenses/${id}/valider`)
      .set(auth(assistante))
      .expect(200);
    expect(ok.body).toMatchObject({ statut: 'VALIDEE', validePar: { id: expect.any(Number) } });
    await attendre();
    await expect(
      t.prisma.notification.count({ where: { userId: chefId, type: 'DEPENSE_DECIDEE' } }),
    ).resolves.toBeGreaterThan(0);

    const patch = await request(http)
      .patch(`/api/v1/depenses/${id}`)
      .set(auth(chef))
      .send({ numeroFacture: 'FA-201' })
      .expect(422);
    expect(patch.body.code).toBe('DEPENSE_NON_MODIFIABLE');
    await request(http).delete(`/api/v1/depenses/${id}`).set(auth(chef)).expect(422);

    const again = await request(http)
      .post(`/api/v1/depenses/${id}/refuser`)
      .set(auth(admin))
      .send({ motif: 'Doublon' })
      .expect(422);
    expect(again.body.code).toBe('DEPENSE_DEJA_DECIDEE');
  });

  it('a draft can be corrected and deleted by its author (photos removed)', async () => {
    const res = await envoyerDepense(chef, 'FA-300').expect(201);
    const fixe = await request(http)
      .patch(`/api/v1/depenses/${res.body.id}`)
      .set(auth(chef))
      .send({ montantHT: 200, montantTVA: 40, montantTTC: 240, champsDouteux: [] })
      .expect(200);
    expect(fixe.body.champsDouteux).toEqual([]);
    const fichierId = res.body.fichiers[0].id;
    await request(http).delete(`/api/v1/depenses/${res.body.id}`).set(auth(chef)).expect(204);
    await expect(t.prisma.fichier.count({ where: { id: fichierId } })).resolves.toBe(0);
  });
  // ── écran des validations de l'admin ────────────────────────────────────

  it('validation counters follow the queues; paper signatures for the admin only; chef → 403', async () => {
    const avant = await request(http)
      .get('/api/v1/validations/compteurs')
      .set(auth(admin))
      .expect(200);
    expect(avant.body).toEqual({
      signaturesPapier: expect.any(Number),
      livraisons: expect.any(Number),
      depenses: expect.any(Number),
    });

    const cmd = await commandeEnvoyee();
    await request(http)
      .post(`/api/v1/commandes-fournisseur/${cmd.id}/receptions`)
      .set(auth(chef))
      .send({ lignes: [], ecarts: [{ type: 'INCONNU', libelle: 'Compteur' }] })
      .expect(201);
    await envoyerDepense(chef, 'FA-COMPTEUR').expect(201);

    const apres = await request(http)
      .get('/api/v1/validations/compteurs')
      .set(auth(admin))
      .expect(200);
    expect(apres.body.livraisons).toBe(avant.body.livraisons + 1);
    expect(apres.body.depenses).toBe(avant.body.depenses + 1);

    const asst = await request(http)
      .get('/api/v1/validations/compteurs')
      .set(auth(assistante))
      .expect(200);
    expect(asst.body.signaturesPapier).toBeNull();

    await request(http).get('/api/v1/validations/compteurs').set(auth(chef)).expect(403);
  });
});
