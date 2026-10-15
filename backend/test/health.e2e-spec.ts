import request from 'supertest';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Health (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('GET /api/v1/health -> 200, public, database up', async () => {
    const res = await request(t.http).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up', environment: 'test' });
  });

  it('GET /api/health (no version) -> 404', async () => {
    await request(t.http).get('/api/health').expect(404);
  });
});
