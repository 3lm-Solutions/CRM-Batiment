import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, SEED, type TestApp } from './helpers/test-app';

/**
 * Auth + user management through real HTTP.
 * Requires a migrated and seeded database. Creates users "e2e-auth-*@test.local" and deletes them.
 */
describe('Auth & Users (e2e)', () => {
  let t: TestApp;
  let http: App;
  let adminToken: string;
  const run = Date.now();
  const email = (name: string) => `e2e-auth-${name}-${run}@test.local`;

  /** Creates a user as admin, returns its id and temporary password (exposed outside prod). */
  async function createUser(name: string, role = 'TECHNICO') {
    const res = await request(http)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: email(name), nom: 'Test', prenom: name, role })
      .expect(201);
    return { id: res.body.user.id as number, temporaryPassword: res.body.temporaryPassword as string };
  }

  /** Full first-login flow; returns a session token. */
  async function activateAccount(name: string, newPassword = 'NouveauMdp2026') {
    const { id, temporaryPassword } = await createUser(name);
    const login = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: email(name), password: temporaryPassword })
      .expect(200);
    const changed = await request(http)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${login.body.passwordChangeToken}`)
      .send({ currentPassword: temporaryPassword, newPassword })
      .expect(200);
    return { id, token: changed.body.accessToken as string, password: newPassword };
  }

  beforeAll(async () => {
    t = await createTestApp();
    http = t.http;
    adminToken = await t.tokenFor(SEED.admin);
  });

  afterAll(async () => {
    await t.prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-auth-' } } });
    await t.close();
  });

  describe('login', () => {
    it('logs in a seeded account', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: ' ADMIN@batiment-pro.fr ', password: 'Admin@2026!' }) // normalized
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: SEED.admin, role: 'ADMIN' });
      expect(res.body.user.password).toBeUndefined();
    });

    it('gives the SAME error for a wrong password and an unknown email', async () => {
      const wrong = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: SEED.admin, password: 'nope' })
        .expect(401);
      const unknown = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@nowhere.fr', password: 'nope' })
        .expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });
  });

  describe('first login (temporary password)', () => {
    it('sends the temporary password by email', async () => {
      const { temporaryPassword } = await createUser('mail');
      expect(t.mail.lastTo(email('mail'))?.text).toContain(temporaryPassword);
    });

    it('the restricted token is REFUSED everywhere except change-password', async () => {
      const { temporaryPassword } = await createUser('restricted');
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: email('restricted'), password: temporaryPassword })
        .expect(200);

      expect(login.body).toMatchObject({ mustChangePassword: true });
      expect(login.body.accessToken).toBeUndefined();

      await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.passwordChangeToken}`)
        .expect(401);
    });

    it('change-password requires the current password', async () => {
      const { temporaryPassword } = await createUser('needcurrent');
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: email('needcurrent'), password: temporaryPassword });

      await request(http)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${login.body.passwordChangeToken}`)
        .send({ currentPassword: 'wrong', newPassword: 'NouveauMdp2026' })
        .expect(422);
    });

    it('rejects a weak new password', async () => {
      const { temporaryPassword } = await createUser('weak');
      const login = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: email('weak'), password: temporaryPassword });

      await request(http)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${login.body.passwordChangeToken}`)
        .send({ currentPassword: temporaryPassword, newPassword: 'abc123' })
        .expect(400);
    });

    it('completes the flow and gives a working session', async () => {
      const { token } = await activateAccount('complete');
      const me = await request(http).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body).toMatchObject({ email: email('complete'), role: 'TECHNICO' });
    });
  });

  describe('session revocation', () => {
    it('a password change logs out the other sessions', async () => {
      const { token: oldToken, password } = await activateAccount('revoke');

      const changed = await request(http)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ currentPassword: password, newPassword: 'EncoreNouveau2026' })
        .expect(200);

      await request(http).get('/api/v1/auth/me').set('Authorization', `Bearer ${oldToken}`).expect(401);
      await request(http)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${changed.body.accessToken}`)
        .expect(200);
    });

    it('deactivation locks the user out immediately', async () => {
      const { id, token } = await activateAccount('deactivated');
      await request(http).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

      await request(http)
        .post(`/api/v1/users/${id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(http).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  describe('forgot password', () => {
    it('answers identically for an unknown email', async () => {
      const known = await request(http)
        .post('/api/v1/auth/forgot-password')
        .send({ email: SEED.chef })
        .expect(200);
      const unknown = await request(http)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@nowhere.fr' })
        .expect(200);
      expect(known.body).toEqual(unknown.body);
    });

    it('resets the password with the emailed code', async () => {
      const { password } = await activateAccount('forgot');
      await request(http).post('/api/v1/auth/forgot-password').send({ email: email('forgot') }).expect(200);
      await new Promise((r) => setTimeout(r, 50)); // mail is sent without awaiting

      const code = /(\d{6})/.exec(t.mail.lastTo(email('forgot'))?.text ?? '')?.[1];
      expect(code).toBeDefined();

      await request(http)
        .post('/api/v1/auth/reset-password')
        .send({ email: email('forgot'), code, newPassword: 'Reinitialise2026' })
        .expect(200);

      await request(http)
        .post('/api/v1/auth/login')
        .send({ email: email('forgot'), password })
        .expect(401);
      await request(http)
        .post('/api/v1/auth/login')
        .send({ email: email('forgot'), password: 'Reinitialise2026' })
        .expect(200);
    });

    it('burns the code after 5 wrong attempts', async () => {
      await activateAccount('burn');
      await request(http).post('/api/v1/auth/forgot-password').send({ email: email('burn') });
      await new Promise((r) => setTimeout(r, 50));
      const code = /(\d{6})/.exec(t.mail.lastTo(email('burn'))?.text ?? '')![1];
      const wrong = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await request(http)
          .post('/api/v1/auth/verify-reset-code')
          .send({ email: email('burn'), code: wrong })
          .expect(400);
      }
      // Even the RIGHT code no longer works
      await request(http)
        .post('/api/v1/auth/verify-reset-code')
        .send({ email: email('burn'), code })
        .expect(400);
    });
  });

  describe('user management rules', () => {
    it('only ADMIN manages users; staff can read the options list', async () => {
      const technico = await t.tokenFor(SEED.technico);
      const sousTraitant = await t.tokenFor(SEED.sousTraitant);

      await request(http).get('/api/v1/users').set('Authorization', `Bearer ${technico}`).expect(403);
      await request(http)
        .get('/api/v1/users/options?roles=CHEF_CHANTIER')
        .set('Authorization', `Bearer ${technico}`)
        .expect(200);
      await request(http)
        .get('/api/v1/users/options')
        .set('Authorization', `Bearer ${sousTraitant}`)
        .expect(403);
    });

    it('lists with pagination and filters', async () => {
      const res = await request(http)
        .get('/api/v1/users?role=ADMIN&actif=true&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 5 });
      expect(res.body.data.every((u: { role: string }) => u.role === 'ADMIN')).toBe(true);
    });

    it('an admin cannot deactivate, demote or delete themselves', async () => {
      const me = await request(http).get('/api/v1/auth/me').set('Authorization', `Bearer ${adminToken}`);
      const id = me.body.id as number;

      await request(http)
        .post(`/api/v1/users/${id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422);
      await request(http)
        .patch(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'TECHNICO' })
        .expect(422);
      await request(http)
        .delete(`/api/v1/users/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(422);
    });

    it('refuses a duplicate email with 409', async () => {
      await request(http)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: SEED.technico, nom: 'X', prenom: 'Y', role: 'TECHNICO' })
        .expect(409);
    });

    it('admin password reset closes the user sessions', async () => {
      const { id, token } = await activateAccount('adminreset');
      const res = await request(http)
        .post(`/api/v1/users/${id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.temporaryPassword).toEqual(expect.any(String));
      await request(http).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });
});
