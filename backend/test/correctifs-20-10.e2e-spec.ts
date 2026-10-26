import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Corrections after the acceptance test of 20/10 (report: 163 OK, 15 problems).
 * Requires a migrated database seeded with `pnpm db:seed` (the demo supplier account is
 * linked to Parexlanko since this version).
 */
describe('Correctifs de la recette du 20/10 (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let fournisseur: string;
  let chefId: number;
  let clientId: number;
  let chapeId: number;
  let chapeFibreeId: number;
  const tag = `e2e-2010-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const createdUsers: number[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  async function sentDevis() {
    const devis = await request(http).post(api('/devis')).set(auth(technico)).send({ clientId }).expect(201);
    await request(http)
      .post(api(`/devis/${devis.body.id}/lignes`))
      .set(auth(technico))
      .send({ prestationId: chapeId, choixIds: [chapeFibreeId], quantite: 20 })
      .expect(201);
    await request(http).post(api(`/devis/${devis.body.id}/envoyer`)).set(auth(technico)).expect(200);
    return devis.body.id as number;
  }
  const signVerbal = (id: number) => request(http).post(api(`/devis/${id}/signer-conseiller`)).set(auth(technico)).send({ verbal: true }).expect(200);

  async function newUser(role: 'CHEF_CHANTIER' | 'SOUS_TRAITANT') {
    const res = await request(http)
      .post(api('/users'))
      .set(auth(admin))
      .send({ email: `${tag}-${role.toLowerCase()}-${createdUsers.length}@test.fr`, nom: `${tag} ${role}`, prenom: 'Test', role })
      .expect(201);
    createdUsers.push(res.body.user.id);
    return res.body.user.id as number;
  }

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, technico, chef, fournisseur] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.chef),
      t.tokenFor(SEED.fournisseur),
    ]);
    chefId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.chef } })).id;
    await request(http).put(api('/auth/me/signature')).set(auth(technico)).send({ signatureBase64: PNG });
    clientId = (await request(http).post(api('/clients')).set(auth(admin)).send({ nom: `${tag} Client`, email: clientEmail }).expect(201)).body.id;

    const list = await request(http).get(api(`/catalogue/prestations?search=${encodeURIComponent('Chape béton')}`)).set(auth(technico));
    chapeId = list.body.data[0].id;
    const detail = await request(http).get(api(`/catalogue/prestations/${chapeId}`)).set(auth(technico));
    chapeFibreeId = detail.body.options
      .find((o: { nom: string }) => o.nom === 'Type de chape')
      .choix.find((c: { nom: string }) => c.nom === 'Chape fibrée').id;
  });

  afterAll(async () => {
    const devisWhere = { devis: { clientId } };
    await t.prisma.facture.deleteMany({ where: { ...devisWhere, typeFacture: 'AVOIR' } });
    await t.prisma.facture.deleteMany({ where: devisWhere });
    await t.prisma.commandeFournisseur.deleteMany({ where: { OR: [devisWhere, { notes: { contains: tag } }] } });
    await t.prisma.savTicket.deleteMany({ where: { clientId } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { clientId } });
    await t.prisma.client.delete({ where: { id: clientId } });
    await t.prisma.materiau.deleteMany({ where: { nom: { startsWith: tag } } });
    await t.prisma.sousTraitant.deleteMany({ where: { nom: { startsWith: tag } } });
    await t.prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await t.prisma.user.update({ where: { email: SEED.technico }, data: { signatureBase64: null } });
    await t.close();
  });

  // ── 1. catalogue filter ───────────────────────────────────────────────────

  it('1. « Inactifs » really lists inactive items (query "false" was read as true)', async () => {
    await request(http).post(api('/catalogue/materiaux')).set(auth(admin)).send({ nom: `${tag} inactif`, prixAchatFixe: 1, actif: false }).expect(201);
    const search = encodeURIComponent(tag);
    const inactifs = await request(http).get(api(`/catalogue/materiaux?actif=false&search=${search}`)).set(auth(admin)).expect(200);
    expect(inactifs.body.data.map((m: { nom: string }) => m.nom)).toEqual([`${tag} inactif`]);
    const actifs = await request(http).get(api(`/catalogue/materiaux?actif=true&search=${search}`)).set(auth(admin)).expect(200);
    expect(actifs.body.data).toHaveLength(0);
    const tous = await request(http).get(api(`/catalogue/materiaux?search=${search}`)).set(auth(admin)).expect(200);
    expect(tous.body.data).toHaveLength(1);
  });

  it('D. the chef sees no amount in the catalogue nor in the stock', async () => {
    const mats = await request(http).get(api('/catalogue/materiaux?limit=5')).set(auth(chef)).expect(200);
    expect(mats.body.data.length).toBeGreaterThan(0);
    expect(mats.body.data.every((m: object) => !('prixAchatFixe' in m))).toBe(true);
    const prest = await request(http).get(api(`/catalogue/prestations/${chapeId}`)).set(auth(chef)).expect(200);
    expect(JSON.stringify(prest.body)).not.toMatch(/prixVente|prixAchatFixe|prixUnitaire|impactPrix/);
    const stock = await request(http).get(api('/stock?limit=5')).set(auth(chef)).expect(200);
    expect(stock.body.data.every((m: object) => !('valeurStock' in m) && !('prixAchatFixe' in m))).toBe(true);
    // the office still sees them
    const office = await request(http).get(api('/catalogue/materiaux?limit=5')).set(auth(admin)).expect(200);
    expect(office.body.data.every((m: object) => 'prixAchatFixe' in m)).toBe(true);
  });

  // ── 2. delete a cancelled quote ────────────────────────────────────────────

  it('2. the admin deletes a cancelled quote without invoice / order / job site, not a signed-then-linked one', async () => {
    const id = await sentDevis();
    await request(http).post(api(`/devis/${id}/annuler`)).set(auth(admin)).send({}).expect(200);
    await request(http).delete(api(`/devis/${id}`)).set(auth(technico)).expect(403);
    await request(http).delete(api(`/devis/${id}`)).set(auth(admin)).expect(204);
    await request(http).get(api(`/devis/${id}`)).set(auth(admin)).expect(404);

    const sent = await sentDevis();
    const refused = await request(http).delete(api(`/devis/${sent}`)).set(auth(admin)).expect(422);
    expect(refused.body.code).toBe('DEVIS_NON_SUPPRIMABLE');
  });

  // ── 3 / C2 / 4. chef view of invoices, progress invoice rule ───────────────

  it('C2. the chef sees the issued invoices of his job sites, never the drafts', async () => {
    const id = await sentDevis();
    await signVerbal(id);
    const devis = (await request(http).get(api(`/devis/${id}`)).set(auth(admin))).body;
    await request(http).patch(api(`/chantiers/${devis.chantier.id}`)).set(auth(admin)).send({ chefChantierId: chefId }).expect(200);

    // his quote is listed for him (signed, job site assigned)
    const mesDevis = await request(http).get(api('/devis?limit=100')).set(auth(chef)).expect(200);
    expect(mesDevis.body.data.map((d: { id: number }) => d.id)).toContain(id);

    const [acompte] = (await request(http).get(api(`/factures?devisId=${id}`)).set(auth(admin))).body.data;
    expect(acompte.statut).toBe('BROUILLON');
    const draftForChef = await request(http).get(api(`/factures?devisId=${id}`)).set(auth(chef)).expect(200);
    expect(draftForChef.body.data).toHaveLength(0);
    await request(http).get(api(`/factures/${acompte.id}`)).set(auth(chef)).expect(404);

    await request(http).post(api(`/factures/${acompte.id}/emettre`)).set(auth(admin)).send({ envoyerEmail: false }).expect(200);
    const issued = await request(http).get(api(`/factures?devisId=${id}`)).set(auth(chef)).expect(200);
    expect(issued.body.data.map((f: { id: number }) => f.id)).toEqual([acompte.id]);

    // 4. on the SAME quote, a progress invoice at 20 % after 70 % is refused
    const s70 = await request(http).post(api(`/devis/${id}/factures/situation`)).set(auth(admin)).send({ avancementCumule: 70 }).expect(201);
    await request(http).post(api(`/factures/${s70.body.id}/emettre`)).set(auth(admin)).send({ envoyerEmail: false }).expect(200);
    const s20 = await request(http).post(api(`/devis/${id}/factures/situation`)).set(auth(admin)).send({ avancementCumule: 20 }).expect(422);
    expect(s20.body.code).toBe('AVANCEMENT_INVALIDE');
    expect(s20.body.message).toContain('70');
  });

  // ── 5. chef task assignment ────────────────────────────────────────────────

  it('5. the chef assigns sous-traitants or himself, never another chef', async () => {
    const autreChef = await newUser('CHEF_CHANTIER');
    const chantier = await request(http).post(api('/chantiers')).set(auth(admin)).send({ clientId, adresse: `${tag} rue`, chefChantierId: chefId }).expect(201);
    const base = api(`/chantiers/${chantier.body.id}/taches`);

    const refused = await request(http).post(base).set(auth(chef)).send({ libelle: 'A', assigneeIds: [autreChef] }).expect(422);
    expect(refused.body.code).toBe('AFFECTATION_INTERDITE');
    await request(http).post(base).set(auth(chef)).send({ libelle: 'B', assigneeIds: [chefId] }).expect(201);

    // a task the office gave to another chef can still be edited by the chef
    const officeTask = await request(http).post(base).set(auth(admin)).send({ libelle: 'C', assigneeIds: [autreChef] }).expect(201);
    await request(http).patch(`${base}/${officeTask.body.id}`).set(auth(chef)).send({ libelle: 'C bis', assigneeIds: [autreChef, chefId] }).expect(200);
    // the office may assign any chef
    await request(http).post(base).set(auth(admin)).send({ libelle: 'D', assigneeIds: [autreChef] }).expect(201);
  });

  // ── 6 / 12 / F1. supplier account ──────────────────────────────────────────

  it('6. the demo supplier account is linked to a supplier that has materials (re-seed)', async () => {
    const profil = await request(http).get(api('/portail/fournisseur/profil')).set(auth(fournisseur)).expect(200);
    const nom = profil.body.fournisseur?.nom ?? profil.body.nom;
    expect(nom).toBe('Parexlanko');
  });

  it('F1. a supplier record can be created from an account, never one already linked', async () => {
    const userId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.fournisseur } })).id;
    const res = await request(http).post(api('/fournisseurs')).set(auth(admin)).send({ nom: `${tag} Fournisseur`, userId }).expect(422);
    expect(res.body.code).toBe('COMPTE_DEJA_LIE');
  });

  // ── 7. manual supplier order ───────────────────────────────────────────────

  it('7. manual order: only the chosen supplier’s materials, catalogue price, created « à envoyer »', async () => {
    const parex = await t.prisma.fournisseur.findFirstOrThrow({ where: { nom: 'Parexlanko' } });
    const autre = await t.prisma.fournisseur.findFirstOrThrow({ where: { nom: { not: 'Parexlanko' }, materiaux: { some: {} } } });
    const mat = await t.prisma.materiau.findFirstOrThrow({ where: { fournisseurId: parex.id, actif: true } });

    const wrong = await request(http)
      .post(api('/commandes-fournisseur'))
      .set(auth(admin))
      .send({ fournisseurId: autre.id, lignes: [{ materiauId: mat.id, quantite: 2 }], notes: tag })
      .expect(422);
    expect(wrong.body.code).toBe('MATERIAU_AUTRE_FOURNISSEUR');

    await request(http).post(api('/commandes-fournisseur')).set(auth(chef)).send({ fournisseurId: parex.id, lignes: [{ materiauId: mat.id, quantite: 2 }] }).expect(403);

    const ok = await request(http)
      .post(api('/commandes-fournisseur'))
      .set(auth(admin))
      .send({ fournisseurId: parex.id, lignes: [{ materiauId: mat.id, quantite: 2 }], notes: tag })
      .expect(201);
    expect(ok.body).toMatchObject({ statutLivraison: 'CREEE', devis: null, fournisseur: { id: parex.id } });
    expect(ok.body.lignes[0].prixUnitaire).toBeCloseTo(mat.prixAchatFixe.toNumber(), 2);
    expect(ok.body.totalHT).toBeCloseTo(mat.prixAchatFixe.toNumber() * 2, 2);

    const list = await request(http).get(api('/commandes-fournisseur?limit=100')).set(auth(admin)).expect(200);
    expect(list.body.data.find((c: { id: number }) => c.id === ok.body.id)).toMatchObject({ devis: null });
  });

  // ── 8 / 9. sous-traitant from an account, payments edit / delete ───────────

  it('8–9. a sous-traitant created from an account; its payments can be corrected and deleted', async () => {
    const userId = await newUser('SOUS_TRAITANT');
    const st = await request(http).post(api('/sous-traitants')).set(auth(admin)).send({ nom: `${tag} ST`, userId }).expect(201);
    const detail = await request(http).get(api(`/sous-traitants/${st.body.id}`)).set(auth(admin)).expect(200);
    expect(detail.body.utilisateur.id).toBe(userId);

    const twice = await request(http).post(api('/sous-traitants')).set(auth(admin)).send({ nom: `${tag} ST bis`, userId }).expect(422);
    expect(twice.body.code).toBe('COMPTE_DEJA_LIE');

    const p = await request(http)
      .post(api(`/sous-traitants/${st.body.id}/paiements`))
      .set(auth(admin))
      .send({ montantHT: 100, montantTTC: 120, datePaiement: new Date().toISOString(), modePaiement: 'VIREMENT' })
      .expect(201);
    const fixed = await request(http)
      .patch(api(`/sous-traitants/${st.body.id}/paiements/${p.body.id}`))
      .set(auth(admin))
      .send({ montantHT: 150, montantTTC: 180, modePaiement: 'CHEQUE' })
      .expect(200);
    expect(fixed.body).toMatchObject({ modePaiement: 'CHEQUE' });
    expect(Number(fixed.body.montantHT)).toBe(150);
    const bad = await request(http).patch(api(`/sous-traitants/${st.body.id}/paiements/${p.body.id}`)).set(auth(admin)).send({ montantTTC: 10 }).expect(422);
    expect(bad.body.code).toBe('MONTANTS_INCOHERENTS');

    await request(http).delete(api(`/sous-traitants/${st.body.id}/paiements/${p.body.id}`)).set(auth(chef)).expect(403);
    await request(http).delete(api(`/sous-traitants/${st.body.id}/paiements/${p.body.id}`)).set(auth(admin)).expect(204);
    const after = await request(http).get(api(`/sous-traitants/${st.body.id}`)).set(auth(admin)).expect(200);
    expect(after.body.paiements).toHaveLength(0);
  });

  // ── 10 / 11 / 15. client space preview, SAV follow-up, concurrency ─────────

  it('10–11. office preview of the client space; SAV timeline, replies to the client and emails', async () => {
    const ticket = await request(http).post(api('/sav')).set(auth(admin)).send({ clientId, titre: `${tag} fuite`, description: 'Fuite sous l’évier' }).expect(201);
    const id = ticket.body.id;
    await request(http).post(api(`/sav/${id}/prendre-en-charge`)).set(auth(admin)).expect(200);
    expect(t.mail.lastTo(clientEmail)?.subject).toContain(ticket.body.reference);

    await request(http).post(api(`/sav/${id}/notes`)).set(auth(admin)).send({ contenu: 'Note interne' }).expect(201);
    await request(http).post(api(`/sav/${id}/notes`)).set(auth(admin)).send({ contenu: 'Nous passons jeudi', visibleClient: true }).expect(201);
    expect(t.mail.lastTo(clientEmail)?.text).toContain('Nous passons jeudi');

    await request(http).get(api(`/clients/${clientId}/espace/apercu`)).set(auth(chef)).expect(403);
    const view = await request(http).get(api(`/clients/${clientId}/espace/apercu`)).set(auth(admin)).expect(200);
    expect(view.body.apercu).toBe(true);
    const sav = view.body.sav.find((s: { id: number }) => s.id === id);
    expect(sav.historique.map((h: { statut: string }) => h.statut)).toEqual(['OUVERT', 'EN_COURS']);
    expect(sav.messages.map((m: { contenu: string; auteur: string }) => [m.contenu, m.auteur])).toEqual([['Nous passons jeudi', 'EQUIPE']]);

    const staff = await request(http).get(api(`/sav/${id}`)).set(auth(admin)).expect(200);
    expect(staff.body.historique).toHaveLength(2);
  });

  it('15. two simultaneous changes of the same ticket: only one wins', async () => {
    const ticket = await request(http).post(api('/sav')).set(auth(admin)).send({ clientId, titre: `${tag} course`, description: 'x' }).expect(201);
    const id = ticket.body.id;
    await request(http).post(api(`/sav/${id}/prendre-en-charge`)).set(auth(admin)).expect(200);
    const [a, b] = await Promise.all([
      request(http).post(api(`/sav/${id}/resoudre`)).set(auth(admin)).send({}),
      request(http).post(api(`/sav/${id}/cloturer`)).set(auth(admin)).send({}),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 422]);
    const loser = a.status === 422 ? a : b;
    expect(['TICKET_MODIFIE', 'TRANSITION_SAV_INTERDITE']).toContain(loser.body.code);
  });
});
