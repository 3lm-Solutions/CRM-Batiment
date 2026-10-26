import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/** 1×1 transparent PNG */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('Portails — fichiers, sous-traitant, fournisseur, espace client (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let st: string;
  let fournisseur: string;
  let stUserId: number;
  let clientId: number;
  let chantierId: number;
  let autreChantierId: number;
  let tacheId: number;
  const tag = `e2e-portail-${Date.now()}`;
  const clientEmail = `${tag}@client.test`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (path: string) => `/api/v1${path}`;

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    [admin, st, fournisseur] = await Promise.all([t.tokenFor(SEED.admin), t.tokenFor(SEED.sousTraitant), t.tokenFor(SEED.fournisseur)]);
    stUserId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.sousTraitant } })).id;
    clientId = (await request(http).post(api('/clients')).set(auth(admin)).send({ nom: `${tag} Client`, email: clientEmail }).expect(201)).body.id;
    chantierId = (await request(http).post(api('/chantiers')).set(auth(admin)).send({ clientId, adresse: '1 rue du Portail' }).expect(201)).body.id;
    autreChantierId = (await request(http).post(api('/chantiers')).set(auth(admin)).send({ clientId, adresse: '2 rue Privée' }).expect(201)).body.id;
  });

  afterAll(async () => {
    const chantiers = [chantierId, autreChantierId].filter(Boolean);
    await t.prisma.fichier.deleteMany({ where: { OR: [{ chantierId: { in: chantiers } }, { rapport: { chantierId: { in: chantiers } } }, { nom: { startsWith: tag } }] } });
    await t.prisma.rapportChantier.deleteMany({ where: { chantierId: { in: chantiers } } });
    await t.prisma.savTicket.deleteMany({ where: { clientId } }); // notes cascade
    await t.prisma.commandeFournisseur.deleteMany({ where: { reference: { startsWith: tag } } });
    await t.prisma.devis.deleteMany({ where: { clientId } });
    await t.prisma.chantier.deleteMany({ where: { id: { in: chantiers } } });
    await t.prisma.clientEspaceLien.deleteMany({ where: { clientId } });
    await t.prisma.client.deleteMany({ where: { id: clientId } });
    await t.close();
  });

  describe('fichiers', () => {
    let fichierId: number;

    it('accepts a real image and refuses a renamed file (type read from the bytes)', async () => {
      const ok = await request(http)
        .post(api('/fichiers'))
        .set(auth(admin))
        .field('chantierId', String(chantierId))
        .attach('file', PNG, { filename: `${tag}-plan.png`, contentType: 'image/png' })
        .expect(201);
      expect(ok.body).toMatchObject({ mime: 'image/png', taille: PNG.length });
      expect(ok.body.cle).toBeUndefined(); // storage path never leaves the server
      fichierId = ok.body.id;

      const bad = await request(http)
        .post(api('/fichiers'))
        .set(auth(admin))
        .attach('file', Buffer.from('<script>alert(1)</script> padding padding'), { filename: `${tag}.png`, contentType: 'image/png' })
        .expect(422);
      expect(bad.body.code).toBe('FICHIER_TYPE_REFUSE');
    });

    it('serves bytes only to people who may see the job site', async () => {
      // Sous-traitant without access to this job site, and a supplier: 404 (existence not revealed)
      await request(http).get(api(`/fichiers/${fichierId}/contenu`)).set(auth(st)).expect(404);
      await request(http).get(api(`/fichiers/${fichierId}/contenu`)).set(auth(fournisseur)).expect(404);

      await request(http).put(api(`/chantiers/${chantierId}/acces-sous-traitants`)).set(auth(admin)).send({ userIds: [stUserId] }).expect(200);
      const res = await request(http).get(api(`/fichiers/${fichierId}/contenu`)).set(auth(st)).expect(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('a chantier document can reference an uploaded file', async () => {
      const f = await request(http).post(api('/fichiers')).set(auth(admin)).attach('file', PNG, { filename: `${tag}-pv.png`, contentType: 'image/png' }).expect(201);
      const doc = await request(http).post(api(`/chantiers/${chantierId}/documents`)).set(auth(admin)).send({ nom: 'PV', type: 'PV', fichierId: f.body.id }).expect(201);
      expect(doc.body).toMatchObject({ fichierId: f.body.id, url: null });
      // neither or both sources: refused
      await request(http).post(api(`/chantiers/${chantierId}/documents`)).set(auth(admin)).send({ nom: 'X', type: 'X' }).expect(422);
    });
  });

  describe('portail sous-traitant', () => {
    it('sees only the job sites opened to him, without any price', async () => {
      const tache = await request(http)
        .post(api(`/chantiers/${chantierId}/taches`))
        .set(auth(admin))
        .send({ libelle: 'Pose carrelage', assigneeIds: [stUserId] })
        .expect(201);
      tacheId = tache.body.id;

      const list = await request(http).get(api('/portail/sous-traitant/chantiers')).set(auth(st)).expect(200);
      const ids = (list.body as { id: number }[]).map((c) => c.id);
      expect(ids).toContain(chantierId);
      expect(ids).not.toContain(autreChantierId);

      const detail = await request(http).get(api(`/portail/sous-traitant/chantiers/${chantierId}`)).set(auth(st)).expect(200);
      expect(detail.body.devis).toBeUndefined();
      expect(detail.body.notes).toBeUndefined();
      expect(detail.body.taches.find((x: { id: number }) => x.id === tacheId).affecteeAMoi).toBe(true);

      await request(http).get(api(`/portail/sous-traitant/chantiers/${autreChantierId}`)).set(auth(st)).expect(404);
      // staff routes stay closed
      await request(http).get(api('/devis')).set(auth(st)).expect(403);
    });

    it('updates progress of his task; status follows', async () => {
      const res = await request(http).patch(api(`/portail/sous-traitant/taches/${tacheId}`)).set(auth(st)).send({ avancement: 40 }).expect(200);
      const t1 = res.body.taches.find((x: { id: number }) => x.id === tacheId);
      expect(t1).toMatchObject({ avancement: 40, statut: 'EN_COURS' });
    });

    it('report with photo → validated by the office → progress applied once', async () => {
      const created = await request(http)
        .post(api('/portail/sous-traitant/rapports'))
        .set(auth(st))
        .field('chantierId', String(chantierId))
        .field('tacheId', String(tacheId))
        .field('contenu', 'Carrelage posé aux trois quarts')
        .field('avancement', '75')
        .attach('photos', PNG, { filename: 'photo.png', contentType: 'image/png' })
        .expect(201);
      expect(created.body).toMatchObject({ statut: 'SOUMIS', avancement: 75 });
      expect(created.body.photos).toHaveLength(1);

      const list = await request(http).get(api(`/chantiers/${chantierId}/rapports`)).set(auth(admin)).expect(200);
      expect(list.body.map((r: { id: number }) => r.id)).toContain(created.body.id);

      await request(http).post(api(`/rapports/${created.body.id}/valider`)).set(auth(admin)).send({}).expect(200);
      const tache = await t.prisma.tache.findUniqueOrThrow({ where: { id: tacheId } });
      expect(tache.avancement).toBe(75);

      const again = await request(http).post(api(`/rapports/${created.body.id}/valider`)).set(auth(admin)).send({}).expect(422);
      expect(again.body.code).toBe('RAPPORT_DEJA_TRAITE');
    });

    it('cannot report on a job site that is not his, nor reject without a comment', async () => {
      await request(http)
        .post(api('/portail/sous-traitant/rapports'))
        .set(auth(st))
        .field('chantierId', String(autreChantierId))
        .field('contenu', 'Intrusion')
        .expect(404);

      const r = await request(http).post(api('/portail/sous-traitant/rapports')).set(auth(st)).field('chantierId', String(chantierId)).field('contenu', 'Point du jour').expect(201);
      const refused = await request(http).post(api(`/rapports/${r.body.id}/rejeter`)).set(auth(admin)).send({}).expect(422);
      expect(refused.body.code).toBe('COMMENTAIRE_REQUIS');
    });

    it('validating an old report never lowers progress (the task moved on since)', async () => {
      const r = await request(http)
        .post(api('/portail/sous-traitant/rapports'))
        .set(auth(st))
        .field('chantierId', String(chantierId))
        .field('tacheId', String(tacheId))
        .field('contenu', 'Point du matin')
        .field('avancement', '80')
        .expect(201);
      await request(http).patch(api(`/portail/sous-traitant/taches/${tacheId}`)).set(auth(st)).send({ avancement: 95 }).expect(200);
      await request(http).post(api(`/rapports/${r.body.id}/valider`)).set(auth(admin)).send({}).expect(200);
      expect((await t.prisma.tache.findUniqueOrThrow({ where: { id: tacheId } })).avancement).toBe(95);
    });

    it('cannot use the staff job site routes (client phone, internal notes)', async () => {
      await request(http).get(api('/chantiers')).set(auth(st)).expect(403);
      await request(http).get(api(`/chantiers/${chantierId}`)).set(auth(st)).expect(403);
    });
  });

  describe('portail fournisseur', () => {
    let commandeId: number;

    beforeAll(async () => {
      const f = await t.prisma.fournisseur.findFirstOrThrow({ where: { utilisateur: { email: SEED.fournisseur } } });
      const devis = await request(http).post(api('/devis')).set(auth(admin)).send({ clientId }).expect(201);
      commandeId = (
        await t.prisma.commandeFournisseur.create({
          data: {
            companyId: f.companyId,
            devisId: devis.body.id,
            fournisseurId: f.id,
            reference: `${tag}-CMD`,
            lignes: { create: [{ materiauNom: 'Carrelage 60x60', quantite: 12, unite: 'M2', prixUnitaire: 25, totalHT: 300 }] },
          },
        })
      ).id;
    });

    it('does not see an order before it is sent', async () => {
      await request(http).get(api(`/portail/fournisseur/commandes/${commandeId}`)).set(auth(fournisseur)).expect(404);
      await t.prisma.commandeFournisseur.update({ where: { id: commandeId }, data: { statutLivraison: 'ENVOYEE', dateEnvoi: new Date() } });
      const res = await request(http).get(api(`/portail/fournisseur/commandes/${commandeId}`)).set(auth(fournisseur)).expect(200);
      expect(res.body.totalHT).toBe(300);
      expect(res.body.devis).toBeUndefined(); // no client quote data
    });

    it('acknowledges, then ships (state machine applies)', async () => {
      const ack = await request(http)
        .post(api(`/portail/fournisseur/commandes/${commandeId}/accuser-reception`))
        .set(auth(fournisseur))
        .send({ dateLivraisonPrevue: new Date(Date.now() + 5 * 86_400_000).toISOString(), commentaire: 'Livraison le matin' })
        .expect(200);
      expect(ack.body.dateAccuseReception).toBeTruthy();

      const shipped = await request(http).post(api(`/portail/fournisseur/commandes/${commandeId}/expediee`)).set(auth(fournisseur)).send({}).expect(200);
      expect(shipped.body.statutLivraison).toBe('EXPEDIEE');
      await request(http).post(api(`/portail/fournisseur/commandes/${commandeId}/expediee`)).set(auth(fournisseur)).send({}).expect(422);
    });

    it('a sous-traitant cannot use the supplier portal', async () => {
      await request(http).get(api('/portail/fournisseur/commandes')).set(auth(st)).expect(403);
    });
  });

  describe('espace client (lien, sans compte)', () => {
    const tokenFromMail = () => {
      const mail = t.mail.lastTo(clientEmail);
      const m = mail?.text.match(/espace-client\/([\w-]+)/);
      if (!m) throw new Error('lien non trouvé dans l’email');
      return m[1];
    };

    it('the office emails a link; the client sees his data and opens a SAV ticket', async () => {
      const sent = await request(http).post(api(`/clients/${clientId}/espace/lien`)).set(auth(admin)).expect(201);
      expect(sent.body.emailSent).toBe(true);
      const token = tokenFromMail();

      const view = await request(http).get(api(`/public/espace-client/${token}`)).expect(200);
      expect(view.body.client.nom).toBe(`${tag} Client`);
      expect(view.body.chantiers.map((c: { id: number }) => c.id)).toContain(chantierId);
      // drafts never visible
      expect(view.body.devis.every((d: { statut: string }) => d.statut !== 'BROUILLON')).toBe(true);

      const sav = await request(http).post(api(`/public/espace-client/${token}/sav`)).send({ titre: 'Fuite', description: 'Le joint fuit', chantierId }).expect(201);
      const ticket = await t.prisma.savTicket.findFirstOrThrow({ where: { reference: sav.body.reference } });
      expect(ticket).toMatchObject({ origine: 'ESPACE_CLIENT', createurId: null, clientId });

      // a job site of another client is refused
      await request(http).post(api(`/public/espace-client/${token}/sav`)).send({ titre: 'X', description: 'Y', chantierId: 999_999 }).expect(422);
    });

    it('a new link revokes the previous one; revocation closes access', async () => {
      await request(http).post(api(`/clients/${clientId}/espace/lien`)).set(auth(admin)).expect(201);
      const first = tokenFromMail();
      await request(http).post(api(`/clients/${clientId}/espace/lien`)).set(auth(admin)).expect(201);
      const second = tokenFromMail();
      await request(http).get(api(`/public/espace-client/${first}`)).expect(410);
      await request(http).get(api(`/public/espace-client/${second}`)).expect(200);

      await request(http).delete(api(`/clients/${clientId}/espace/liens`)).set(auth(admin)).expect(200);
      await request(http).get(api(`/public/espace-client/${second}`)).expect(410);
      await request(http).get(api('/public/espace-client/nimportequoi')).expect(410);
    });
  });
});
