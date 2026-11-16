import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const companyIdRaw = process.argv[2];
const companyId = companyIdRaw ? Number(companyIdRaw) : 1;

if (!Number.isFinite(companyId)) {
  console.error('Usage: node --loader ts-node/esm scripts/list-categories.ts [companyId]');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

try {
  const categories = await prisma.categoriePrestation.findMany({
    where: { companyId, actif: true },
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true },
  });

  for (const c of categories) {
    console.log(`${c.id}\t${c.nom}`);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
