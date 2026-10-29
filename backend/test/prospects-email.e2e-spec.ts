import request from 'supertest';
import { App } from 'supertest/types';
import type { EmailRecu, MailboxReader } from '../src/modules/ia/assistant/email/mailbox.reader';
import { MAILBOX_READER } from '../src/modules/ia/assistant/email/mailbox.reader';
import { LLM_CLIENT, type LlmClient } from '../src/modules/ia/assistant/llm/llm.client';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/** Fake mailbox: the test puts emails in it; each run takes them and « marks them read ». */
class FakeMailbox implements MailboxReader {
  readonly description = 'boite-test@exemple.fr (fausse)';
  nonLus: EmailRecu[] = [];
  async traiterNonLus(max: number, traiter: (e: EmailRecu) => Promise<void>) {
    const lot = this.nonLus.splice(0, max);
    let lus = 0;
    let erreurs = 0;
    for (const e of lot) {
      try {
        await traiter(e);
        lus++;
      } catch {
        erreurs++;
      }
    }
    return { lus, erreurs };
  }
}

/** Fake AI: answers by looking at the subject (no network, no cost). */
class FakeLlm implements LlmClient {
  readonly name = 'fake';
  completeJson(messages: { content: string }[]): Promise<unknown> {
    const texte = messages[1]?.content ?? '';
    const pub = /promo|newsletter/i.test(texte);
    return Promise.resolve({
      estDemande: !pub,
      motif: pub ? 'publicité' : 'demande de rénovation',
      nom: pub ? null : 'Dupont',
      prenom: pub ? null : 'Jean',
      email: null,
      telephone: pub ? null : '06 12 34 56 78',
      adresse: pub ? null : '5 rue des Tests, Lyon',
      typeProjet: null,
      description: pub
        ? null
        : 'Rénovation complète d’une salle de bain de 6 m² avec douche à l’italienne.',
      delai: pub ? null : 'avant l’été',
    });
  }
}

describe('Prospects par email (e2e)', () => {
  let t: TestApp;
  let http: App;
  let admin: string;
  let technico: string;
  const box = new FakeMailbox();
  const tag = `e2e-mail-${Date.now()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (p: string) => `/api/v1${p}`;
  const email = (
    n: string,
    sujet: string,
    texte: string,
    extra: Partial<EmailRecu> = {},
  ): EmailRecu => ({
    uid: Math.floor(Math.random() * 1e6),
    messageId: `<${tag}-${n}@exemple.fr>`,
    expediteur: { adresse: `${tag}-${n.split('-')[0]}@client.test`, nom: 'Jean Dupont' },
    sujet,
    texte,
    date: new Date(),
    automatique: false,
    ...extra,
  });

  beforeAll(async () => {
    t = await createTestApp(
      [],
      [
        { provide: MAILBOX_READER, useValue: box },
        { provide: LLM_CLIENT, useValue: new FakeLlm() },
      ],
    );
    http = t.http;
    [admin, technico] = await Promise.all([t.tokenFor(SEED.admin), t.tokenFor(SEED.technico)]);
  });

  afterAll(async () => {
    const sessions = await t.prisma.chatSession.findMany({
      where: { emailMessageId: { startsWith: `<${tag}` } },
      select: { id: true, demandeDevisId: true, clientId: true },
    });
    await t.prisma.chatSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
    const demandes = sessions
      .map((s) => s.demandeDevisId)
      .filter((id): id is number => id !== null);
    await t.prisma.demandeDevis.deleteMany({ where: { id: { in: demandes } } });
    await t.prisma.client.deleteMany({ where: { email: { startsWith: tag } } });
    await t.close();
  });

  it('a request becomes a prospect « à qualifier », an advert is set aside, a reply joins the prospect', async () => {
    box.nonLus.push(
      email(
        'a',
        'Demande de devis salle de bain',
        'Bonjour, je souhaite refaire ma salle de bain (6 m²). Tél 06 12 34 56 78.\n--\nJean',
      ),
      email('pub', 'Promo -50 % sur nos logiciels', 'Newsletter : profitez de notre offre.'),
      email('robot', 'Réponse automatique', 'Je suis absent', { automatique: true }),
    );
    await request(http)
      .post(api('/assistant/prospects/emails/relever'))
      .set(auth(technico))
      .expect(403);
    const run = await request(http)
      .post(api('/assistant/prospects/emails/relever'))
      .set(auth(admin))
      .expect(200);
    expect(run.body).toMatchObject({ lus: 3, prospects: 1, rejetes: 1, ignores: 1 });

    const list = await request(http)
      .get(api('/assistant/prospects?source=EMAIL&statuts=A_QUALIFIER'))
      .set(auth(technico))
      .expect(200);
    const p = list.body.data.find(
      (x: { clientEmail: string }) => x.clientEmail === `${tag}-a@client.test`,
    );
    expect(p).toMatchObject({
      source: 'EMAIL',
      emailSujet: 'Demande de devis salle de bain',
      clientNom: 'Dupont',
      clientTelephone: '06 12 34 56 78',
    });

    const rejete = await t.prisma.chatSession.findFirstOrThrow({
      where: { emailMessageId: `<${tag}-pub@exemple.fr>` },
    });
    expect(rejete.statut).toBe('REJETE');
    expect(rejete.motifRejet).toMatch(/Tri automatique : publicité/);

    // the same person writes again; the same email read twice is ignored
    box.nonLus.push(
      email('a-2', 'RE: Demande de devis salle de bain', 'Précision : la douche fait 90x120.'),
      email('a', 'doublon', 'x'),
    );
    const run2 = await request(http)
      .post(api('/assistant/prospects/emails/relever'))
      .set(auth(admin))
      .expect(200);
    expect(run2.body).toMatchObject({ suites: 1, ignores: 1, prospects: 0 });
    const detail = await request(http)
      .get(api(`/assistant/prospects/${p.id}`))
      .set(auth(technico))
      .expect(200);
    expect(detail.body.messages).toHaveLength(2);
    expect(detail.body.messages[1].contenu).toContain('90x120');
  });

  it('qualified, it becomes a quote request with source EMAIL; the status shows the mailbox', async () => {
    const p = await t.prisma.chatSession.findFirstOrThrow({
      where: { emailMessageId: `<${tag}-a@exemple.fr>` },
    });
    const res = await request(http)
      .post(api(`/assistant/prospects/${p.id}/qualifier`))
      .set(auth(technico))
      .send({})
      .expect(200);
    const demande = await t.prisma.demandeDevis.findUniqueOrThrow({
      where: { id: res.body.demande.id },
    });
    expect(demande.source).toBe('EMAIL');

    const statut = await request(http)
      .get(api('/assistant/prospects/emails/statut'))
      .set(auth(technico))
      .expect(200);
    expect(statut.body).toMatchObject({ active: true, boite: 'boite-test@exemple.fr (fausse)' });
    expect(statut.body.dernier.lus).toBeGreaterThanOrEqual(1);
  });
});
