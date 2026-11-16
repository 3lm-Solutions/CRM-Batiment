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

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

try {
  const res = await client.query(
    'select id, "prestationId", "materiauId", "serviceMainOeuvreId", "quantiteParUnite" from public."prestations_compositions" order by id',
  );

  const header = [
    'id',
    'prestationId',
    'materiauId',
    'serviceMainOeuvreId',
    'quantiteParUnite',
  ];

  const lines = [header.join(',')];
  for (const row of res.rows) {
    lines.push(
      [
        csvCell(row.id),
        csvCell(row.prestationId),
        csvCell(row.materiauId),
        csvCell(row.serviceMainOeuvreId),
        csvCell(row.quantiteParUnite),
      ].join(','),
    );
  }

  const outputPath = path.resolve('prestations_compositions_full.csv');
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        outputPath,
        rowCount: res.rows.length,
        lineCountWithHeader: lines.length,
      },
      null,
      2,
    ),
  );
} finally {
  client.release();
  await pool.end();
}
