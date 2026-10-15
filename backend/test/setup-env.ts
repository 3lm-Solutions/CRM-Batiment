import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Environment for e2e tests. Requires PostgreSQL running (`pnpm db:up`).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5433/crm_batiment?schema=public';
process.env.JWT_SECRET ??= 'test-secret-'.padEnd(40, 'x');
// Uploaded files of the tests go to a throwaway directory, never into ./storage
process.env.STORAGE_DIR ??= join(tmpdir(), 'crm-batiment-e2e-storage');
// The chatbot never calls OpenAI in tests: guided mode, or a fake client injected by the test
process.env.OPENAI_API_KEY = '';
