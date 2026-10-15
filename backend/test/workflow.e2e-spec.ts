import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Steps 7–8 through real HTTP: devis signé → chantier + acompte + commandes,
 * invoices (deduction, numbering, credit note), receptions → stock.
 * Requires a migrated database seeded with the catalogue.
 */
describe('Workflow, chantiers, factures, commandes, stock (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let clientId: number;
  let chapeId: number;
  let chapeFibreeId: number;
  const tag = `e2e-wf-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const stockBefore = new Map<number, string>();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function sentDevis() {
    const devis = await request(http).post('/api/v1/devis').set(auth(technico)).send({ clientId }).expect(201);
    await request(http)
      .post(`/api/v1/devis/${devis.body.id}/lignes`)
      .set(auth(technico))
      .send({ prestationId: chapeId, choixIds: [chapeFibreeId], quantite: 20 })
      .expect(201);
    await request(http).post(`/api/v1/devis/${devis.body.id}/envoyer`).set(auth(technico)).expect(200);
    return devis.body.id as number;
  }
  const signVerbal = (id: number) =>
    request(http).post(`/api/v1/devis/${id}/signer-conseiller`).set(auth(technico)).send({ verbal: true });

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    admin = await t.tokenFor(SEED.admin);
    technico = await t.tokenFor(SEED.technico);
    await request(http).put('/api/v1/auth/me/signature').set(auth(technico)).send({ signatureBase64: PNG });

    clientId = (
      await request(http)
        .post('/api/v1/clients')
        .set(auth(technico))
        .send({ nom: `${tag} Moreau`, email: clientEmail, adresseChantier: '3 rue du Test, Lyon' })
    ).body.id;

    const list = await request(http).get(`/api/v1/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`).set(auth(technico));
    chapeId = list.body.data[0].id;
    const detail = await request(http).get(`/api/v1/catalogue/prestations/${chapeId}`).set(auth(technico));
    chapeFibreeId = detail.body.options
      .find((o: { nom: string }) => o.nom === 'Type de chape')
      .choix.find((c: { nom: string }) => c.nom === 'Chape fibrée').id;

    for (const m of await t.prisma.materiau.findMany({ select: { id: true, stockActuel: true } })) {
      stockBefore.set(m.id, m.stockActuel.toString());
    }
  });

  afterAll(async () => {
    const devisWhere = { devis: { clientId } };
    await t.prisma.facture.deleteMany({ where: { ...devisWhere, typeFacture: 'AVOIR' } });
    await t.prisma.facture.deleteMany({ where: devisWhere });
    await t.prisma.reception.deleteMany({ where: { commandeFournisseur: devisWhere } });
    await t.prisma.commandeFournisseur.deleteMany({ where: devisWhere });
    await t.prisma.mouvementStock.deleteMany({ where: { motif: { contains: tag } } });
    const chantiers = await t.prisma.chantier.findMany({ where: { clientId }, select: { id: true } });
    await t.prisma.mouvementStock.deleteMany({ where: { chantierId: { in: chantiers.map((c) => c.id) } } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    for (const [id, stock] of stockBefore) {
      await t.prisma.materiau.update({ where: { id }, data: { stockActuel: stock } });
    }
    await t.prisma.user.update({ where: { email: SEED.technico }, data: { signatureBase64: null } });
    await t.close();
  });

  it('P0.4: client acceptance creates the supplier orders (grouped by supplier, linked to materials)', async () => {
    const id = await sentDevis();
    const token = /\/devis\/lien\/([A-Za-z0-9_-]+)/.exec(t.mail.lastTo(clientEmail)!.text)![1];
    await request(http).post(`/api/v1/public/devis/${token}/accepter`).expect(200);

    const commandes = await request(http).get(`/api/v1/commandes-fournisseur?devisId=${id}`).set(auth(technico)).expect(200);
    expect(commandes.body.meta.total).toBeGreaterThanOrEqual(1);
    const detail = await request(http).get(`/api/v1/commandes-fournisseur/${commandes.body.data[0].id}`).set(auth(technico));
    expect(detail.body.statutLivraison).toBe('CREEE');
    expect(detail.body.lignes.every((l: { materiauId: number | null }) => l.materiauId)).toBe(true);
    expect(detail.body.lignes.some((l: { materiauNom: string }) => l.materiauNom.includes('Fibres'))).toBe(true);
  });

  describe('signature → chantier + 35 % deposit (P0.2, P0.3)', () => {
    let devisId: number;
    let devisHT: number;

    it('creates the job site, the deposit draft and the orders, in one go', async () => {
      devisId = await sentDevis();
      const signed = await signVerbal(devisId).expect(200);
      devisHT = signed.body.devis.totalHT;
      expect(signed.body.devis.chantier).toMatchObject({ statut: 'PLANIFIE' });

      const factures = await request(http).get(`/api/v1/factures?devisId=${devisId}`).set(auth(admin)).expect(200);
      expect(factures.body.data).toHaveLength(1);
      expect(factures.body.data[0]).toMatchObject({ typeFacture: 'ACOMPTE', statut: 'BROUILLON', reference: null });
      expect(factures.body.data[0].montantHT).toBeCloseTo(devisHT * 0.35, 2);

      const commandes = await request(http).get(`/api/v1/commandes-fournisseur?devisId=${devisId}`).set(auth(admin));
      expect(commandes.body.meta.total).toBeGreaterThanOrEqual(1); // verbal: orders created at signature
    });

    it('two simultaneous signatures: one wins, nothing is created twice', async () => {
      const id = await sentDevis();
      const results = await Promise.all([signVerbal(id), signVerbal(id)]);
      const [winner, loser] = results.map((r) => r.status).sort();
      expect(winner).toBe(200);
      expect([409, 422]).toContain(loser); // conditional update lost, or quote already SIGNE

      expect(await t.prisma.chantier.count({ where: { devis: { some: { id } } } })).toBe(1);
      expect(await t.prisma.facture.count({ where: { devisId: id, typeFacture: 'ACOMPTE' } })).toBe(1);
    });

    it('invoices: final deducts the deposit, drafts consume no number, credit note cancels', async () => {
      const [acompte] = (await request(http).get(`/api/v1/factures?devisId=${devisId}`).set(auth(admin))).body.data;

      // final refused while the deposit is still a draft
      const blocked = await request(http).post(`/api/v1/devis/${devisId}/factures/finale`).set(auth(admin)).expect(422);
      expect(blocked.body.code).toBe('FACTURE_EN_BROUILLON');

      const emitted = await request(http).post(`/api/v1/factures/${acompte.id}/emettre`).set(auth(admin)).send({}).expect(200);
      const acompteNumber = Number(emitted.body.facture.reference.split('-').at(-1));
      expect(emitted.body.emailSent).toBe(true);

      // an issued invoice is frozen
      await request(http).patch(`/api/v1/factures/${acompte.id}`).set(auth(admin)).send({ notesLegales: 'x' }).expect(422);

      // a progress-invoice draft, cancelled: it must not consume a number
      const situation = await request(http)
        .post(`/api/v1/devis/${devisId}/factures/situation`)
        .set(auth(admin))
        .send({ avancementCumule: 40 })
        .expect(201);
      await request(http).post(`/api/v1/factures/${situation.body.id}/annuler`).set(auth(admin)).send({}).expect(200);

      const finale = await request(http).post(`/api/v1/devis/${devisId}/factures/finale`).set(auth(admin)).expect(201);
      expect(finale.body.montantHT).toBeCloseTo(devisHT - acompte.montantHT, 2); // NOT 135 %
      expect(finale.body.lignes.some((l: { montantHT: number }) => l.montantHT < 0)).toBe(true);

      const finaleEmitted = await request(http).post(`/api/v1/factures/${finale.body.id}/emettre`).set(auth(admin)).send({ envoyerEmail: false });
      expect(Number(finaleEmitted.body.facture.reference.split('-').at(-1))).toBe(acompteNumber + 1);

      const cancelled = await request(http).post(`/api/v1/factures/${finale.body.id}/annuler`).set(auth(admin)).send({ motif: 'erreur' }).expect(200);
      expect(cancelled.body.facture.statut).toBe('ANNULEE');
      expect(cancelled.body.avoir).toMatchObject({ typeFacture: 'AVOIR', statut: 'ENVOYEE' });
      expect(cancelled.body.avoir.montantTTC).toBeCloseTo(-finale.body.montantTTC, 2);
    });

    it('job site lifecycle and task progress', async () => {
      const devis = await request(http).get(`/api/v1/devis/${devisId}`).set(auth(admin));
      const chantierId = devis.body.chantier.id;

      await request(http).post(`/api/v1/chantiers/${chantierId}/cloturer`).set(auth(admin)).expect(422); // not started
      await request(http).post(`/api/v1/chantiers/${chantierId}/demarrer`).set(auth(admin)).expect(200);

      const tache = await request(http).post(`/api/v1/chantiers/${chantierId}/taches`).set(auth(admin)).send({ libelle: 'Chape' }).expect(201);
      const done = await request(http)
        .patch(`/api/v1/chantiers/${chantierId}/taches/${tache.body.id}`)
        .set(auth(admin))
        .send({ avancement: 100 })
        .expect(200);
      expect(done.body.statut).toBe('TERMINEE');

      const chantier = await request(http).get(`/api/v1/chantiers/${chantierId}`).set(auth(admin));
      expect(chantier.body.avancement).toBe(100);
      await request(http).delete(`/api/v1/chantiers/${chantierId}`).set(auth(admin)).expect(422); // comes from a quote
    });

    it('supplier order: send, partial then full reception, stock updated', async () => {
      const list = await request(http).get(`/api/v1/commandes-fournisseur?devisId=${devisId}`).set(auth(admin));
      const commandeId = list.body.data[0].id;

      const sent = await request(http).post(`/api/v1/commandes-fournisseur/${commandeId}/envoyer`).set(auth(admin)).expect(200);
      expect(sent.body.commande.statutLivraison).toBe('ENVOYEE');

      const [ligne, ...others] = sent.body.commande.lignes;
      const before = (await t.prisma.materiau.findUniqueOrThrow({ where: { id: ligne.materiauId } })).stockActuel.toNumber();

      const partial = await request(http)
        .post(`/api/v1/commandes-fournisseur/${commandeId}/receptions`)
        .set(auth(admin))
        .send({ lignes: [{ ligneId: ligne.id, quantite: 1 }] })
        .expect(201);
      expect(partial.body.statutLivraison).toBe(others.length || ligne.quantite > 1 ? 'PARTIELLE' : 'RECUE');
      const after = (await t.prisma.materiau.findUniqueOrThrow({ where: { id: ligne.materiauId } })).stockActuel.toNumber();
      expect(after).toBeCloseTo(before + 1, 3);

      // over-delivery refused
      await request(http)
        .post(`/api/v1/commandes-fournisseur/${commandeId}/receptions`)
        .set(auth(admin))
        .send({ lignes: [{ ligneId: ligne.id, quantite: ligne.quantite + 100 }] })
        .expect(422);

      const rest = sent.body.commande.lignes
        .map((l: { id: number; quantite: number }) => ({ ligneId: l.id, quantite: l.id === ligne.id ? l.quantite - 1 : l.quantite }))
        .filter((l: { quantite: number }) => l.quantite > 0);
      const full = await request(http).post(`/api/v1/commandes-fournisseur/${commandeId}/receptions`).set(auth(admin)).send({ lignes: rest }).expect(201);
      expect(full.body.statutLivraison).toBe('RECUE');
    });
  });

  describe('stock', () => {
    let materiauId: number;

    beforeAll(async () => {
      materiauId = (await t.prisma.materiau.findFirstOrThrow({ where: { actif: true } })).id;
      await request(http).post('/api/v1/stock/mouvements').set(auth(admin)).send({ materiauId, type: 'AJUSTEMENT', quantite: 5, motif: tag });
    });

    it('refuses an exit larger than the stock', async () => {
      const res = await request(http)
        .post('/api/v1/stock/mouvements')
        .set(auth(admin))
        .send({ materiauId, type: 'SORTIE', quantite: 6, motif: tag })
        .expect(422);
      expect(res.body.code).toBe('STOCK_INSUFFISANT');
    });

    it('simultaneous movements are all counted (old bug: lost update)', async () => {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          request(http).post('/api/v1/stock/mouvements').set(auth(admin)).send({ materiauId, type: 'ENTREE', quantite: 1, motif: tag }).expect(201),
        ),
      );
      const m = await t.prisma.materiau.findUniqueOrThrow({ where: { id: materiauId } });
      expect(m.stockActuel.toNumber()).toBe(15);
    });
  });
});
