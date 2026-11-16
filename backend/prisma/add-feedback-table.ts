import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🔧 Creation de la table assistant_feedbacks...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS assistant_feedbacks (
      id SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      "sessionId" INTEGER,
      "messageExcerpt" TEXT,
      rating TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table creee');
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assistant_feedbacks_companyId_idx ON assistant_feedbacks("companyId");'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assistant_feedbacks_rating_idx ON assistant_feedbacks(rating);'
  );
  console.log('✅ Index crees');
  console.log('🔧 Termine !');
}

main()
  .catch((e) => { console.error('❌ Erreur:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
