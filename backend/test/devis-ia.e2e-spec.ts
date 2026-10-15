import request from 'supertest';
import { App } from 'supertest/types';
import { LLM_CLIENT, LlmError, type LlmClient } from '../src/modules/ia/assistant/llm/llm.client';
import { createTestApp, SEED, TestApp } from './helpers/test-app';

/** Fake AI: each test sets what the "model" answers. No network, no cost. */
class FakeLlm implements LlmClient {
  readonly name = 'fake';
  next: unknown = null;
  calls = 0;
  completeJson(): Promise<unknown> {
    this.calls++;
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}

const DESCRIPTION = 'Rénovation salle de bain 8 m² : douche à l’italienne, faïence murale et carrelage au sol';

describe('Devis IA — proposition de lignes (e2e)', () => {
  const tag = `e2e-dia-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;

  async function setup(t: TestApp) {
    const technico = await t.tokenFor(SEED.technico);
    const client = await request(t.http).post(api('/clients')).set(auth(technico)).send({ nom: `${tag} Morel`, email: `${tag}@client.test` }).expect(201);
    const devis = await request(t.http).post(api('/devis')).set(auth(technico)).send({ clientId: client.body.id }).expect(201);
    return { technico, clientId: client.body.id as number, devisId: devis.body.id as number };
  }

  async function cleanup(t: TestApp) {
    const clients = await t.prisma.client.findMany({ where: { nom: { startsWith: tag } }, select: { id: true } });
    const ids = clients.map((c) => c.id);
    const refs = await t.prisma.devis.findMany({ where: { clientId: { in: ids } }, select: { reference: true } });
    for (const { reference } of refs) {
      await t.prisma.assistantErreur.deleteMany({ where: { type: { startsWith: 'DEVIS_' }, detail: { contains: reference } } });
    }
    await t.prisma.devis.deleteMany({ where: { clientId: { in: ids } } });
    await t.prisma.client.deleteMany({ where: { id: { in: ids } } });
  }

  describe('mode guidé (sans clé OpenAI)', () => {
    let t: TestApp;
    let http: App;
    let ctx: Awaited<ReturnType<typeof setup>>;

    beforeAll(async () => {
      t = await createTestApp();
      http = t.http;
      ctx = await setup(t);
    });
    afterAll(async () => {
      await cleanup(t);
      await t.close();
    });

    it('proposes catalogue lines priced by the catalogue, without writing anything', async () => {
      const res = await request(http).post(api(`/devis/${ctx.devisId}/ia/proposer`)).set(auth(ctx.technico)).send({ description: DESCRIPTION }).expect(200);
      expect(res.body.modeIA).toBe(false);
      expect(res.body.lignes.length).toBeGreaterThan(0);
      const faience = res.body.lignes.find((l: { nom: string }) => l.nom === 'Pose faïence');
      expect(faience).toBeDefined();
      expect(faience.quantite).toBe(8); // M2 line: the surface written in the description
      expect(Number(faience.prixUnitaireHT)).toBeGreaterThan(0);
      expect(Number(res.body.totalHT)).toBeGreaterThan(0);
      expect(await t.prisma.ligneDevis.count({ where: { devisId: ctx.devisId } })).toBe(0);
    });

    it('applies the kept lines in one go and recalculates the quote', async () => {
      const prop = await request(http).post(api(`/devis/${ctx.devisId}/ia/proposer`)).set(auth(ctx.technico)).send({ description: DESCRIPTION }).expect(200);
      const kept = prop.body.lignes.slice(0, 2).map((l: { prestationId: number; quantite: number }) => ({ prestationId: l.prestationId, quantite: l.quantite }));
      const res = await request(http).post(api(`/devis/${ctx.devisId}/ia/appliquer`)).set(auth(ctx.technico)).send({ lignes: kept }).expect(200);
      expect(res.body.lignes).toHaveLength(2);
      expect(Number(res.body.totalHT)).toBeGreaterThan(0);
    });

    it('all-or-nothing: an unknown prestation adds no line at all', async () => {
      const before = await t.prisma.ligneDevis.count({ where: { devisId: ctx.devisId } });
      const prestation = await t.prisma.prestation.findFirstOrThrow({ where: { nom: 'Pose faïence' } });
      await request(http)
        .post(api(`/devis/${ctx.devisId}/ia/appliquer`))
        .set(auth(ctx.technico))
        .send({ lignes: [{ prestationId: prestation.id, quantite: 3 }, { prestationId: 99_999_999, quantite: 1 }] })
        .expect((r) => expect(r.status).toBeGreaterThanOrEqual(400));
      expect(await t.prisma.ligneDevis.count({ where: { devisId: ctx.devisId } })).toBe(before);
    });

    it('validates the input and the rights', async () => {
      await request(http).post(api(`/devis/${ctx.devisId}/ia/proposer`)).set(auth(ctx.technico)).send({ description: 'court' }).expect(400);
      await request(http).post(api(`/devis/${ctx.devisId}/ia/appliquer`)).set(auth(ctx.technico)).send({ lignes: [] }).expect(400);
      const chef = await t.tokenFor(SEED.chef);
      await request(http).post(api(`/devis/${ctx.devisId}/ia/proposer`)).set(auth(chef)).send({ description: DESCRIPTION }).expect(403);
    });
  });

  describe('avec un modèle IA (simulé)', () => {
    let t: TestApp;
    let http: App;
    let ctx: Awaited<ReturnType<typeof setup>>;
    const llm = new FakeLlm();

    beforeAll(async () => {
      t = await createTestApp([], [{ provide: LLM_CLIENT, useValue: llm }]);
      http = t.http;
      ctx = await setup(t);
    });
    afterAll(async () => {
      await cleanup(t);
      await t.close();
    });

    it('keeps only real catalogue ids, prices them from the catalogue', async () => {
      const faience = await t.prisma.prestation.findFirstOrThrow({ where: { nom: 'Pose faïence' } });
      llm.next = {
        lignes: [
          { prestationId: faience.id, quantite: 22.5, justification: 'Murs de la douche et du lavabo' },
          { prestationId: 99_999_999, quantite: 1, justification: 'inventée' },
          { prestationId: faience.id, quantite: 3, justification: 'doublon' },
        ],
        nonCouverts: ['Pose d’un miroir'],
        hypotheses: ['Hauteur de faïence 2,10 m'],
      };
      const res = await request(http).post(api(`/devis/${ctx.devisId}/ia/proposer`)).set(auth(ctx.technico)).send({ description: DESCRIPTION }).expect(200);
      expect(res.body.modeIA).toBe(true);
      expect(res.body.lignes).toHaveLength(1);
      expect(res.body.lignes[0]).toMatchObject({ prestationId: faience.id, quantite: 22.5, unite: 'M2' });
      expect(res.body.nonCouverts).toEqual(['Pose d’un miroir']);
      expect(res.body.avertissement).toBeNull();
    });

    it('falls back to keyword matching when the AI fails, and logs the error', async () => {
      llm.next = new LlmError('QUOTA', 'Limite atteinte');
      const res = await request(http).post(api(`/devis/${ctx.devisId}/ia/proposer`)).set(auth(ctx.technico)).send({ description: DESCRIPTION }).expect(200);
      expect(res.body.modeIA).toBe(false);
      expect(res.body.avertissement).toMatch(/mots-clés/);
      expect(res.body.lignes.length).toBeGreaterThan(0);
      const logged = await t.prisma.assistantErreur.findFirst({ where: { type: 'DEVIS_QUOTA' }, orderBy: { id: 'desc' } });
      expect(logged).not.toBeNull();
    });
  });
});
