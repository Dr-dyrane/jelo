import postgres from 'postgres';
import { requireAdminDatabaseUrl } from './lib/admin-database';

// Allowlist a moderation-console operator (ADR 0007). Runs anywhere a real Neon
// connection string is present (your machine with the Vercel env, or a one-off).
// Resolve the operator's Neon Auth id from their email (after they sign in once via
// /sign-in), or pass it directly. Idempotent: re-running updates the row.
//
//   npm run ops:seed-operator -- --email=halodyrane@gmail.com --name="Dyrane" --role=admin
//   npm run ops:seed-operator -- --subject=<neon_auth.user.id> --role=admin

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const connectionString = requireAdminDatabaseUrl();

  const email = arg('email');
  const explicitSubject = arg('subject');
  const role = arg('role') ?? 'admin';
  const name = arg('name') ?? null;
  if (!['moderator', 'operator', 'admin'].includes(role)) {
    throw new Error(`--role must be moderator|operator|admin, got "${role}".`);
  }
  if (!email && !explicitSubject) {
    throw new Error('Provide --email=<signed-in email> or --subject=<neon_auth user id>.');
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    let subject = explicitSubject;
    let resolvedEmail = email ?? null;
    if (!subject) {
      const [row] = await sql<{ id: string; email: string }[]>`
        select id, email from neon_auth."user"
        where lower(email) = lower(${email!})
        order by "createdAt" desc
        limit 1
      `;
      if (!row) throw new Error(`No neon_auth."user" row for ${email}. Sign in once at /sign-in first, then re-run.`);
      subject = row.id;
      resolvedEmail = row.email;
    }

    const [operator] = await sql<{ id: string }[]>`
      insert into moderation_operators (auth_subject, email, display_name, role, active)
      values (${subject!}, ${resolvedEmail}, ${name}, ${role}, true)
      on conflict (auth_subject) do update
        set email = excluded.email,
            display_name = coalesce(excluded.display_name, moderation_operators.display_name),
            role = excluded.role,
            active = true,
            updated_at = now()
      returning id
    `;
    console.log(`Seeded moderation operator ${subject} (${resolvedEmail ?? 'no email'}) as ${role}. Row ${operator.id}.`);
  } finally {
    await sql.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
