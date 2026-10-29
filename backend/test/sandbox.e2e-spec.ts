import request from 'supertest';
import { createTestApp, TestApp } from './helpers/test-app';

/**
 * The demo sandbox is OFF on every normal instance (tests included): no password-less login.
 * The nightly wipe itself is never run in tests — it would empty the test database.
 */
describe('Démo en ligne (e2e) — instance normale', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it('says this instance is not the demo', async () => {
    const res = await request(t.http).get('/api/v1/public/demo').expect(200);
    expect(res.body.actif).toBe(false);
  });

  it('refuses the password-less login (404), for every role', async () => {
    await request(t.http).post('/api/v1/public/demo/connexion').send({ role: 'ADMIN' }).expect(404);
    await request(t.http)
      .post('/api/v1/public/demo/connexion')
      .send({ role: 'PIRATE' })
      .expect(400);
  });
});
