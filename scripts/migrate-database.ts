import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('A Neon connection string is required. Prefer DATABASE_URL_UNPOOLED for migrations.');
}

const sql = postgres(connectionString, { max: 1, prepare: false });
const migrationsDirectory = path.join(process.cwd(), 'db', 'migrations');

try {
  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const files = (await readdir(migrationsDirectory))
    .filter(file => file.endsWith('.sql'))
    .sort();

  const appliedRows = await sql<{ filename: string }[]>`select filename from schema_migrations`;
  const applied = new Set(appliedRows.map(row => row.filename));

  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`skip ${filename}`);
      continue;
    }

    const source = await readFile(path.join(migrationsDirectory, filename), 'utf8');

    await sql.begin(async transaction => {
      await transaction.unsafe(source);
      await transaction`insert into schema_migrations (filename) values (${filename})`;
    });

    console.log(`applied ${filename}`);
  }
} finally {
  await sql.end();
}
