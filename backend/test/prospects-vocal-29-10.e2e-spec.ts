import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { LlmError } from '../src/modules/ia/assistant/llm/llm.client';
import {
  TRANSCRIPTION_CLIENT,
  type TranscriptionClient,
} from '../src/modules/ia/assistant/llm/transcription.client';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/** First bytes of a WebM recording (EBML header), padded: what Chrome / Edge / Firefox send. */
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(60)]);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Fake Whisper: no network, no cost. */
class FakeTranscription implements TranscriptionClient {
  readonly model = 'fake-whisper';
  next: string | Error = '';
  lastMime = '';
  transcrire(_audio: Buffer, _name: string, mime: string): Promise<string> {
    this.lastMime = mime;
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}

/** 29/10 — « Prospects » = qualified only; category chosen when qualifying; devis vocal (Whisper). */
describe('Prospects qualifiés + devis vocal — 29/10 (e2e)', () => {
  const tag = `e2e-pv29-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;
  const fake = new FakeTranscription();
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  let chef: string;
  let companyId: number;

  const prospect = (nom: string, email: string) =>
    t.prisma.chatSession.create({
      data: {
        companyId,
        tokenHash: randomBytes(32).toString('hex'),
        statut: 'A_QUALIFIER',
        source: 'EMAIL',
        clientNom: nom,
        clientPrenom: 'Paul',
        clientEmail: email,
        description: `Rénovation de bureaux ${tag}`,
      },
    });

  beforeAll(async () => {
    t = await createTestApp([], [{ provide: TRANSCRIPTION_CLIENT, useValue: fake }]);
    http = t.http;
    [admin, technico, chef] = await Promise.all([
      t.tokenFor(SEED.admin),
      t.tokenFor(SEED.technico),
      t.tokenFor(SEED.chef),
    ]);
    companyId = (await t.prisma.company.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    const sessions = await t.prisma.chatSession.findMany({
      where: { description: { contains: tag } },
      select: { id: true, demandeDevisId: true },
    });
    await t.prisma.chatSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
    await t.prisma.demandeDevis.deleteMany({
      where: { id: { in: sessions.map((s) => s.demandeDevisId).filter((x): x is number => !!x) } },
    });
    const ids = (
      await t.prisma.client.findMany({
        where: { OR: [{ nom: { startsWith: tag } }, { email: { startsWith: tag } }] },
        select: { id: true },
      })
    ).map((c) => c.id);
    await t.prisma.devis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.client.deleteMany({ where: { id: { in: ids } } });
    await t.close();
  });

  it('a contact entered by hand is a qualified prospect (shown in « Prospects »)', async () => {
    const c = await request(http)
      .post(api('/clients'))
      .set(auth(admin))
      .send({ nom: `${tag} Main` })
      .expect(201);
    expect(c.body.statut).toBe('QUALIFIE');
    const list = await request(http)
      .get(api(`/clients?statuts=PROSPECT,QUALIFIE&search=${encodeURIComponent(tag)}`))
      .set(auth(admin))
      .expect(200);
    expect(list.body.data.map((x: { id: number }) => x.id)).toContain(c.body.id);
  });

  it('qualifying an email request as a company: company name, SIRET, the writer as contact', async () => {
    const p = await prospect('Durand', `${tag}-pro@x.test`);
    const sans = await request(http)
      .post(api(`/assistant/prospects/${p.id}/qualifier`))
      .set(auth(technico))
      .send({ typeClient: 'PROFESSIONNEL' })
      .expect(422);
    expect(sans.body.code).toBe('RAISON_SOCIALE_REQUISE');
    await request(http)
      .post(api(`/assistant/prospects/${p.id}/qualifier`))
      .set(auth(technico))
      .send({ typeClient: 'PROFESSIONNEL', raisonSociale: `${tag} SARL`, siret: '123' })
      .expect(400);

    const q = await request(http)
      .post(api(`/assistant/prospects/${p.id}/qualifier`))
      .set(auth(technico))
      .send({
        typeClient: 'PROFESSIONNEL',
        raisonSociale: `${tag} Bâti SARL`,
        siret: '732 829 320 00074',
        contactFonction: 'Gérant',
      })
      .expect(200);
    const demande = await t.prisma.demandeDevis.findUniqueOrThrow({
      where: { id: q.body.demande.id },
      include: { client: true },
    });
    expect(demande.source).toBe('EMAIL');
    expect(demande.client).toMatchObject({
      statut: 'QUALIFIE',
      typeClient: 'PROFESSIONNEL',
      nom: `${tag} Bâti SARL`,
      prenom: null,
      siret: '73282932000074',
      contactNom: 'Paul Durand',
      contactFonction: 'Gérant',
      email: `${tag}-pro@x.test`,
    });
  });

  it('qualifying without a category keeps a private person', async () => {
    const p = await prospect(`${tag} Petit`, `${tag}-part@x.test`);
    const q = await request(http)
      .post(api(`/assistant/prospects/${p.id}/qualifier`))
      .set(auth(technico))
      .send({})
      .expect(200);
    const demande = await t.prisma.demandeDevis.findUniqueOrThrow({
      where: { id: q.body.demande.id },
      include: { client: true },
    });
    expect(demande.client).toMatchObject({
      statut: 'QUALIFIE',
      typeClient: 'PARTICULIER',
      prenom: 'Paul',
      siret: null,
      contactNom: null,
    });
  });

  it('devis vocal: recording → text; wrong file, silence and AI errors are explained; the chef is refused', async () => {
    const client = await request(http)
      .post(api('/clients'))
      .set(auth(technico))
      .send({ nom: `${tag} Vocal` })
      .expect(201);
    const devis = await request(http)
      .post(api('/devis'))
      .set(auth(technico))
      .send({ clientId: client.body.id })
      .expect(201);
    const url = api(`/devis/${devis.body.id}/ia/transcrire`);

    fake.next = 'Rénovation salle de bain de 8 m², douche à l’italienne.';
    const ok = await request(http)
      .post(url)
      .set(auth(technico))
      .attach('audio', WEBM, { filename: 'dictee.webm', contentType: 'audio/webm' })
      .expect(200);
    expect(ok.body.texte).toBe('Rénovation salle de bain de 8 m², douche à l’italienne.');
    expect(fake.lastMime).toBe('audio/webm');

    // an image renamed .webm is refused (first bytes checked, not the name)
    const img = await request(http)
      .post(url)
      .set(auth(technico))
      .attach('audio', PNG, { filename: 'x.webm', contentType: 'audio/webm' })
      .expect(422);
    expect(img.body.code).toBe('FICHIER_TYPE_REFUSE');
    await request(http).post(url).set(auth(technico)).expect(422);

    fake.next = '';
    expect(
      (
        await request(http)
          .post(url)
          .set(auth(technico))
          .attach('audio', WEBM, 'a.webm')
          .expect(422)
      ).body.code,
    ).toBe('AUCUNE_PAROLE');
    fake.next = new LlmError('QUOTA', 'limite');
    expect(
      (
        await request(http)
          .post(url)
          .set(auth(technico))
          .attach('audio', WEBM, 'a.webm')
          .expect(422)
      ).body.code,
    ).toBe('TRANSCRIPTION_INDISPONIBLE');

    await request(http).post(url).set(auth(chef)).attach('audio', WEBM, 'a.webm').expect(403);
    await t.prisma.assistantErreur.deleteMany({
      where: { type: { startsWith: 'DEVIS_VOCAL' }, detail: { contains: devis.body.reference } },
    });
  });
});

describe('Devis vocal sans clé IA (e2e)', () => {
  const tag = `e2e-pv29b-${Date.now()}`;
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    const ids = (
      await t.prisma.client.findMany({ where: { nom: { startsWith: tag } }, select: { id: true } })
    ).map((c) => c.id);
    await t.prisma.devis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.client.deleteMany({ where: { id: { in: ids } } });
    await t.close();
  });

  it('says the transcription is not configured', async () => {
    const technico = await t.tokenFor(SEED.technico);
    const auth = { Authorization: `Bearer ${technico}` };
    const client = await request(t.http)
      .post('/api/v1/clients')
      .set(auth)
      .send({ nom: `${tag} X` })
      .expect(201);
    const devis = await request(t.http)
      .post('/api/v1/devis')
      .set(auth)
      .send({ clientId: client.body.id })
      .expect(201);
    const res = await request(t.http)
      .post(`/api/v1/devis/${devis.body.id}/ia/transcrire`)
      .set(auth)
      .attach('audio', WEBM, 'a.webm')
      .expect(422);
    expect(res.body.code).toBe('IA_NON_CONFIGUREE');
  });
});
