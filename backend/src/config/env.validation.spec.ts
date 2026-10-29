import { isDemoDatabase, validateEnv } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://crm:crm@localhost:5433/crm_batiment',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const env = validateEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_PORT).toBe(3000);
    expect(env.BODY_LIMIT).toBe('5mb');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('converts APP_PORT from string to number', () => {
    expect(validateEnv({ ...validEnv, APP_PORT: '4000' }).APP_PORT).toBe(4000);
  });

  it('splits CORS_ORIGINS into a clean array', () => {
    const env = validateEnv({ ...validEnv, CORS_ORIGINS: 'http://a.com, http://b.com,' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL DATABASE_URL', () => {
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /PostgreSQL/,
    );
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('demo sandbox: only on a database whose name contains "demo" (wiped every night)', () => {
    expect(validateEnv(validEnv).DEMO_MODE).toBe(false);
    expect(() => validateEnv({ ...validEnv, DEMO_MODE: 'true' })).toThrow(/DEMO_MODE/);
    const demo = validateEnv({
      ...validEnv,
      DEMO_MODE: 'true',
      DATABASE_URL: 'postgresql://crm:crm@localhost:5432/crm_batiment_demo?schema=public',
    });
    expect(demo.DEMO_MODE).toBe(true);
    // the user or host name does not count, only the database name
    expect(isDemoDatabase('postgresql://demo:demo@demo-host:5432/crm_batiment')).toBe(false);
    expect(isDemoDatabase('pas une url')).toBe(false);
  });
});
