import request from 'supertest';
import { App } from 'supertest/types';
import { ReferencePrefix, ReferenceService } from '../src/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';
import { ProbeController } from './probe.controller';

/**
 * Exercises the whole request pipeline through real HTTP.
 * Requires PostgreSQL running and seeded: `pnpm db:up && pnpm db:migrate && pnpm db:seed`.
 */
describe('Common layer (e2e)', () => {
  let t: TestApp;
  let http: App;
  let adminToken: string;
  let technicoToken: string;

  beforeAll(async () => {
    t = await createTestApp([ProbeController]);
    http = t.http;
    adminToken = await t.tokenFor(SEED.admin);
    technicoToken = await t.tokenFor(SEED.technico);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('authentication & roles', () => {
    it('public route: 200 without token', async () => {
      await request(http).get('/api/v1/probe/public').expect(200);
    });

    it('protected route without token: 401 in the standard error format', async () => {
      const res = await request(http).get('/api/v1/probe/admin').expect(401);
      expect(res.body).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        path: '/api/v1/probe/admin',
      });
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });

    it('invalid token: 401', async () => {
      await request(http)
        .get('/api/v1/probe/admin')
        .set('Authorization', 'Bearer abc.def.ghi')
        .expect(401);
    });

    it('wrong role: 403', async () => {
      await request(http)
        .get('/api/v1/probe/admin')
        .set('Authorization', `Bearer ${technicoToken}`)
        .expect(403);
    });

    it('right role: 200 and @CurrentUser is filled', async () => {
      const res = await request(http)
        .get('/api/v1/probe/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ email: SEED.admin, role: 'ADMIN', scope: 'session' });
    });

    it('route with no @Roles: 403 even for ADMIN (secure by default)', async () => {
      await request(http)
        .get('/api/v1/probe/no-roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('errors & serialization', () => {
    it('BusinessException: 422 with its code', async () => {
      const res = await request(http).get('/api/v1/probe/business').expect(422);
      expect(res.body).toMatchObject({ code: 'DEVIS_SANS_LIGNES', error: 'Unprocessable Entity' });
    });

    it('unknown error: 500 without leaking details', async () => {
      const res = await request(http).get('/api/v1/probe/crash').expect(500);
      expect(JSON.stringify(res.body)).not.toContain('internal detail');
    });

    it('Decimal values are returned as JSON numbers', async () => {
      const res = await request(http).get('/api/v1/probe/decimal').expect(200);
      expect(res.body).toEqual({ totalHT: 1250.5, lignes: [{ quantite: 14.5 }] });
    });

    it('reuses a valid incoming X-Request-Id', async () => {
      const res = await request(http).get('/api/v1/probe/public').set('X-Request-Id', 'abc-123');
      expect(res.headers['x-request-id']).toBe('abc-123');
    });
  });

  describe('pagination', () => {
    it('converts query params and builds meta', async () => {
      const res = await request(http).get('/api/v1/probe/list?page=2&limit=10').expect(200);
      expect(res.body.meta).toEqual({ page: 2, limit: 10, total: 42, totalPages: 5 });
    });

    it('applies defaults', async () => {
      const res = await request(http).get('/api/v1/probe/list').expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    });

    it('refuses limit > 100 and unknown params', async () => {
      await request(http).get('/api/v1/probe/list?limit=500').expect(400);
      await request(http).get('/api/v1/probe/list?hack=1').expect(400);
    });
  });

  describe('ReferenceService (real database)', () => {
    const TEST_PREFIX = ReferencePrefix.SAV;
    const testYear = new Date('2099-06-01'); // isolated year: never collides with real data
    let companyId: number;

    beforeAll(async () => {
      companyId = (await t.prisma.company.findFirstOrThrow()).id;
    });

    afterAll(async () => {
      await t.prisma.referenceCounter.deleteMany({ where: { year: 2099 } });
    });

    it('gives 20 unique, consecutive numbers under concurrency', async () => {
      const refs = t.app.get(ReferenceService);
      const results = await Promise.all(
        Array.from({ length: 20 }, () => refs.next(TEST_PREFIX, companyId, undefined, testYear)),
      );

      expect(new Set(results).size).toBe(20);
      const numbers = results.map((r) => Number(r.split('-').at(-1))).sort((a, b) => a - b);
      expect(numbers[19] - numbers[0]).toBe(19);
      expect(results[0]).toMatch(/^SAV-2099-\d{4}$/);
    });

    it('releases the number when the transaction rolls back (no gaps)', async () => {
      const prisma = t.app.get(PrismaService);
      const refs = t.app.get(ReferenceService);

      const before = await refs.next(TEST_PREFIX, companyId, undefined, testYear);
      await prisma
        .$transaction(async (tx) => {
          await refs.next(TEST_PREFIX, companyId, tx, testYear);
          throw new Error('rollback');
        })
        .catch(() => undefined);
      const after = await refs.next(TEST_PREFIX, companyId, undefined, testYear);

      const n = (ref: string) => Number(ref.split('-').at(-1));
      expect(n(after)).toBe(n(before) + 1);
    });
  });
});
