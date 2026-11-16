import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const envContent = fs.readFileSync('.env', 'utf8');
const dbLine = envContent
  .split(/\r?\n/)
  .find((line) => line.startsWith('DATABASE_URL='));

if (!dbLine) {
  console.error('DATABASE_URL_NOT_FOUND');
  process.exit(1);
}

const databaseUrl = dbLine.slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  const res = await client.query(`
    select
      p."nom" as "prestation",
      p."unite" as "unitePrestation",
      c."nom" as "categorie",
      sc."nom" as "sousCategorie",
      m."nom" as "materiau",
      smo."nom" as "mainOeuvre",
      pc."quantiteParUnite" as "quantiteParUnite"
    from public."prestations_compositions" pc
    left join public."prestations" p on p."id" = pc."prestationId"
    left join public."categories_prestations" c on c."id" = p."categorieId"
    left join public."sous_categories" sc on sc."id" = p."sousCategorieId"
    left join public."materiaux" m on m."id" = pc."materiauId"
    left join public."services_main_oeuvre" smo on smo."id" = pc."serviceMainOeuvreId"
    order by p."nom" asc, pc."id" asc
  `);

  const rows = res.rows.map((row) => ({
    prestation: row.prestation ?? null,
    unitePrestation: row.unitePrestation ?? null,
    categorie: row.categorie ?? null,
    sousCategorie: row.sousCategorie ?? null,
    materiau: row.materiau ?? null,
    mainOeuvre: row.mainOeuvre ?? null,
    quantiteParUnite: row.quantiteParUnite,
  }));

  const json = JSON.stringify(rows, null, 2);

  const outputReadable = path.resolve('docs', 'prestations_compositions_lisible.json');
  const outputCurrentTab = path.resolve('docs', 'prestations_compositions_.json');
  const outputBackupIds = path.resolve('docs', 'prestations_compositions_ids.json');

  // Sauvegarde du JSON IDs existant si présent
  if (fs.existsSync(outputCurrentTab)) {
    fs.copyFileSync(outputCurrentTab, outputBackupIds);
  }

  fs.writeFileSync(outputReadable, `${json}\n`, 'utf8');
  fs.writeFileSync(outputCurrentTab, `${json}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        rows: rows.length,
        outputReadable,
        outputCurrentTab,
        backupIds: fs.existsSync(outputBackupIds) ? outputBackupIds : null,
      },
      null,
      2,
    ),
  );
} finally {
  client.release();
  await pool.end();
}
