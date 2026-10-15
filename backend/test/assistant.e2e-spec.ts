import request from 'supertest';
import { App } from 'supertest/types';
import { LLM_CLIENT, LlmError, type LlmClient } from '../src/modules/ia/assistant/llm/llm.client';
import { createTestApp, SEED, TestApp } from './helpers/test-app';

/** Fake AI: each test sets what the "model" answers. No network, no cost. */
class FakeLlm implements LlmClient {
  readonly name = 'fake';
  next: unknown | Error = null;
  calls = 0;
  completeJson(): Promise<unknown> {
    this.calls++;
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}

/** Waits for an asynchronous side effect (event listeners). */
async function eventually<T>(fn: () => Promise<T | null>, ms = 2000): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
}

const reply = (reponse: string, champs: Record<string, string> = {}) => ({
  reponse,
  intention: 'demande_devis',
  besoinHumain: false,
  champs: { nom: '', prenom: '', email: '', telephone: '', adresse: '', typeProjet: '', description: '', delai: '', ...champs },
});

describe('Assistant IA — chatbot public et qualification (e2e)', () => {
  const tag = `e2e-ia-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;
  let companyId: number;

  async function start(http: App) {
    const res = await request(http).post(api('/public/assistant/sessions')).send({ companyId }).expect(201);
    return { id: res.body.sessionId as number, token: res.body.token as string, body: res.body };
  }
  const say = (http: App, s: { id: number; token: string }, contenu: string) =>
    request(http).post(api(`/public/assistant/sessions/${s.id}/messages`)).set('x-chat-token', s.token).send({ contenu });

  describe('mode guidé (sans clé OpenAI)', () => {
    let t: TestApp;
    let http: App;
    let admin: string;

    beforeAll(async () => {
      t = await createTestApp();
      http = t.http;
      admin = await t.tokenFor(SEED.admin);
      companyId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.admin } })).companyId;
    });

    afterAll(async () => {
      const sessions = await t.prisma.chatSession.findMany({ where: { OR: [{ description: { contains: tag } }, { messages: { some: { contenu: { contains: tag } } } }] }, select: { id: true, demandeDevisId: true } });
      await t.prisma.chatSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
      await t.prisma.demandeDevis.deleteMany({ where: { id: { in: sessions.map((s) => s.demandeDevisId).filter((x): x is number => !!x) } } });
      await t.prisma.client.deleteMany({ where: { nom: { startsWith: tag } } });
      await t.prisma.ragDocument.deleteMany({ where: { titre: { startsWith: tag } } });
      await t.close();
    });

    it('starts a conversation with a token, quick replies, guided mode', async () => {
      const s = await start(http);
      expect(s.body.token).toHaveLength(43);
      expect(s.body.modeIA).toBe(false);
      expect(s.body.suggestions).toContain('Demander un devis');
      // Wrong or missing token: same 404 as an unknown conversation
      await request(http).get(api(`/public/assistant/sessions/${s.id}`)).set('x-chat-token', 'x'.repeat(43)).expect(404);
      await say(http, { id: s.id, token: '' }, 'Bonjour').expect(404);
    });

    it('collects the need, the name and a phone, then hands over to the sales team', async () => {
      const s = await start(http);
      await say(http, s, `Je voudrais refaire ma salle de bain complète ${tag}`).expect(200);
      const r2 = await say(http, s, 'Dupont').expect(200);
      expect(r2.body.prospectEnregistre).toBe(false);
      const r3 = await say(http, s, 'Vous pouvez m’appeler au 06 12 34 56 78').expect(200);
      expect(r3.body.prospectEnregistre).toBe(true);
      expect(r3.body.champsManquants).toEqual([]);

      const p = await t.prisma.chatSession.findUniqueOrThrow({ where: { id: s.id } });
      expect(p).toMatchObject({ statut: 'A_QUALIFIER', clientNom: 'Dupont', clientTelephone: '06 12 34 56 78' });
      // The team is notified (asynchronous listener)
      const notif = await eventually(() => t.prisma.notification.findFirst({ where: { type: 'PROSPECT_CHATBOT', lien: `/assistant/prospects/${s.id}` } }));
      expect(notif).not.toBeNull();
    });

    it('never answers a price, even from the knowledge base', async () => {
      await request(http)
        .post(api('/assistant/connaissances'))
        .set(auth(admin))
        .send({ titre: `${tag} Tarifs carrelage`, categorie: 'Test', contenu: 'Pose de carrelage tarifs : comptez 45 € le m2 environ.', priorite: 10 })
        .expect(201);
      const s = await start(http);
      const r = await say(http, s, `Quel est le tarif pour la pose de carrelage ? ${tag}`).expect(200);
      expect(r.body.reponse).not.toMatch(/€|\d+\s*euros?/i);
      const erreur = await t.prisma.assistantErreur.findFirst({ where: { sessionId: s.id, type: 'REPONSE_BLOQUEE' } });
      expect(erreur).not.toBeNull();
    });

    it('structured form: validates, links an existing client instead of duplicating', async () => {
      const existing = await t.prisma.client.create({ data: { companyId, nom: `${tag} Existant`, telephone: '07.11.22.33.44' } });
      const s = await start(http);
      const bad = await request(http).post(api(`/public/assistant/sessions/${s.id}/coordonnees`)).set('x-chat-token', s.token).send({ nom: 'Martin', description: `Isolation des combles ${tag}` }).expect(422);
      expect(bad.body.code).toBe('CONTACT_REQUIS');
      await request(http)
        .post(api(`/public/assistant/sessions/${s.id}/coordonnees`))
        .set('x-chat-token', s.token)
        .send({ nom: 'Martin', telephone: '+33 7 11 22 33 44', description: `Isolation des combles perdus ${tag}` })
        .expect(200);
      const p = await t.prisma.chatSession.findUniqueOrThrow({ where: { id: s.id } });
      expect(p).toMatchObject({ statut: 'A_QUALIFIER', clientId: existing.id });

      // Qualification → DemandeDevis on the SAME client (no duplicate)
      const q = await request(http).post(api(`/assistant/prospects/${s.id}/qualifier`)).set(auth(admin)).send({}).expect(200);
      expect(q.body.demande.reference).toMatch(/^DEM-/);
      const demande = await t.prisma.demandeDevis.findUniqueOrThrow({ where: { id: q.body.demande.id } });
      expect(demande).toMatchObject({ clientId: existing.id, source: 'CHATBOT' });
      const again = await request(http).post(api(`/assistant/prospects/${s.id}/qualifier`)).set(auth(admin)).send({}).expect(422);
      expect(again.body.code).toBe('TRANSITION_PROSPECT_INTERDITE');
    });

    it('back-office: incomplete prospects cannot be qualified; reject needs a reason; portal accounts are refused', async () => {
      const s = await start(http);
      await say(http, s, `Bonjour, projet de cuisine ${tag}`).expect(200);
      const r = await request(http).post(api(`/assistant/prospects/${s.id}/qualifier`)).set(auth(admin)).send({}).expect(422);
      expect(r.body.code).toBe('PROSPECT_INCOMPLET');
      await request(http).post(api(`/assistant/prospects/${s.id}/rejeter`)).set(auth(admin)).send({}).expect(400);
      await request(http).post(api(`/assistant/prospects/${s.id}/rejeter`)).set(auth(admin)).send({ motif: 'Spam' }).expect(200);
      const st = await t.tokenFor(SEED.sousTraitant);
      await request(http).get(api('/assistant/prospects')).set(auth(st)).expect(403);
    });

    it('knowledge base search understands word forms (french full-text)', async () => {
      await request(http)
        .post(api('/assistant/connaissances'))
        .set(auth(admin))
        .send({ titre: `${tag} Isolation thermique`, categorie: 'Test', contenu: 'Nous isolons les combles perdus et aménagés.' })
        .expect(201);
      const res = await request(http).get(api('/assistant/connaissances/recherche')).query({ q: 'isoler mes combles ?' }).set(auth(admin)).expect(200);
      expect(res.body.map((d: { titre: string }) => d.titre)).toContain(`${tag} Isolation thermique`);
    });
  });

  describe('avec IA (client simulé)', () => {
    let t: TestApp;
    let http: App;
    const llm = new FakeLlm();

    beforeAll(async () => {
      t = await createTestApp([], [{ provide: LLM_CLIENT, useValue: llm }]);
      http = t.http;
      companyId = (await t.prisma.user.findUniqueOrThrow({ where: { email: SEED.admin } })).companyId;
    });

    afterAll(async () => {
      await t.prisma.chatSession.deleteMany({ where: { messages: { some: { contenu: { contains: tag } } } } });
      await t.close();
    });

    it('uses the model answer and its extracted fields (re-validated)', async () => {
      const s = await start(http);
      expect(s.body.modeIA).toBe(true);
      llm.next = reply('Très bien ! À quel numéro puis-je vous rappeler ?', { nom: 'Leroy', email: 'pas-un-email', description: `Peinture salon 30 m² ${tag}` });
      const r = await say(http, s, `Je m’appelle Leroy, peinture du salon ${tag}`).expect(200);
      expect(r.body.reponse).toBe('Très bien ! À quel numéro puis-je vous rappeler ?');
      const p = await t.prisma.chatSession.findUniqueOrThrow({ where: { id: s.id } });
      expect(p.clientNom).toBe('Leroy');
      expect(p.clientEmail).toBeNull(); // invalid email from the model ignored
    });

    it('blocks a price produced by the model and logs it', async () => {
      const s = await start(http);
      llm.next = reply('Pour 30 m² comptez environ 1 200 € TTC.');
      const r = await say(http, s, `Combien pour peindre 30 m² ? ${tag}`).expect(200);
      expect(r.body.reponse).not.toContain('€');
      expect(await t.prisma.assistantErreur.count({ where: { sessionId: s.id, type: 'REPONSE_BLOQUEE' } })).toBe(1);
    });

    it('keeps answering when the AI is down (guided fallback) and logs the error', async () => {
      const s = await start(http);
      llm.next = new LlmError('LLM_INDISPONIBLE', 'OpenAI HTTP 503');
      const r = await say(http, s, `Je veux un devis pour une terrasse ${tag}`).expect(200);
      expect(r.body.reponse.length).toBeGreaterThan(10);
      expect(await t.prisma.assistantErreur.count({ where: { sessionId: s.id, type: 'LLM_INDISPONIBLE' } })).toBe(1);
    });
  });
});
