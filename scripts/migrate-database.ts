import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { applyMigrationAtomically } from '../lib/database/migration-runner';

const migrationsDirectory = path.join(process.cwd(), 'db', 'migrations');
const migrationLockKey = 7_413_902_026;

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED
    ?? process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error('A Neon connection string is required. Prefer DATABASE_URL_UNPOOLED for migrations.');
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    await sql`select pg_advisory_lock(${migrationLockKey})`;

    await sql`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const files = (await readdir(migrationsDirectory))
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const [alreadyApplied] = await sql<{ filename: string }[]>`
        select filename
        from schema_migrations
        where filename = ${filename}
        limit 1
      `;

      if (alreadyApplied) {
        console.log(`skip ${filename}`);
        continue;
      }

      const source = await readFile(path.join(migrationsDirectory, filename), 'utf8');
      await applyMigrationAtomically({
        begin: work => sql.begin(async transaction => work({
          unsafe: body => transaction.unsafe(body),
          record: migration => transaction`
            insert into schema_migrations (filename) values (${migration})
          `,
        })),
      }, filename, source);
      console.log(`applied ${filename}`);
    }
  } finally {
    try {
      await sql`select pg_advisory_unlock(${migrationLockKey})`;
    } finally {
      await sql.end();
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
