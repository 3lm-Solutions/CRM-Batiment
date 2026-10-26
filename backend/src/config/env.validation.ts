import { z } from 'zod';

/**
 * Single source of truth for environment variables.
 * If anything is missing or invalid, the API stops at startup with a clear message,
 * instead of failing later with a confusing error (e.g. "secretOrPrivateKey must have a value").
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  BODY_LIMIT: z.string().default('5mb'),

  // Email — MAIL_HOST empty = emails are only printed in the console
  MAIL_HOST: z.string().optional().transform((v) => v?.trim() || undefined),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MAIL_USER: z.string().optional().transform((v) => v?.trim() || undefined),
  MAIL_PASS: z.string().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().default('CRM Bâtiment <noreply@crm-batiment.fr>'),

  // Uploaded files (Step 11). Kept OUTSIDE the repository and the database; back it up
  // with the database. Relative paths are resolved from the API's working directory.
  STORAGE_DIR: z.string().default('./storage'),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(50).default(10),

  // AI assistant (Step 14). Without a key the chatbot still works in guided mode (no AI):
  // it collects the prospect's details step by step and answers from the knowledge base.
  OPENAI_API_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  // Another OpenAI-compatible provider, e.g. xAI Grok: https://api.x.ai/v1 (empty = OpenAI)
  OPENAI_BASE_URL: z.string().optional().transform((v) => v?.trim() || undefined).pipe(z.string().url().optional()),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(2000).max(120000).default(20000),
  // Quote from a photo (C37 of 21/10) needs a model that READS IMAGES. Empty = the « Photo » tab is
  // unavailable. Key and URL default to OPENAI_API_KEY / OPENAI_BASE_URL (same provider), e.g.
  // Groq: qwen/qwen3.8-27b ; OpenAI: gpt-4o-mini (+ its own key and empty URL).
  // Prospects by email (22/10): a dedicated mailbox read every few minutes (IMAP). Empty host =
  // off. Gmail: imap.gmail.com, an « app password », IMAP enabled in the Gmail settings.
  IMAP_HOST: z.string().optional().transform((v) => v?.trim() || undefined),
  IMAP_PORT: z.preprocess((v) => (typeof v === 'string' && !v.trim() ? undefined : v), z.coerce.number().int().min(1).max(65535).default(993)),
  IMAP_SECURE: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() !== 'false'),
  IMAP_USER: z.string().optional().transform((v) => v?.trim() || undefined),
  IMAP_PASS: z.string().optional().transform((v) => v?.replace(/\s+/g, '') || undefined),
  IMAP_FOLDER: z.string().optional().transform((v) => v?.trim() || 'INBOX'),
  IMAP_POLL_MINUTES: z.preprocess((v) => (typeof v === 'string' && !v.trim() ? undefined : v), z.coerce.number().int().min(1).max(1440).default(5)),
  // Only the emails whose subject contains one of these words, comma separated (empty = all).
  // The others stay unread and untouched. Ex: devis,demande
  IMAP_SUBJECTS: z.string().optional().transform((v) => v?.trim() || undefined),
  // Company the prospects belong to (needed only when the database holds several companies)
  IMAP_COMPANY_ID: z.preprocess((v) => (typeof v === 'string' && !v.trim() ? undefined : v), z.coerce.number().int().min(1).optional()),
  OPENAI_VISION_MODEL: z.string().optional().transform((v) => v?.trim() || undefined),
  OPENAI_VISION_API_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  OPENAI_VISION_BASE_URL: z.string().optional().transform((v) => v?.trim() || undefined).pipe(z.string().url().optional()),

  // Demo sandbox (Step 15): a SEPARATE instance where anyone can try the CRM without an account.
  // The WHOLE database is wiped and re-seeded every night (03:00 Paris) and emails are never sent.
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
}).superRefine((env, ctx) => {
  // Safety: the nightly wipe must never hit a real database by mistake
  if (env.DEMO_MODE && !isDemoDatabase(env.DATABASE_URL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DEMO_MODE'],
      message: 'DEMO_MODE=true exige une base dédiée dont le nom contient « demo » (ex. crm_batiment_demo) : elle est effacée chaque nuit.',
    });
  }
});

/** True when the database NAME (last part of the URL) contains "demo". */
export function isDemoDatabase(url: string): boolean {
  try {
    return /demo/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule.forRoot({ validate }). */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`\n❌ Invalid environment configuration:\n${details}\n`);
  }

  return result.data;
}
