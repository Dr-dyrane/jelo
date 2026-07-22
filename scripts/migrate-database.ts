import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

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
      await sql.unsafe(source);
      await sql`insert into schema_migrations (filename) values (${filename})`;
      console.log(`applied ${filename}`);
    }
  } catch (error) {
    // Migration files are self-transactional. PostgreSQL keeps the connection in
    // an aborted transaction after a failed statement, so roll it back before
    // releasing the advisory lock and preserve the original migration error.
    try {
      await sql.unsafe('rollback');
    } catch {
      // The connection may not have entered a transaction. The original error is
      // more useful than a best-effort rollback failure.
    }
    throw error;
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
