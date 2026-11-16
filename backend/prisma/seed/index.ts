/**
 * Development seed — `pnpm db:seed` (also runs after `pnpm db:reset`).
 * Idempotent: safe to run several times.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
// The seed functions live in src/database/seed: the demo sandbox (Step 15) reuses them at runtime
import { seedConnaissances } from '../../src/database/seed/assistant';
import { seedCatalogue } from '../../src/database/seed/catalogue';
import { seedCompany, seedPortalProfiles, seedTypesProjet, seedUsers, TYPES_PROJET, USERS } from '../../src/database/seed/core';

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Seed refusé en production (comptes avec mots de passe connus).');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL manquant (.env).');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log('🌱 Seed de la base de développement…\n');

  const company = await seedCompany(prisma);
  console.log(`✅ Entreprise : ${company.nom}`);

  const users = await seedUsers(prisma, company.id);
  await seedPortalProfiles(prisma, company.id, users);
  console.log(`✅ ${USERS.length} comptes + profils sous-traitant / fournisseur`);

  await seedTypesProjet(prisma, company.id);
  console.log(`✅ ${TYPES_PROJET.length} types de projet`);

  const catalogue = await seedCatalogue(prisma, company.id);
  console.log('✅ Catalogue :');
  console.table(catalogue);

  const docs = await seedConnaissances(prisma, company.id);
  console.log(`✅ ${docs} documents dans la base de connaissances de l’assistant`);

  console.log('\n🔑 Comptes de démonstration :');
  console.table(USERS.map(({ role, email, password }) => ({ role, email, password })));
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed échoué :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
