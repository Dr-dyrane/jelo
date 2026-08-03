const RESERVED_RUNTIME_DATABASE_ROLES = new Set([
  'jelocare_app_runtime',
  'jelocare_shelf_runtime',
]);

export const ADMIN_DATABASE_ENVIRONMENT_VARIABLE = 'MIGRATION_DATABASE_URL';

type AdminDatabaseEnvironment = {
  MIGRATION_DATABASE_URL?: string;
  [key: string]: string | undefined;
};

export function requireAdminDatabaseUrl(
  environment: AdminDatabaseEnvironment = process.env,
) {
  const candidate = environment[ADMIN_DATABASE_ENVIRONMENT_VARIABLE];
  if (!/^postgres(?:ql)?:\/\//.test(candidate ?? '')) {
    throw new Error('MIGRATION_DATABASE_URL is required for this database operator.');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate!);
  } catch {
    throw new Error('MIGRATION_DATABASE_URL is not a valid PostgreSQL URL.');
  }

  const username = decodeURIComponent(parsed.username);
  if (!username || RESERVED_RUNTIME_DATABASE_ROLES.has(username)) {
    throw new Error('MIGRATION_DATABASE_URL must use a protected administrative role.');
  }
  if (parsed.hostname.toLowerCase().includes('-pooler.')) {
    throw new Error('MIGRATION_DATABASE_URL must use a direct, non-pooled database endpoint.');
  }

  return candidate!;
}
