import request from 'supertest';
import { App } from 'supertest/types';
import {
  LLM_VISION_CLIENT,
  LlmError,
  type LlmClient,
  type LlmMessage,
} from '../src/modules/ia/assistant/llm/llm.client';
import { createTestApp, SEED, TestApp } from './helpers/test-app';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

/** Fake AI that records what it was sent (photos included). No network, no cost. */
class FakeLlm implements LlmClient {
  readonly name = 'fake';
  next: unknown = null;
  last: LlmMessage[] = [];
  completeJson(messages: LlmMessage[]): Promise<unknown> {
    this.last = messages;
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}

const analyse = (qualitePhoto: string, surface: number | null = 6) => ({
  piece: 'Salle de bain',
  surfaceEstimeeM2: surface,
  objetReference: true,
  elementsVisibles: ['baignoire', 'faïence'],
  etat: 'joints noircis',
  qualitePhoto,
});

/** C37 of 21/10 — quote from 1 to 3 photos. */
describe('Devis IA depuis photo — C37 (e2e)', () => {
  const tag = `e2e-diap-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  async function setup(t: TestApp) {
    const technico = await t.tokenFor(SEED.technico);
    const client = await request(t.http)
      .post(api('/clients'))
      .set(auth(technico))
      .send({ nom: `${tag} Morel` })
      .expect(201);
    const devis = await request(t.http)
      .post(api('/devis'))
      .set(auth(technico))
      .send({ clientId: client.body.id })
      .expect(201);
    return { technico, chef: await t.tokenFor(SEED.chef), devisId: devis.body.id as number };
  }

  async function cleanup(t: TestApp) {
    const clients = await t.prisma.client.findMany({
      where: { nom: { startsWith: tag } },
      select: { id: true },
    });
    const ids = clients.map((c) => c.id);
    const refs = await t.prisma.devis.findMany({
      where: { clientId: { in: ids } },
      select: { reference: true },
    });
    for (const { reference } of refs) {
      await t.prisma.assistantErreur.deleteMany({
        where: { type: { startsWith: 'DEVIS_' }, detail: { contains: reference } },
      });
    }
    await t.prisma.devis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.client.deleteMany({ where: { id: { in: ids } } });
  }

  describe('sans modèle vision (OPENAI_VISION_MODEL vide)', () => {
    let t: TestApp;
    let ctx: Awaited<ReturnType<typeof setup>>;
    beforeAll(async () => {
      t = await createTestApp();
      ctx = await setup(t);
    });
    afterAll(async () => {
      await cleanup(t);
      await t.close();
    });

    it('says the photo analysis needs the AI (the Texte tab still works)', async () => {
      const res = await request(t.http)
        .post(api(`/devis/${ctx.devisId}/ia/proposer-photo`))
        .set(auth(ctx.technico))
        .attach('photos', PNG, 'sdb.png')
        .expect(422);
      expect(res.body.code).toBe('IA_NON_CONFIGUREE');
    });
  });

  describe('avec un modèle IA (simulé)', () => {
    let t: TestApp;
    let http: App;
    let ctx: Awaited<ReturnType<typeof setup>>;
    const llm = new FakeLlm();

    beforeAll(async () => {
      t = await createTestApp([], [{ provide: LLM_VISION_CLIENT, useValue: llm }]);
      http = t.http;
      ctx = await setup(t);
    });
    afterAll(async () => {
      await cleanup(t);
      await t.close();
    });

    const post = () =>
      request(http)
        .post(api(`/devis/${ctx.devisId}/ia/proposer-photo`))
        .set(auth(ctx.technico));

    it('refuses no photo, a non-image and a chef', async () => {
      expect((await post().field('description', 'salle de bain').expect(422)).body.code).toBe(
        'PHOTO_MANQUANTE',
      );
      expect((await post().attach('photos', PDF, 'plan.pdf').expect(422)).body.code).toBe(
        'FICHIER_TYPE_REFUSE',
      );
      await request(http)
        .post(api(`/devis/${ctx.devisId}/ia/proposer-photo`))
        .set(auth(ctx.chef))
        .attach('photos', PNG, 'a.png')
        .expect(403);
    });

    it('sends the photos to the model, prices the lines from the catalogue and flags the estimated surface', async () => {
      const faience = await t.prisma.prestation.findFirstOrThrow({
        where: { nom: 'Pose faïence' },
      });
      llm.next = {
        analyse: analyse('BONNE'),
        lignes: [
          { prestationId: faience.id, quantite: 18, justification: 'Murs sur 2 m' },
          { prestationId: 99_999_999, quantite: 1, justification: 'inventée' },
        ],
        nonCouverts: [],
        hypotheses: ['Hauteur 2 m'],
      };
      const res = await post()
        .field('description', 'garder la baignoire')
        .attach('photos', PNG, 'a.png')
        .attach('photos', PNG, 'b.png')
        .expect(200);

      const user = llm.last.find((m) => m.role === 'user')!;
      expect(user.images).toHaveLength(2);
      expect(user.images![0]).toMatch(/^data:image\/png;base64,/);
      expect(user.content).toContain('garder la baignoire');

      expect(res.body.modeIA).toBe(true);
      expect(res.body.lignes).toHaveLength(1);
      expect(res.body.lignes[0]).toMatchObject({ prestationId: faience.id, quantite: 18 });
      expect(res.body.analysePhoto).toMatchObject({
        piece: 'Salle de bain',
        surfaceEstimeeM2: 6,
        qualitePhoto: 'BONNE',
      });
      expect(res.body.hypotheses[0]).toMatch(/≈ 6 m².*approximative/);
      // nothing written
      expect(await t.prisma.ligneDevis.count({ where: { devisId: ctx.devisId } })).toBe(0);
    });

    it('a blurry photo: warning, and the description takes over when the AI proposes nothing', async () => {
      llm.next = {
        analyse: analyse('INSUFFISANTE', null),
        lignes: [],
        nonCouverts: [],
        hypotheses: [],
      };
      const res = await post()
        .field('description', 'Pose de faïence sur les murs de la salle de bain')
        .attach('photos', PNG, 'flou.png')
        .expect(200);
      expect(res.body.avertissement).toMatch(/peu exploitable/);
      expect(res.body.modeIA).toBe(false);
      expect(res.body.lignes.length).toBeGreaterThan(0);
    });

    it('AI down: falls back on the description, or asks to retry without one; the error is logged', async () => {
      llm.next = new LlmError('QUOTA', 'Limite atteinte');
      const withText = await post()
        .field('description', 'Pose de faïence salle de bain 8 m²')
        .attach('photos', PNG, 'a.png')
        .expect(200);
      expect(withText.body.avertissement).toMatch(/n’a pas pu analyser/);
      const without = await post().attach('photos', PNG, 'a.png').expect(422);
      expect(without.body.code).toBe('IA_PHOTO_INDISPONIBLE');
      expect(
        await t.prisma.assistantErreur.count({ where: { type: 'DEVIS_PHOTO_QUOTA' } }),
      ).toBeGreaterThan(0);
    });
  });
});
