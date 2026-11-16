import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const nom = process.argv[2];
const companyIdRaw = process.argv[3];

if (!nom) {
  console.error('Usage: node --loader ts-node/esm scripts/disable-category.ts "NomCategorie" [companyId]');
  process.exit(2);
}

const companyId = companyIdRaw ? Number(companyIdRaw) : 1;
if (!Number.isFinite(companyId)) {
  console.error('companyId must be a number');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

try {
  const categorie = await prisma.categoriePrestation.findFirst({
    where: { companyId, nom },
    select: { id: true, nom: true, actif: true },
  });

  if (!categorie) {
    console.error(`Categorie not found: nom="${nom}" companyId=${companyId}`);
    process.exitCode = 1;
  } else if (!categorie.actif) {
    console.log(`Already disabled: #${categorie.id} ${categorie.nom}`);
  } else {
    await prisma.categoriePrestation.update({
      where: { id: categorie.id },
      data: { actif: false },
    });
    console.log(`Disabled: #${categorie.id} ${categorie.nom}`);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
