import fs from 'node:fs';
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
  const tablesRes = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
  );

  const out = [];

  for (const row of tablesRes.rows) {
    const table = row.table_name;
    const countRes = await client.query(
      `select count(*)::int as c from public.\"${table}\"`,
    );
    const count = countRes.rows[0].c;

    let sample = [];
    if (count > 0) {
      const sampleRes = await client.query(
        `select row_to_json(x) as row from (select * from public.\"${table}\" limit 3) x`,
      );
      sample = sampleRes.rows.map((s) => s.row);
    }

    out.push({ table, rows: count, sample });
  }

  console.log(JSON.stringify(out, null, 2));
} finally {
  client.release();
  await pool.end();
}
