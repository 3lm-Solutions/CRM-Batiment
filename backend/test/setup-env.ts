// Reads backend/.env first (DATABASE_URL of your local database); the values below are only fallbacks
import 'dotenv/config';
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
process.env.OPENAI_VISION_MODEL = '';
process.env.OPENAI_VISION_API_KEY = '';
// Never read a real mailbox in tests (prospects by email: a fake reader is injected)
process.env.IMAP_HOST = '';
process.env.IMAP_SUBJECTS = '';
// Never send real emails in tests (even when backend/.env has a Gmail account): printed in the console
process.env.MAIL_HOST = '';
process.env.DEMO_MODE = 'false';
