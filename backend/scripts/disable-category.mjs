import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const nom = process.argv[2];
const companyIdRaw = process.argv[3];

if (!nom) {
  console.error('Usage: node scripts/disable-category.mjs "NomCategorie" [companyId]');
  process.exitCode = 2;
} else {
  const companyId = companyIdRaw ? Number(companyIdRaw) : 1;
  if (!Number.isFinite(companyId)) {
    console.error('companyId must be a number');
    process.exitCode = 2;
  } else {
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
    } catch (err) {
      console.error('Error while disabling category:', err);
      process.exitCode = 1;
    }
  }
}

await prisma.$disconnect();
await pool.end();
